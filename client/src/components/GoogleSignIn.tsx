import { useEffect, useRef, useState } from "react";
import { hostedGoogleAuth, type HostedUser } from "../hosted.ts";

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    callback: (result: { credential: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: string;
      theme: string;
      size: string;
      text: string;
      locale: string;
      width: number;
    },
  ): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let scriptReady: Promise<GoogleIdentity> | undefined;
function loadGoogle(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id)
    return Promise.resolve(window.google.accounts.id);
  if (!scriptReady) {
    scriptReady = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts.id) resolve(window.google.accounts.id);
        else {
          scriptReady = undefined;
          script.remove();
          reject(new Error("GOOGLE_SCRIPT_FAILED"));
        }
      };
      script.onerror = () => {
        scriptReady = undefined;
        script.remove();
        reject(new Error("GOOGLE_SCRIPT_FAILED"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptReady;
}

const failed = "구글 로그인에 실패했습니다. 다시 시도해 주세요.";
const errors: Record<string, string> = {
  GOOGLE_ACCOUNT_CONFLICT:
    "이미 가입된 이메일입니다. 기존 계정으로 로그인해 주세요.",
  RATE_LIMITED: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
  ACCOUNT_SUSPENDED: "사용할 수 없는 계정입니다.",
  ACCOUNT_EXPIRED: "계정 이용 기간이 끝났습니다.",
};

/** Google's official button for direct hosted entry; success reuses the existing account and access guard. */
export function GoogleSignIn({
  remember,
  disabled,
  onBusyChange,
  onLoggedIn,
}: {
  remember: boolean;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onLoggedIn: (user: HostedUser) => Promise<void>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ remember, disabled, onBusyChange, onLoggedIn });
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  latest.current = { remember, disabled, onBusyChange, onLoggedIn };

  useEffect(() => {
    let active = true;
    let completed = false;
    const container = host.current;
    async function accept(credential: string) {
      if (!active || completed || busy.current || latest.current.disabled)
        return;
      busy.current = true;
      latest.current.onBusyChange(true);
      setSubmitting(true);
      setError("");
      try {
        const result = await hostedGoogleAuth.login(
          credential,
          latest.current.remember,
        );
        if (!active) return;
        if ("error" in result) {
          setError(errors[result.error] ?? failed);
          return;
        }
        completed = true;
        await latest.current.onLoggedIn(result.user);
      } catch {
        if (active) setError(failed);
      } finally {
        busy.current = false;
        if (active) {
          setSubmitting(false);
          latest.current.onBusyChange(false);
        }
      }
    }
    async function start() {
      try {
        const config = await hostedGoogleAuth.configuration();
        if (!active) return;
        setEnabled(config.enabled);
        if (!config.enabled || !config.clientId) return;
        const nonce = await hostedGoogleAuth.challenge();
        if (!active) return;
        const identity = await loadGoogle();
        if (!active || !container) return;
        identity.initialize({
          client_id: config.clientId,
          nonce,
          auto_select: false,
          callback: ({ credential }) => {
            void accept(credential);
          },
        });
        container.replaceChildren();
        identity.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          locale: "ko",
          width: Math.min(320, container.clientWidth || 320),
        });
      } catch {
        if (active) {
          setEnabled(true);
          setError(failed);
        }
      }
    }
    void start();
    return () => {
      active = false;
      container?.replaceChildren();
    };
  }, [attempt]);

  return (
    <div aria-busy={submitting} hidden={!enabled}>
      <div
        ref={host}
        style={{
          display: error || submitting ? "none" : "flex",
          justifyContent: "center",
          pointerEvents: disabled ? "none" : undefined,
          opacity: disabled ? 0.6 : 1,
        }}
        aria-disabled={disabled}
      />
      {submitting && <p role="status">구글 로그인 중…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError("");
              setAttempt((value) => value + 1);
            }}
          >
            구글 로그인 다시 시도
          </button>
        </>
      )}
    </div>
  );
}
