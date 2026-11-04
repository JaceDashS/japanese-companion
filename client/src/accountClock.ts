import { useEffect, useState } from 'react';
import { apiOriginUrl } from './hosted';

interface AccountClock { timeZone: string; serverNow: string; today: string }
let snapshot: { timeZone: string; epoch: number; tick: number } | null = null;

/** Fetches the authenticated server clock without trusting the device wall clock. */
export async function syncAccountClock(): Promise<void> {
  const response = await fetch(apiOriginUrl('/auth/clock'), { credentials: 'include', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not synchronize account date');
  const clock = await response.json() as AccountClock;
  const epoch = Date.parse(clock.serverNow);
  if (!Number.isFinite(epoch)) throw new Error('Invalid server clock');
  new Intl.DateTimeFormat('en', { timeZone: clock.timeZone });
  snapshot = { timeZone: clock.timeZone, epoch, tick: performance.now() };
}

/** Uses server time plus monotonic elapsed time; local mode keeps its existing calendar. */
export function getAccountToday(): string | null {
  if (!snapshot) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: snapshot.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(snapshot.epoch + performance.now() - snapshot.tick));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Refreshes the calendar across midnight, focus, and browser suspension. */
export function useAccountToday(fallback: () => string): string {
  const [today, setToday] = useState(() => getAccountToday() ?? fallback());
  useEffect(() => {
    let cancelled = false;
    const update = () => { if (!cancelled) setToday(getAccountToday() ?? fallback()); };
    const sync = () => { if (snapshot) void syncAccountClock().then(update).catch(() => undefined); };
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    const timer = window.setInterval(update, 1000);
    const refresh = window.setInterval(sync, 60_000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', visible);
    update();
    return () => {
      cancelled = true; clearInterval(timer); clearInterval(refresh);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [fallback]);
  return today;
}
