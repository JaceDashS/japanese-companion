import * as storage from "./studyCache";

const VERSION = 1;
const LAST_KEY = "last-account";
type Locator = { owner: string; content: string };
type Snapshot<T> = Locator & { version: number; savedAt: number; payload: T };
let tail: Promise<unknown> = Promise.resolve();

function serialize<T>(action: () => Promise<T>) {
  const result = tail.then(action);
  tail = result.catch(() => undefined);
  return result;
}

const key = ({ owner, content }: Locator) => owner + "/" + encodeURIComponent(content);

async function locator(): Promise<Locator | null> {
  const raw = await storage.read(LAST_KEY);
  if (!raw) return null;
  const value: Locator = JSON.parse(raw);
  return typeof value.owner === "string" && /^[a-zA-Z0-9_-]+$/.test(value.owner) && typeof value.content === "string" && value.content
    ? value : null;
}

export function readSnapshot<T>() {
  return serialize(async (): Promise<Snapshot<T> | null> => {
    const last = await locator();
    if (!last) return null;
    const raw = await storage.read(key(last));
    if (!raw) return null;
    const snapshot: Snapshot<T> = JSON.parse(raw);
    return snapshot.version === VERSION && snapshot.owner === last.owner && snapshot.content === last.content && Number.isFinite(snapshot.savedAt)
      ? snapshot : null;
  }).catch(() => null);
}

export function saveSnapshot<T>(owner: string, content: string, payload: T) {
  return serialize(async () => {
    const reference = { owner, content };
    const snapshot: Snapshot<T> = { ...reference, version: VERSION, savedAt: Date.now(), payload };
    await storage.write(key(reference), JSON.stringify(snapshot));
    await storage.write(LAST_KEY, JSON.stringify(reference));
  }).catch(() => undefined);
}

export function clearSnapshot(owner?: string) {
  return serialize(async () => {
    const last = await locator();
    if (!owner || owner === last?.owner) await storage.remove(LAST_KEY);
    const target = owner ?? last?.owner;
    if (target) await storage.removeAccount(target);
  }).catch(() => undefined);
}
