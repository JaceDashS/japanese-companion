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
test("browser restores the shared session and sends response CSRF without exposing cookies", async () => {
  const store = memory();
  const calls: { url: string; init: RequestInit }[] = [];
  const client = new CompanionClient("https://api.jace-s.com", "japanese", store, (async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith("/session")) return response({ user: { ...user, email: "learner@example.test" }, hasLocalPassword: false, csrfToken: "browser-csrf" });
    return response({ ok: true });
  }) as typeof fetch, true);
  assert.equal((await client.restore())?.id, user.id);
  assert.equal((await client.account()).hasLocalPassword, false);
  await client.post("save-day-result", {}, user.id);
  const write = calls.at(-1)!.init;
  assert.equal(write.credentials, "include");
  assert.equal((write.headers as Record<string, string>).Cookie, undefined);
  assert.equal((write.headers as Record<string, string>)["x-csrf-token"], "browser-csrf");
  assert.equal((write.headers as Record<string, string>)["x-companion-user"], user.id);
  assert.equal(store.value(), null);
});

test("source controller transport preserves HTTP failures and account binding", async () => {
  let calls = 0;
  const client = new CompanionClient("https://api.jace-s.com", "japanese", memory(), (async (url) => {
    calls++;
    if (String(url).endsWith("/session")) return response({ user, csrfToken: "csrf" });
    return response({ error: "TEMPORARY" }, 503);
  }) as typeof fetch, true);
  await client.restore();
  const endpoint = "https://api.jace-s.com/companions/japanese/save-item-field";
  const init = { method: "POST", body: "{}", headers: { "x-companion-user": user.id } };
  assert.equal((await client.fetch(endpoint, init)).status, 503);
  const before = calls;
  const mismatch = await client.fetch(endpoint, { ...init, headers: { "x-companion-user": "account-b" } });
  assert.equal(mismatch.status, 403);
  assert.equal((await mismatch.json()).error, "ACCOUNT_CHANGED");
  assert.equal(calls, before);
  for (const path of ["https://evil.test/companions/japanese/save-item-field", "https://api.jace-s.com/auth/logout", "https://api.jace-s.com/companions/certificate/save-chapter-progress"]) {
    await assert.rejects(client.fetch(path, init), /Invalid companion request/);
  }
  assert.equal(calls, before);
});

test("browser Google session keeps the token returned by the exchange", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = new CompanionClient("https://api.jace-s.com", "japanese", memory(), (async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith("/google/config")) return response({ enabled: true, clientId: "test-client" });
    if (String(url).endsWith("/google/challenge")) return response({ nonce: "one-use" });
    if (String(url).endsWith("/google")) return response({ user, csrfToken: "google-csrf" });
    return response({}, 200);
  }) as typeof fetch, true);
  assert.equal((await client.googleConfig()).enabled, true);
  assert.equal(await client.googleChallenge(), "one-use");
  assert.equal((await client.googleLogin("synthetic-token", true)).id, user.id);
  await client.logout();
  assert.equal((calls.at(-1)!.init.headers as Record<string, string>)["x-csrf-token"], "google-csrf");
});
test("native session rotation sends CSRF and account identity and clears on expiry", async () => {
  const store = memory();
  const calls: { url: string; init: RequestInit }[] = [];
  let expire = false;
  let expirations = 0;
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
  client.onUnauthenticated = () => { expirations++; };
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
  assert.equal(expirations, 1);
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

test("explicit browser development origin remains isolated from native and other HTTP origins", () => {
  const dev = "http://192.168.0.22:3080";
  assert.doesNotThrow(() => new CompanionClient(dev, "japanese", memory(), fetch, true, dev));
  assert.throws(() => new CompanionClient(dev, "japanese", memory(), fetch, true), /HTTPS API required/);
  assert.throws(() => new CompanionClient(dev, "japanese", memory(), fetch, false, dev), /HTTPS API required/);
  assert.throws(() => new CompanionClient("http://other.example", "japanese", memory(), fetch, true, dev), /HTTPS API required/);
  assert.throws(() => new CompanionClient(dev + "/api", "japanese", memory(), fetch, true, dev), /API origin required/);
});
