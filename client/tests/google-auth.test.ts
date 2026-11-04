import assert from "node:assert/strict";
import { test } from "node:test";
import { createHostedGoogleAuth } from "../src/googleAuth.ts";

test("Google exchange preserves API origin, cookies, remember, calendar and response CSRF", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let csrf: unknown;
  const transport: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({
      user: { id: "google-user", username: "member" },
      csrfToken: "session-csrf",
    });
  };
  const auth = createHostedGoogleAuth(
    (path) => "https://api.jace-s.com" + path,
    (body) => {
      csrf = body.csrfToken;
    },
    transport,
  );
  assert.deepEqual(await auth.login("signed-credential", true), {
    ok: true,
    user: { id: "google-user", username: "member" },
  });
  assert.equal(csrf, "session-csrf");
  assert.equal(calls[0].url, "https://api.jace-s.com/auth/google");
  assert.equal(calls[0].init?.credentials, "include");
  assert.equal(calls[0].init?.cache, "no-store");
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.credential, "signed-credential");
  assert.equal(body.remember, true);
  assert.equal(body.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  await auth.login("next-credential", false);
  assert.equal(JSON.parse(String(calls[1].init?.body)).remember, false);
});

test("Google retries obtain fresh credentialed nonce requests rather than reusing a challenge", async () => {
  let nonce = 0;
  const transport: typeof fetch = async (input, init) => {
    assert.equal(String(input), "/api/auth/google/challenge");
    assert.equal(init?.credentials, "include");
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, "{}");
    return Response.json({ nonce: "nonce-" + ++nonce });
  };
  const auth = createHostedGoogleAuth(
    (path) => "/api" + path,
    () => {},
    transport,
  );
  assert.equal(await auth.challenge(), "nonce-1");
  assert.equal(await auth.challenge(), "nonce-2");
});

test("disabled Google config needs no challenge and malformed enabled config fails safely", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return Response.json({ enabled: false, clientId: null });
  };
  const auth = createHostedGoogleAuth(
    (path) => path,
    () => {},
    transport,
  );
  assert.deepEqual(await auth.configuration(), {
    enabled: false,
    clientId: null,
  });
  assert.equal(calls, 1);
  const malformed = createHostedGoogleAuth(
    (path) => path,
    () => {},
    async () => Response.json({ enabled: true }),
  );
  await assert.rejects(malformed.configuration(), /GOOGLE_CONFIG_FAILED/);
});

test("Google errors and network failures never create a successful local login or cache CSRF", async () => {
  let cached = false;
  const auth = createHostedGoogleAuth(
    (path) => path,
    () => {
      cached = true;
    },
    async () =>
      Response.json(
        { error: "GOOGLE_ACCOUNT_CONFLICT", csrfToken: "wrong" },
        { status: 409 },
      ),
  );
  assert.deepEqual(await auth.login("credential", false), {
    ok: false,
    error: "GOOGLE_ACCOUNT_CONFLICT",
  });
  assert.equal(cached, false);
  const rejected = createHostedGoogleAuth(
    (path) => path,
    () => {
      cached = true;
    },
    async () => Response.json({ error: "provider details" }, { status: 503 }),
  );
  await assert.rejects(rejected.challenge(), /GOOGLE_CHALLENGE_FAILED/);
  const offline = createHostedGoogleAuth(
    (path) => path,
    () => {
      cached = true;
    },
    async () => {
      throw new Error("offline");
    },
  );
  await assert.rejects(offline.login("credential", false), /offline/);
  assert.equal(cached, false);
});
