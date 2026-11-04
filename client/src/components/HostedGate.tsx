import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { setStorageScope } from "../data/storageScope.ts";
import {
  fetchHostedAppAccess,
  fetchHostedSession,
  loginToHost,
  siteUrl,
  UNAUTHENTICATED_EVENT,
  type HostedUser,
} from "../hosted.ts";

const APP_KEY = "japanese";
// 서브도메인에서 열려도 메인 페이지(사이트 주소)로 간다. 개발 환경처럼 같은 주소면 "/"다
const MAIN_PAGE = siteUrl("/");

type GateState =
  | { kind: "checking" }
  | { kind: "login" }
  | { kind: "denied" }
  | { kind: "password-change" }
  | { kind: "error"; message: string }
  | { kind: "ready"; user: HostedUser };

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "아이디 또는 비밀번호가 맞지 않습니다.",
  EMAIL_NOT_VERIFIED: "이메일 인증을 마친 뒤 로그인할 수 있습니다.",
  RATE_LIMITED: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
};

/**
 * 호스팅 모드에서 사이트 로그인과 앱 이용 권한을 확인한 뒤에만 앱을 그린다.
 * 사용 중에 세션이 끝나면 앱을 그대로 둔 채 로그인 팝업을 다시 띄운다.
 */
export function HostedGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: "checking" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const readyUserId = useRef("");

  const resolveUser = useCallback(async (user: HostedUser | null) => {
    if (!user) {
      setState({ kind: "login" });
      return;
    }
    if (user.mustChangePassword) {
      setState({ kind: "password-change" });
      return;
    }
    if (!(await fetchHostedAppAccess(APP_KEY))) {
      setState({ kind: "denied" });
      return;
    }
    // 다른 계정으로 다시 로그인하면 이전 계정의 화면 상태가 남지 않도록 새로 연다.
    if (readyUserId.current && readyUserId.current !== user.id) {
      window.location.reload();
      return;
    }
    readyUserId.current = user.id;
    setStorageScope(user.id);
    setState({ kind: "ready", user });
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    fetchHostedSession()
      .then(resolveUser)
      .catch((error: unknown) => setState({ kind: "error", message: String((error as Error)?.message ?? error) }));
  }, [resolveUser]);

  useEffect(() => {
    const onUnauthenticated = () => setSessionExpired(true);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  if (state.kind === "ready") {
    return (
      <>
        {children}
        {sessionExpired && <LoginDialog notice="로그인이 끝났습니다. 다시 로그인해 주세요." onLoggedIn={resolveUser} />}
      </>
    );
  }
  if (state.kind === "checking") return <GateCard title="로그인 확인 중" />;
  if (state.kind === "login") return <LoginDialog onLoggedIn={resolveUser} />;
  if (state.kind === "denied") return <GateCard title="이 앱을 사용할 권한이 없습니다." showHomeLink />;
  if (state.kind === "password-change") {
    return <GateCard title="임시 비밀번호를 바꾼 뒤 사용할 수 있습니다." showHomeLink />;
  }
  return <GateCard title="로그인 상태를 확인하지 못했습니다." message={state.message} showHomeLink />;
}

function GateCard({ title, message, showHomeLink }: { title: string; message?: string; showHomeLink?: boolean }) {
  return (
    <main className="jc-main">
      <section className="jc-card jc-stack">
        <h2 className="jc-card-title">{title}</h2>
        {message && <p className="jc-muted">{message}</p>}
        {showHomeLink && (
          <a className="jc-btn" data-variant="primary" href={MAIN_PAGE}>
            메인 페이지로
          </a>
        )}
      </section>
    </main>
  );
}

function LoginDialog({ notice, onLoggedIn }: { notice?: string; onLoggedIn: (user: HostedUser) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await loginToHost(username.trim(), password, remember);
      if ("error" in result) {
        setError(LOGIN_ERROR_MESSAGES[result.error] ?? "로그인하지 못했습니다.");
        return;
      }
      await onLoggedIn(result.user);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jpc-login-title"
      style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "rgba(0, 0, 0, 0.55)", zIndex: 1000 }}
    >
      <form className="jc-card jc-stack" style={{ width: "min(360px, 100%)" }} onSubmit={submit}>
        <h2 id="jpc-login-title" className="jc-card-title">
          로그인
        </h2>
        <p className="jc-muted">{notice ?? "jace-s 계정으로 로그인하면 학습 기록이 계정별로 저장됩니다."}</p>
        <label className="jc-field">
          <span>아이디</span>
          <input className="jc-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label className="jc-field">
          <span>비밀번호</span>
          <input
            className="jc-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="jc-row jc-muted">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          로그인 유지
        </label>
        {error && (
          <p className="jc-muted" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="jc-btn" data-variant="primary" disabled={submitting}>
          {submitting ? "로그인 중" : "로그인"}
        </button>
        <a className="jc-muted" href={MAIN_PAGE}>
          메인 페이지로
        </a>
      </form>
    </div>
  );
}
