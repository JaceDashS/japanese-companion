import { useEffect } from "react";
/** Retain the original browser focus and visibility refresh after queued source writes finish. */
export function useHomeFocus(active: boolean, refresh: () => Promise<void>, onError: (error: unknown) => void) {
  useEffect(() => { if (!active) return; const focus = () => { if (document.visibilityState !== "hidden") void refresh().catch(onError); }; window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus); return () => { window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); }; }, [active, refresh, onError]);
}
