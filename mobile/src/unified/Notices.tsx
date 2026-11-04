import React, { useContext, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { API_ORIGIN, NOTICE_APP_ID } from "./config";
import { Theme } from "./ui";
import { useNoticePreview } from "./useNoticePreview";
type Notice = { id: string; title: string };
const outage = { id: "outage", title: "Unable to connect to the server." };
/** Read public notices independently from origin health; announcements take precedence during outages. */
export async function loadNotices(send: typeof fetch = fetch) {
  const request = (path: string) => send(API_ORIGIN + path, { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(10000) });
  const [up, notices] = await Promise.all([
    request("/health").then((response) => response.ok, () => false),
    request(`/notices?app=${NOTICE_APP_ID}`).then((response) => response.ok ? response.json() : null).then((body) => body?.schemaVersion === 1 && Array.isArray(body.announcements) ? body.announcements.filter((entry: any) => entry && typeof entry.id === "string" && typeof entry.title === "string").map(({ id, title }: Notice) => ({ id, title })) : []).catch(() => []),
  ]);
  return { up, notices: notices as Notice[] };
}
function NoticeItem({ notice, sticky, onClose }: { notice: Notice; sticky: boolean; onClose: () => void }) {
  const c = useContext(Theme);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => { if (sticky) return; const timer = setTimeout(() => close.current(), 8000); return () => clearTimeout(timer); }, [sticky]);
  return <View accessibilityRole={sticky ? "alert" : "summary"} style={{ flexDirection: "row", gap: 8, padding: 12, backgroundColor: c.panel, borderColor: c.accent, borderWidth: 1, borderRadius: 10 }}><Text style={{ flex: 1, color: c.text }}>{notice.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="공지 닫기" onPress={onClose}><Text style={{ color: c.text }}>×</Text></Pressable></View>;
}
/** Shared notice UI retains timed normal notices, persistent outages and browser previews. */
export function Notices() {
  const [state, setState] = useState<{ up: boolean; notices: Notice[] } | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const preview = useNoticePreview();
  useEffect(() => { let active = true; void loadNotices().then((value) => active && setState(value)); return () => { active = false; }; }, []);
  useEffect(() => { setClosed([]); }, [preview]);
  const current = preview ? { up: preview === "notice", notices: preview === "outage" ? [] : [{ id: "preview-notice-1", title: "예시 공지: 오늘 밤 11시부터 30분간 점검합니다" }, ...(preview === "all" ? [{ id: "preview-notice-2", title: "예시 공지: 공지가 여러 개면 위에서부터 차례로 쌓입니다" }] : [])] } : state;
  const entries = current?.notices.length ? current.notices : current && !current.up ? [outage] : [];
  return <View style={{ gap: 8 }}>{entries.filter((entry) => !closed.includes(entry.id)).map((notice) => <NoticeItem key={`${preview}:${notice.id}`} notice={notice} sticky={!current?.up} onClose={() => setClosed((list) => [...list, notice.id])} />)}</View>;
}
