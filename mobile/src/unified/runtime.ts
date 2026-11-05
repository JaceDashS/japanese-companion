import { Platform } from "react-native";
import { createPlatformClient } from "../platformClient";
import { accountDate, type Clock } from "../client";
import { configureQueueStorage } from "../../.generated/product/shared/controllers/domain/sourceWriteQueue.js";
import { getStorageScope, scopedStorageKey } from "../../.generated/product/shared/controllers/data/storageScope.js";
import * as storage from "./storage";
import { NativeQueueStorage } from "./queueStorage";

export const client = createPlatformClient();
let clock: { value: Clock; tick: number } | null = null;
/** Install the current screen's session-expiry handler; cleanup avoids stale account callbacks. */
export function listenForExpiry(callback: () => void) {
  client.onUnauthenticated = callback;
  return () => { if (client.onUnauthenticated === callback) client.onUnauthenticated = undefined; };
}
export function setClock(value: Clock) { clock = { value, tick: performance.now() }; }
export function getTodayString() {
  if (!clock) throw new Error("Account clock is not ready");
  return accountDate(clock.value, performance.now() - clock.tick);
}
/** Resolve only this product's companion API paths. */
export function apiUrl(suffix: string, query?: Record<string, unknown>) {
  if (!/^[a-z-]+(?:\/[a-z-]+)?$/.test(suffix)) throw new Error("Invalid companion route");
  const url = new URL("/companions/japanese/" + suffix, client.baseUrl);
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  return url.toString();
}
/** Keep existing source controllers on the account client and notify the gate on expiry. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if ((init?.method ?? "GET").toUpperCase() === "POST" && !headers.has("x-companion-user")) headers.set("x-companion-user", getStorageScope());
  const result = await client.fetch(input, { ...init, headers });
  return result;
}
const stateKey = (book: string) => scopedStorageKey("jlpt-state-" + book);
export async function hydrateState(book: string) { await storage.hydrate(stateKey(book)); }
export function loadState(book: string) {
  try { return JSON.parse(storage.read(stateKey(book)) ?? "null"); } catch { return null; }
}
export function saveState(value: unknown, book: string) { void storage.write(stateKey(book), JSON.stringify(value)).catch(console.error); }
export function clearState(book: string) { return storage.write(stateKey(book), null); }

if (Platform.OS !== "web") {
  configureQueueStorage(() => {
    const key = scopedStorageKey("jpc-source-write-queue");
    return new NativeQueueStorage((value) => storage.write(key, value), () => storage.readAsync(key));
  });
}
