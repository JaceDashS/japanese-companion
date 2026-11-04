import { useEffect, useRef, useState, type CSSProperties } from "react";
import { apiOriginUrl } from "../hosted";

// 개발자 옵션 미리보기. 메인 사이트 services/web/src/components/Notices/noticePreview.ts와 같은 키와 값을 쓴다
// companion은 jace-s.com과 같은 origin이라 관리 화면에서 켠 미리보기를 그대로 읽는다
const NOTICE_PREVIEW_KEY = "jace-s:notice-preview";
const NOTICE_PREVIEW_EVENT = "jace-s:notice-preview";
type NoticePreview = "notice" | "outage" | "all";
function readNoticePreview(): NoticePreview | null {
  try {
    const value = window.localStorage.getItem(NOTICE_PREVIEW_KEY);
    return ["notice", "outage", "all"].includes(value ?? "") ? value as NoticePreview : null;
  } catch { return null; }
}

type Announcement = { id: string; title: string };
type Health = { serviceStatus: string; message: string; announcements: Announcement[] };
// sticky 토스트는 직접 닫을 때까지 남는다
type Toast = { id: string; kind: "status" | "notice"; title: string; sticky: boolean };

// 서버 응답을 받지 못한 경우도 서버에 연결할 수 없는 것과 같으므로 같은 고정 문구를 쓴다
const OUTAGE_MESSAGE = "Unable to connect to the server.";
const UNKNOWN: Health = { serviceStatus: "unknown", message: OUTAGE_MESSAGE, announcements: [] };
// 평소 공지는 잠시 보이고 닫힌다. 서버에 연결할 수 없을 때는 공지가 장애 안내를 대신하므로 닫을 때까지 둔다
const NOTICE_MS = 8000;

// 이 앱의 테마 변수(ui/theme.css)를 쓰므로 밝은 테마에서도 맞는 색이 된다
const THEME: Record<Toast["kind"], CSSProperties> = {
  notice: { background: "var(--sumi-750)", color: "var(--text)", border: "1px solid var(--line)" },
  status: { background: "var(--sumi-750)", color: "var(--text)", border: "1px solid var(--kaki)" },
};

// 개발자 옵션 미리보기용 예시. 메인 사이트와 같은 문구를 쓴다
const SAMPLE_NOTICES: Announcement[] = [
  { id: "preview-notice-1", title: "예시 공지: 오늘 밤 11시부터 30분간 점검합니다" },
  { id: "preview-notice-2", title: "예시 공지: 공지가 여러 개면 위에서부터 차례로 쌓입니다" },
];
const PREVIEW_HEALTH: Record<NoticePreview, Health> = {
  notice: { serviceStatus: "operational", message: "", announcements: SAMPLE_NOTICES.slice(0, 1) },
  outage: { serviceStatus: "unavailable", message: OUTAGE_MESSAGE, announcements: [] },
  all: { serviceStatus: "unavailable", message: OUTAGE_MESSAGE, announcements: SAMPLE_NOTICES },
};

function toastsFor(health: Health): Toast[] {
  const down = health.serviceStatus !== "operational";
  const notices = health.announcements.map(n => ({ id: n.id, kind: "notice" as const, title: n.title, sticky: down }));
  // 공지가 있으면 장애 문구 대신 공지를 보여준다. 점검 같은 예정된 중단은 공지로 미리 알리기 때문이다
  if (notices.length) return notices;
  return down ? [{ id: `status-${health.serviceStatus}`, kind: "status", title: health.message || OUTAGE_MESSAGE, sticky: true }] : [];
}

const KEYFRAMES = `@keyframes jace-s-toast-in { from { opacity: 0; transform: translateY(-120%); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .jace-s-toast { animation: none !important; } }`;

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  // 부모가 다시 그려져도 자동 닫힘 시간이 처음부터 다시 세어지지 않게 한다
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (toast.sticky) return;
    const timer = window.setTimeout(() => close.current(), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [toast.sticky]);
  return (
    <div className="jace-s-toast" role={toast.kind === "status" ? "alert" : "status"} style={{ pointerEvents: "auto", display: "flex", gap: "0.5rem", alignItems: "flex-start", padding: "0.75rem 1rem",
      borderRadius: "0.5rem", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)", overflowWrap: "anywhere", animation: "jace-s-toast-in 0.3s ease-out", ...THEME[toast.kind] }}>
      <strong style={{ flex: 1, minWidth: 0 }}>{toast.title}</strong>
      <button type="button" aria-label="공지 닫기" onClick={onClose} style={{ background: "none", border: 0, fontSize: "1.25rem", lineHeight: 1, cursor: "pointer", color: "inherit" }}>×</button>
    </div>
  );
}

/**
 * 진입할 때 /health와 /notices를 한 번씩 불러 공지 제목을 화면 위에서 내려오는 토스트로 보여준다.
 * 서버에 연결할 수 없을 때는 공지가 있으면 공지를, 없으면 고정 장애 문구를 보여준다.
 * appId는 jace-s apps 테이블의 이 앱 ID다(빌드 시 VITE_JPC_NOTICE_APP_ID). 비어 있으면 모든 앱 대상 공지만 받는다.
 * 호스팅 모드에서만 쓴다. API 주소(api.jace-s.com)의 /health와 /notices를 부른다.
 * 개발자 옵션의 미리보기가 켜져 있으면 서버 응답 대신 예시 문구를 보여준다.
 */
export default function ServiceNotices({ appId = null }: { appId?: number | null }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [preview, setPreview] = useState(readNoticePreview);
  const [closed, setClosed] = useState<string[]>([]);
  // 같은 미리보기를 다시 눌러도 토스트가 새로 내려오도록 key에 붙인다
  const [round, setRound] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    const request = (path: string) => fetch(apiOriginUrl(path), { credentials: "omit", cache: "no-store", signal: controller.signal });
    // /health가 200이 아니거나 응답이 없으면 서버에 연결할 수 없는 것으로 본다
    const reachable = request("/health").then(response => response.ok, () => false);
    // 공지는 서버가 꺼져 있어도 Cloudflare Worker가 답한다. 받지 못하면 공지 없이 상태만 보여준다
    const announcements = request(appId ? `/notices?app=${appId}` : "/notices")
      .then(response => response.ok ? response.json() : null)
      .then((body: { schemaVersion?: number; announcements?: Announcement[] } | null) => body?.schemaVersion === 1 && Array.isArray(body.announcements)
        ? body.announcements.filter(n => n && typeof n.id === "string" && typeof n.title === "string").map(n => ({ id: n.id, title: n.title })) : [])
      .catch(() => [] as Announcement[]);
    Promise.all([reachable, announcements])
      .then(([up, list]) => { if (!cancelled) setHealth(up ? { serviceStatus: "operational", message: "", announcements: list } : { ...UNKNOWN, announcements: list }); })
      .finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [appId]);
  useEffect(() => {
    const update = () => { setPreview(readNoticePreview()); setClosed([]); setRound(r => r + 1); };
    const onStorage = (event: StorageEvent) => { if (event.key === NOTICE_PREVIEW_KEY || event.key === null) update(); };
    window.addEventListener(NOTICE_PREVIEW_EVENT, update);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(NOTICE_PREVIEW_EVENT, update); window.removeEventListener("storage", onStorage); };
  }, []);
  const shown = preview ? PREVIEW_HEALTH[preview] : health;
  const toasts = shown ? toastsFor(shown).filter(t => !closed.includes(t.id)) : [];
  if (!toasts.length) return null;
  // 각 화면의 고정 버튼과 겹치지 않도록 가운데 좁은 폭으로 띄우고, 토스트 밖은 클릭이 통과한다
  return (
    <section aria-label="서비스 공지" style={{ position: "fixed", top: "0.75rem", left: "50%", transform: "translateX(-50%)", zIndex: 1000, width: "min(32rem, calc(100% - 1.5rem))",
      maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", pointerEvents: "none" }}>
      <style>{KEYFRAMES}</style>
      {toasts.map(toast => <ToastItem key={`${round}-${toast.id}`} toast={toast} onClose={() => setClosed(ids => [...ids, toast.id])} />)}
    </section>
  );
}
