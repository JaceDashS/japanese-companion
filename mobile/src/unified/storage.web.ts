/** Browser cache access remains synchronous and account scoped. */
export async function hydrate(_key: string) {}
export function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
export async function write(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}
export async function readAsync(key: string) { return read(key); }
