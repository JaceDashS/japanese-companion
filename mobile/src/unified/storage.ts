import AsyncStorage from "@react-native-async-storage/async-storage";

const cache = new Map<string, string>();
/** Hydrate one account-scoped value before synchronous study-state construction. */
export async function hydrate(key: string) {
  const value = await AsyncStorage.getItem(key);
  if (value !== null) cache.set(key, value);
}
export const read = (key: string) => cache.get(key) ?? null;
export async function write(key: string, value: string | null) {
  if (value === null) { cache.delete(key); await AsyncStorage.removeItem(key); }
  else { cache.set(key, value); await AsyncStorage.setItem(key, value); }
}
export async function readAsync(key: string) {
  await hydrate(key);
  return read(key);
}
