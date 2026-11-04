/**
 * 호스팅 모드: 서브도메인(운영) 또는 사이트의 하위 경로(개발)에서 앱 화면만 제공하고, 로그인과 데이터는 사이트의 API를 쓴다.
 * 빌드할 때 VITE_JPC_HOSTED_API_BASE(예: /api/companions/japanese)를 주면 켜진다. 비워 두면 기존 로컬 모드다.
 */
// import.meta.env는 Vite 밖(api 테스트가 도메인 코드를 불러올 때)에서는 없으므로 ?.로 읽는다
const HOSTED_API_BASE = String(import.meta.env?.VITE_JPC_HOSTED_API_BASE ?? "").trim().replace(/\/+$/, "");
/**
 * 사이트 화면 주소(예: https://jace-s.com). 앱이 서브도메인에서 열릴 때만 준다. 메인 페이지 링크에 쓴다.
 * 비우면 화면과 같은 주소를 쓴다(개발 환경의 하위 경로 방식).
 */
const SITE_ORIGIN = String(import.meta.env?.VITE_JPC_SITE_ORIGIN ?? "").trim().replace(/\/+$/, "");
/**
 * 로그인과 데이터 API 주소(예: https://api.jace-s.com). 비우면 SITE_ORIGIN을 쓴다.
 * 로그인 쿠키는 이 주소에만 있으므로 세션, 로그인, 공지 요청도 여기로 보낸다.
 */
const API_ORIGIN_SETTING = String(import.meta.env?.VITE_JPC_API_ORIGIN ?? "").trim().replace(/\/+$/, "");
const API_ORIGIN = API_ORIGIN_SETTING || SITE_ORIGIN;
import { syncAccountClock } from "./accountClock";
import { createHostedGoogleAuth } from "./googleAuth.ts";
const SESSION_PATH = "/auth/session";
const LOGIN_PATH = "/auth/login";
const LOGOUT_PATH = "/auth/logout";
const CSRF_COOKIE = "csrf";
const CSRF_HEADER = "x-csrf-token";
export const UNAUTHENTICATED_EVENT = "jpc:unauthenticated";

export interface HostedUser {
  id: string;
  username: string;
  mustChangePassword?: boolean;
  displayName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

/** 계정 화면에 보여 줄 현재 세션 정보. 비밀번호가 없는 Google 전용 계정이면 hasLocalPassword가 false다. */
export interface HostedAccount {
  user: HostedUser;
  hasLocalPassword: boolean;
}

export function isHostedMode() {
  return HOSTED_API_BASE !== "";
}

export function readHostedApiBase() {
  return HOSTED_API_BASE;
}

/** 사이트 화면(메인 페이지 등)의 절대 또는 같은 주소 경로. */
export function siteUrl(path: string) {
  return `${SITE_ORIGIN}${path}`;
}

/**
 * API(로그인, 데이터, /health, /notices) 경로를 /api 없이(/auth/session) 받아 요청 URL로 바꾼다.
 * API 주소(api.jace-s.com)가 따로 있으면 그대로 붙이고, 사이트와 같은 주소(개발 환경)면 /api를 붙인다. /health와 /notices는 원래 /api가 없다.
 */
export function apiOriginUrl(path: string) {
  if (API_ORIGIN_SETTING || /^\/(health|notices)(\?|$)/.test(path)) return `${API_ORIGIN}${path}`;
  return `${API_ORIGIN}/api${path}`;
}

export function readApiOrigin() {
  return API_ORIGIN;
}

// 서브도메인 화면은 사이트의 CSRF 쿠키를 읽을 수 없으므로 세션·로그인 응답으로 받은 값을 쓴다
let responseCsrfToken = "";
function rememberCsrfToken(body: { csrfToken?: unknown }) {
  if (typeof body.csrfToken === "string" && body.csrfToken) responseCsrfToken = body.csrfToken;
}

/** Browser Google transport using the same API URL and CSRF cache as password login. */
export const hostedGoogleAuth = createHostedGoogleAuth(apiOriginUrl, rememberCsrfToken);

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

/**
 * 사이트 세션 쿠키로 인증하므로, 변경 요청에는 CSRF 쿠키 값을 헤더로 붙인다.
 */
export function attachCsrfToken(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || request.headers.has(CSRF_HEADER)) return request;
  const token = responseCsrfToken || readCookie(CSRF_COOKIE);
  if (!token) return request;
  const headers = new Headers(request.headers);
  headers.set(CSRF_HEADER, token);
  return new Request(request, { headers });
}

/**
 * 데이터 API가 401을 돌려주면 화면이 로그인 팝업을 다시 띄우도록 알린다.
 */
export function notifyIfUnauthenticated(response: Response) {
  if (isHostedMode() && response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  }
}

export async function fetchHostedSession(): Promise<HostedUser | null> {
  return (await fetchHostedAccount())?.user ?? null;
}

/** 현재 로그인 세션의 계정 정보. 로그인되어 있지 않으면 null이다. */
export async function fetchHostedAccount(): Promise<HostedAccount | null> {
  const response = await fetch(apiOriginUrl(SESSION_PATH), { credentials: "include", cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`세션 확인 실패 (${response.status})`);
  const body = (await response.json()) as { user?: HostedUser; hasLocalPassword?: unknown; csrfToken?: unknown };
  rememberCsrfToken(body);
  return body.user ? { user: body.user, hasLocalPassword: body.hasLocalPassword !== false } : null;
}

/**
 * 사이트 세션을 끝낸다. 세션 쿠키는 api 주소 한 곳에 있으므로 같은 브라우저의 다른 앱과 메인 사이트도 함께 로그아웃된다.
 * 서버가 거절하면 로그아웃된 척하지 않고 오류를 던진다.
 */
export async function logoutFromHost(): Promise<void> {
  const token = responseCsrfToken || readCookie(CSRF_COOKIE);
  const response = await fetch(apiOriginUrl(LOGOUT_PATH), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { [CSRF_HEADER]: token } : {}) },
    body: "{}",
  });
  if (!response.ok && response.status !== 401) throw new Error(`로그아웃 실패 (${response.status})`);
  responseCsrfToken = "";
}

export async function fetchHostedAppAccess(appKey: string): Promise<boolean> {
  await syncAccountClock();
  const response = await fetch(apiOriginUrl(`/app-access/${encodeURIComponent(appKey)}`), { credentials: "include", cache: "no-store" });
  if (!response.ok) return false;
  const body = (await response.json()) as { canUse?: boolean };
  return body.canUse === true;
}

export type HostedLoginResult = { ok: true; user: HostedUser } | { ok: false; error: string };

export async function loginToHost(username: string, password: string, remember: boolean): Promise<HostedLoginResult> {
  const response = await fetch(apiOriginUrl(LOGIN_PATH), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, remember }),
  });
  const body = (await response.json().catch(() => ({}))) as { user?: HostedUser; error?: string; csrfToken?: unknown };
  rememberCsrfToken(body);
  if (response.ok && body.user) return { ok: true, user: body.user };
  return { ok: false, error: body.error ?? `HTTP_${response.status}` };
}
