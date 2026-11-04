import type { HostedLoginResult, HostedUser } from "./hosted.ts";

export interface GoogleConfiguration {
  enabled: boolean;
  clientId: string | null;
}

/** Adapt the existing browser Google endpoints to this product's API resolver and CSRF cache. */
export function createHostedGoogleAuth(
  apiUrl: (path: string) => string,
  cacheCsrf: (body: { csrfToken?: unknown }) => void,
  transport: typeof fetch = (input, init) => fetch(input, init),
) {
  async function configuration(): Promise<GoogleConfiguration> {
    const response = await transport(apiUrl("/auth/google/config"), {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("GOOGLE_CONFIG_FAILED");
    const body = (await response.json()) as {
      enabled?: unknown;
      clientId?: unknown;
    };
    if (body.enabled !== true) return { enabled: false, clientId: null };
    if (typeof body.clientId !== "string" || !body.clientId)
      throw new Error("GOOGLE_CONFIG_FAILED");
    return { enabled: true, clientId: body.clientId };
  }

  async function challenge(): Promise<string> {
    const response = await transport(apiUrl("/auth/google/challenge"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("GOOGLE_CHALLENGE_FAILED");
    const body = (await response.json()) as { nonce?: unknown };
    if (typeof body.nonce !== "string" || !body.nonce)
      throw new Error("GOOGLE_CHALLENGE_FAILED");
    return body.nonce;
  }

  async function login(
    credential: string,
    remember: boolean,
  ): Promise<HostedLoginResult> {
    const response = await transport(apiUrl("/auth/google"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential,
        remember,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      user?: HostedUser;
      error?: string;
      csrfToken?: unknown;
    };
    if (!response.ok || !body.user)
      return { ok: false, error: body.error ?? `HTTP_${response.status}` };
    cacheCsrf(body);
    return { ok: true, user: body.user };
  }

  return { configuration, challenge, login };
}
