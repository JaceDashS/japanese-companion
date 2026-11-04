import { useEffect, useState } from "react";
import { fetchHostedAccount, siteUrl, type HostedAccount } from "../hosted.ts";
import { useHostedSession } from "./HostedGate.tsx";
import { Card } from "./common/Primitives.tsx";

// 이름·이메일 변경, 비밀번호 변경은 메인 사이트의 마이페이지에서 한다
const MY_PAGE = siteUrl("/#my-page");

const LABELS = {
  ko: {
    title: "계정",
    loading: "계정 정보를 불러오는 중",
    loadFailed: "계정 정보를 불러오지 못했습니다.",
    name: "이름",
    username: "아이디",
    email: "이메일",
    verified: "인증됨",
    unverified: "인증 전",
    method: "로그인 방식",
    password: "아이디·비밀번호",
    googleOnly: "Google 전용",
    createdAt: "가입일",
    lastLoginAt: "마지막 로그인",
    none: "없음",
    manage: "메인 사이트에서 계정 관리",
    logout: "로그아웃",
    loggingOut: "로그아웃 중",
    logoutHint: "같은 브라우저의 다른 jace-s 앱과 메인 사이트도 함께 로그아웃됩니다.",
    logoutFailed: "로그아웃하지 못했습니다. 다시 시도해 주세요.",
  },
  en: {
    title: "Account",
    loading: "Loading account",
    loadFailed: "Could not load the account.",
    name: "Name",
    username: "Username",
    email: "Email",
    verified: "verified",
    unverified: "not verified",
    method: "Sign-in method",
    password: "Username and password",
    googleOnly: "Google only",
    createdAt: "Joined",
    lastLoginAt: "Last sign-in",
    none: "None",
    manage: "Manage account on the main site",
    logout: "Sign out",
    loggingOut: "Signing out",
    logoutHint: "Other jace-s apps and the main site in this browser are signed out too.",
    logoutFailed: "Could not sign out. Please try again.",
  },
} as const;

export type AccountLanguage = keyof typeof LABELS;

function formatTime(value: string | null | undefined, language: AccountLanguage) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * 설정 화면 맨 위의 계정 카드. 사이트 로그인으로 연 화면(호스팅 모드)에서만 보인다.
 * 현재 세션의 이름, 아이디, 이메일, 로그인 방식, 가입일, 마지막 로그인을 보여 주고 로그아웃할 수 있다.
 */
export function AccountCard({ language = "ko" }: { language?: AccountLanguage }) {
  const session = useHostedSession();
  const text = LABELS[language];
  const [account, setAccount] = useState<HostedAccount | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchHostedAccount()
      .then((next) => active && (setAccount(next), setLoadError(!next)))
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [session]);

  if (!session) return null;

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await session.logout();
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
    }
  };

  const user = account?.user;
  const rows: Array<[string, string]> = user
    ? [
        [text.name, user.displayName || text.none],
        [text.username, user.username],
        [text.email, user.email ? `${user.email} (${user.emailVerified ? text.verified : text.unverified})` : text.none],
        [text.method, account.hasLocalPassword ? text.password : text.googleOnly],
        [text.createdAt, formatTime(user.createdAt, language) || text.none],
        [text.lastLoginAt, formatTime(user.lastLoginAt, language) || text.none],
      ]
    : [];

  return (
    <Card title={text.title}>
      <div data-role="account-card">
        {!user && <p className="jc-muted">{loadError ? text.loadFailed : text.loading}</p>}
        {user && (
          <dl style={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", gap: "6px 16px", margin: "0 0 12px" }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt className="jc-muted">{label}</dt>
                <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="jc-settings-actions">
          <a className="jc-btn" href={MY_PAGE} style={{ color: "inherit", textDecoration: "none" }}>
            {text.manage}
          </a>
          <button type="button" className="jc-btn" data-variant="danger" onClick={() => void logout()} disabled={loggingOut}>
            {loggingOut ? text.loggingOut : text.logout}
          </button>
        </div>
        <p className="jc-muted" style={{ marginBottom: 0 }}>{text.logoutHint}</p>
        {logoutError && (
          <p className="jc-muted" role="alert">
            {text.logoutFailed}
          </p>
        )}
      </div>
    </Card>
  );
}
