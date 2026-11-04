import assert from "node:assert/strict";
import { test } from "node:test";
import { CompanionClient, ApiError, accountDate } from "../src/client.ts";
function memory() {
  let value: string | null = null;
  return {
    read: async () => value,
    write: async (v: string | null) => {
      value = v;
    },
    value: () => value,
  };
}
function response(body: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers,
  });
}
const user = { id: "account-a", username: "a" };
test("native session rotation sends CSRF and account identity and clears on expiry", async () => {
  const store = memory();
  const calls: { url: string; init: RequestInit }[] = [];
  let expire = false;
  const send = async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/login"))
      return response({ user }, 200, [
        "session=old; HttpOnly; Path=/",
        "csrf=first; Path=/",
      ]);
    if (String(url).endsWith("/session"))
      return response({ user }, 200, [
        "session=new; HttpOnly; Path=/",
        "csrf=rotated; Path=/",
      ]);
    if (expire) return response({ error: "UNAUTHENTICATED" }, 401);
    return response({ ok: true });
  };
  const client = new CompanionClient(
    "https://api.jace-s.com",
    "japanese",
    store,
    send as typeof fetch,
  );
  await client.login("a", "private-password");
  assert.ok(!store.value()?.includes("private-password"));
  await client.restore();
  await client.post("save-day-result", {}, user.id);
  const headers = calls.at(-1)!.init.headers as Record<string, string>;
  assert.equal(headers.Cookie, "session=new; csrf=rotated");
  assert.equal(headers["x-csrf-token"], "rotated");
  assert.equal(headers["x-companion-user"], user.id);
  assert.equal(calls.at(-1)!.url, "https://api.jace-s.com/companions/japanese/save-day-result");
  assert.equal(calls.at(-1)!.init.redirect, "error");
  assert.equal(calls.at(-1)!.init.credentials, "omit");
  expire = true;
  await assert.rejects(
    client.get("app-preferences"),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(store.value(), null);
});
test("stale account writes are blocked locally and network failures remain failures", async () => {
  const store = memory();
  let calls = 0;
  const client = new CompanionClient(
    "https://api.jace-s.com",
    "certificate",
    store,
    (async (url: any) => {
      calls++;
      if (String(url).endsWith("/login"))
        return response({ user }, 200, ["session=x", "csrf=y"]);
      throw new Error("offline");
    }) as typeof fetch,
  );
  await client.login("a", "p");
  const before = calls;
  await assert.rejects(
    client.post("save-chapter-progress", {}, "account-b"),
    (e: unknown) => e instanceof ApiError && e.code === "ACCOUNT_CHANGED",
  );
  assert.equal(calls, before);
  await assert.rejects(
    client.post("save-chapter-progress", {}, user.id),
    /offline/,
  );
  assert.ok(store.value());
});
test("cookie parsing preserves Expires commas and media credentials never leave the trusted study origin", async () => {
  const store = memory();
  const client = new CompanionClient(
    "https://api.jace-s.com",
    "certificate",
    store,
    (async () =>
      response({ user }, 200, [
        "session=secret; Expires=Wed, 30 Dec 2026 10:00:00 GMT; HttpOnly",
        "csrf=token",
      ])) as typeof fetch,
  );
  await client.login("a", "p");
  assert.equal(client.mediaSource("https://evil.example/image.png"), null);
  assert.equal(client.mediaSource("/study/../secret.png"), null);
  assert.equal(
    client.mediaSource("/study/aif/example.png")?.headers.Cookie,
    "session=secret",
  );
});
test("server calendar rolls over in account zone without reading the device wall clock", () => {
  const clock = {
    serverNow: "2026-10-28T14:59:59.000Z",
    timeZone: "Asia/Seoul",
    today: "2026-10-28",
  };
  assert.equal(accountDate(clock, 0), "2026-10-28");
  assert.equal(accountDate(clock, 1000), "2026-10-29");
});
