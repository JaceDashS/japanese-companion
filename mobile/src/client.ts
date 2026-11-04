export type AppKey = "japanese" | "certificate";
export interface User {
  id: string;
  username: string;
  mustChangePassword?: boolean;
  name?: string;
  displayName?: string;
  email?: string | null;
  emailVerified?: boolean;
  hasLocalPassword?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}
export interface Clock {
  serverNow: string;
  timeZone: string;
  today: string;
}
export interface SessionStore {
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
}
interface Credentials {
  session: string;
  csrf: string;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public payload?: unknown,
  ) {
    super(code);
  }
}
/** Serialized platform session client. Native credentials stay in the encrypted store; browsers use API cookies. */
export class CompanionClient {
  private credentials: Credentials | null = null;
  private user: User | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private csrfToken = "";
  onUnauthenticated?: () => void;
  constructor(
    readonly baseUrl: string,
    readonly app: AppKey,
    private store: SessionStore,
    private send: typeof fetch,
    private browser = false,
  ) {
    const url = new URL(baseUrl);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "10.0.2.2"].includes(url.hostname)
      )
    )
      throw new Error("HTTPS API required");
    if (
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error("API origin required");
  }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async clear() {
    this.credentials = null;
    this.user = null;
    this.csrfToken = "";
    await this.store.write(null);
  }
  private async request<T>(
    path: string,
    body?: unknown,
    account?: string,
  ): Promise<T> {
    // api.jace-s.com 기준 경로(/auth/session)만 받는다. 절대 주소나 상대 경로는 거부한다
    if (!/^\/[a-z]/.test(path)) throw new Error("Invalid API path");
    if (account && this.user?.id !== account)
      throw new ApiError(403, "ACCOUNT_CHANGED");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.credentials) {
      headers.Cookie =
        "session=" +
        encodeURIComponent(this.credentials.session) +
        "; csrf=" +
        encodeURIComponent(this.credentials.csrf);
      if (body !== undefined) headers["x-csrf-token"] = this.credentials.csrf;
    }
    if (this.browser) {
      delete headers.Cookie;
      if (body !== undefined && this.csrfToken) headers["x-csrf-token"] = this.csrfToken;
    }
    if (account) headers["x-companion-user"] = account;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await this.send(this.baseUrl.replace(/\/$/, "") + path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: this.browser ? "include" : "omit",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    const next = { ...this.credentials };
    const raw =
      (
        response.headers as Headers & { getSetCookie?: () => string[] }
      ).getSetCookie?.() ?? [];
    const cookies = raw.length
      ? raw
      : (response.headers.get("set-cookie") ?? "").split(
          /,(?=\s*(?:session|csrf)=)/,
        );
    for (const cookie of cookies) {
      const match = /^\s*(session|csrf)=([^;]*)/.exec(cookie);
      if (match)
        next[match[1] as keyof Credentials] = decodeURIComponent(match[2]);
    }
    if (!this.browser && next.session && next.csrf) {
      this.credentials = next as Credentials;
      await this.store.write(JSON.stringify(this.credentials));
    }
    if (response.status === 401) { await this.clear(); this.onUnauthenticated?.(); }
    const payload =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (this.browser && typeof payload?.csrfToken === "string") this.csrfToken = payload.csrfToken;
    if (!response.ok)
      throw new ApiError(
        response.status,
        payload?.error ?? "HTTP_" + response.status,
        payload,
      );
    return payload as T;
  }
  /** Restore and validate a saved session before exposing any account data. */
  restore(): Promise<User | null> {
    return this.serialize(async () => {
      if (!this.browser) {
        const saved = await this.store.read();
        if (!saved) return null;
        try {
          const value = JSON.parse(saved);
          if (!value.session || !value.csrf) throw new Error("Invalid session");
          this.credentials = value;
        } catch {
          await this.clear();
          return null;
        }
      }
      try {
        const result = await this.request<{ user: User }>("/auth/session");
        this.user = result.user;
        return result.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    });
  }
  /** Authenticate using the existing account API; plaintext passwords are never persisted. */
  login(username: string, password: string, remember = true): Promise<User> {
    return this.serialize(async () => {
      await this.clear();
      const result = await this.request<{ user: User }>("/auth/login", {
        username: username.trim(),
        password,
        remember,
      });
      if (!this.browser && !this.credentials)
        throw new Error("로그인 세션을 저장하지 못했습니다.");
      this.user = result.user;
      return result.user;
    });
  }
  /** Read complete account details through the current authenticated session. */
  account(): Promise<User> {
    return this.serialize(async () => {
      const result = await this.request<{ user: User; hasLocalPassword?: boolean }>("/auth/session");
      if (this.user && result.user.id !== this.user.id) throw new ApiError(403, "ACCOUNT_CHANGED");
      this.user = { ...result.user, hasLocalPassword: result.hasLocalPassword ?? result.user.hasLocalPassword ?? true };
      return this.user;
    });
  }
  /** Read public configuration for Google's browser sign-in button. */
  googleConfig(): Promise<{ enabled: boolean; clientId: string | null }> {
    return this.serialize(() => this.request("/auth/google/config"));
  }
  /** Obtain the one-use browser Google challenge. */
  googleChallenge(): Promise<string> {
    return this.serialize(async () => (await this.request<{ nonce: string }>("/auth/google/challenge", {})).nonce);
  }
  /** Exchange a Google browser credential for the existing platform session. */
  googleLogin(credential: string, remember: boolean): Promise<User> {
    if (!this.browser) return Promise.reject(new Error("Google sign-in requires the browser transport"));
    return this.serialize(async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await this.request<{ user: User }>("/auth/google", { credential, remember, timeZone });
      this.user = result.user;
      return result.user;
    });
  }
  /** Adapt existing source-write controllers to the same serialized account-bound transport. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input));
    const origin = new URL(this.baseUrl).origin;
    const prefix = "/companions/" + this.app + "/";
    if (url.origin !== origin || !url.pathname.startsWith(prefix) || url.username || url.password || url.hash) {
      return Promise.reject(new Error("Invalid companion request"));
    }
    const method = (init?.method ?? "GET").toUpperCase();
    if (!["GET", "POST"].includes(method)) return Promise.reject(new Error("Unsupported companion method"));
    const account = new Headers(init?.headers).get("x-companion-user") ?? undefined;
    const body = method === "POST" ? JSON.parse(String(init?.body ?? "{}")) : undefined;
    return this.serialize(async () => {
      try {
        const value = await this.request(url.pathname + url.search, body, account);
        return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return new Response(JSON.stringify(error.payload ?? { error: error.code }), { status: error.status, headers: { "Content-Type": "application/json" } });
      }
    });
  }
  /** Revoke the server session. A failed request remains retryable instead of claiming logout succeeded. */
  logout(): Promise<void> {
    return this.serialize(async () => {
      await this.request("/auth/logout", {});
      await this.clear();
    });
  }
  /** Read the account calendar and app permission before loading curriculum. */
  bootstrap(): Promise<Clock> {
    return this.serialize(async () => {
      const access = await this.request<{
        canUse: boolean;
        mustChangePassword: boolean;
      }>("/app-access/" + this.app);
      if (access.mustChangePassword)
        throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED");
      if (!access.canUse) throw new ApiError(403, "APP_ACCESS_DENIED");
      return this.request<Clock>("/auth/clock");
    });
  }
  /** Refresh the server clock after foregrounding, without writing device dates. */
  clock(): Promise<Clock> {
    return this.serialize(() => this.request<Clock>("/auth/clock"));
  }
  /** Read a companion route with the currently validated session. */
  get<T>(suffix: string): Promise<T> {
    return this.serialize(() => this.request<T>(this.route(suffix)));
  }
  /** Send an account-bound write once; an explicit user retry is required after a network failure. */
  post<T>(suffix: string, body: unknown, account: string): Promise<T> {
    return this.serialize(() =>
      this.request<T>(this.route(suffix), body, account),
    );
  }
  /** Change a temporary password using the existing authenticated endpoint. */
  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.serialize(() =>
      this.request<void>("/auth/password", {
        currentPassword,
        newPassword,
      }),
    );
  }
  /** Resolve authenticated study images only within this API origin. */
  mediaSource(
    src: string,
  ): { uri: string; headers: Record<string, string> } | null {
    if (
      !this.credentials ||
      !/^\/study\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.png$/.test(src)
    )
      return null;
    return {
      uri:
        this.baseUrl.replace(/\/$/, "") +
        "/companions/certificate/media/" +
        src.slice(7),
      headers: {
        Cookie: "session=" + encodeURIComponent(this.credentials.session),
      },
    };
  }
  private route(suffix: string) {
    if (!/^[a-z-]+(?:\/[a-z-]+)?$/.test(suffix))
      throw new Error("Invalid companion route");
    return "/companions/" + this.app + "/" + suffix;
  }
}
/** Project server time forward using monotonic elapsed time and the account zone. */
export function accountDate(clock: Clock, elapsedMs: number): string {
  const epoch = Date.parse(clock.serverNow);
  if (!Number.isFinite(epoch)) throw new Error("Invalid server clock");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: clock.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epoch + Math.max(0, elapsedMs)));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}
