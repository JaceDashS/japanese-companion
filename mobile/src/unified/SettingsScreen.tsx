import React, { useContext, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { User } from "../client";
import type { StudyModel } from "./useStudyModel";
import { client, clearState } from "./runtime";
import { confirmAction } from "./platform";
import { Btn, Card, Input, Label, layout, Segment, T, Theme } from "./ui";
import { SITE_ORIGIN } from "./config";

export type Display = { theme: "dark" | "light"; device: "auto" | "phone" | "pc" };
/** Shared account, scheduling, display, backup and source-write retry settings. */
export function SettingsScreen({ model, display, setDisplay, notify, onLogout, onReset, phone }: { phone: boolean; model: StudyModel; display: Display; setDisplay: (next: Display) => void; notify: (text: string, tone?: string) => void; onLogout: () => Promise<void>; onReset: () => void }) {
  const [account, setAccount] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(String(model.srs.failureRetryDays));
  const [debug, setDebug] = useState(false);
  const c = useContext(Theme);
  const run = async (work: () => Promise<unknown>) => { if (busy) return; setBusy(true); setError(""); try { await work(); } catch (cause) { setError(String(cause)); } finally { setBusy(false); } };
  useEffect(() => { let active = true; client.account().then((value) => active && setAccount(value)).catch((cause) => active && setError(String(cause))); return () => { active = false; }; }, []);
  const time = (value?: string | null) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "없음";
  const backup = async (restore: boolean) => {
    if (!account || !await confirmAction(restore ? "백업 파일로 전체 학습 데이터를 복구할까요? 현재 데이터가 덮어써질 수 있습니다." : "전체 학습 데이터를 백업할까요?")) return;
    if (restore) {
      await client.post("asset-backup/import", {}, account.id);
      await model.refresh(); notify("에셋 복구 완료"); return;
    }
    const attempt = async (force: boolean) => client.fetch(new URL("/companions/japanese/asset-backup/export", client.baseUrl), { method: "POST", headers: { "x-companion-user": account.id }, body: JSON.stringify({ force }) });
    let result = await attempt(false);
    if (result.status === 409) {
      const warning = await result.json();
      if (!await confirmAction(`모지바케 ${warning.findingCount ?? warning.findings?.length ?? 0}건이 감지되었습니다.\n${(warning.findings ?? []).slice(0, 5).join("\n")}\n포함한 상태로 백업을 계속할까요?`)) return;
      result = await attempt(true);
    }
    if (!result.ok) throw new Error("에셋 백업 실패");
    const data = await result.json(); notify(`에셋 백업 완료: ${data.backupFile ?? ""}${data.mojibakeIncluded ? ` (모지바케 ${data.mojibakeCount ?? 0}건 포함)` : ""}`);
  };
  const rows: Array<[string, string]> = account ? [
    ["이름", account.displayName || account.name || "없음"], ["아이디", account.username],
    ["이메일", account.email ? `${account.email} (${account.emailVerified ? "인증됨" : "인증 전"})` : "없음"],
    ["로그인 방식", account.hasLocalPassword === false ? "Google 전용" : "아이디·비밀번호"],
    ["가입일", time(account.createdAt)], ["마지막 로그인", time(account.lastLoginAt)],
  ] : [];
  const queueLabel = (status: string) => status === "failed" ? "실패" : status === "retrying" ? "재시도 대기" : "전송 대기";
  const failed = model.queue.items.filter((entry: any) => entry.status === "failed").length;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={phone ? layout.phoneBody : layout.body}>
    <Card title="계정">
      {account ? <View style={{ gap: 6, marginBottom: 2 }}>{rows.map(([name, value]) => <View key={name} style={{ flexDirection: "row", gap: 16 }}><T size={13.1} tone="muted" style={{ width: 84, lineHeight: 24 }}>{name}</T><T size={16} selectable style={{ flex: 1 }}>{value}</T></View>)}</View>
        : <T size={13.1} tone="muted">{error ? "계정 정보를 불러오지 못했습니다." : "계정 정보를 불러오는 중"}</T>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn title="메인 사이트에서 계정 관리" style={{ flex: 1 }} onPress={() => void Linking.openURL(SITE_ORIGIN + "/#my-page")} />
        <Btn variant="danger" title={busy ? "처리 중" : "로그아웃"} disabled={busy} style={{ flex: 1 }} onPress={() => void run(onLogout)} testID="logout" />
      </View>
      {Platform.OS === "web" && <T size={13.1} tone="muted">같은 브라우저의 다른 jace-s 앱과 메인 사이트도 함께 로그아웃됩니다.</T>}
    </Card>
    {!!error && <Label error>{error}</Label>}
    <Card title="화면">
      <View style={{ gap: 14 }}>
        <Row title="레이아웃 모드" hint={`자동은 현재 ${phone ? "폰" : "PC"}으로 인식 중`}><Segment options={[{ key: "auto", label: "자동" }, { key: "phone", label: "폰" }, { key: "pc", label: "PC" }]} value={display.device} onChange={(device) => setDisplay({ ...display, device })} /></Row>
        <Row title="테마"><Segment options={[{ key: "dark", label: "다크 모드" }, { key: "light", label: "라이트 모드" }]} value={display.theme} onChange={(theme) => setDisplay({ ...display, theme })} /></Row>
      </View>
    </Card>
    <Card title="학습"><Row title="하루 신규 학습"><Segment options={[1, 2, 3, 4, 5].map((value) => ({ key: value, label: `${value}개` }))} value={model.state.dailyNewLearningCount ?? 1} onChange={(value) => model.updateDaily(String(value))} /></Row></Card>
    <Card title="복습 설정" hint="현재 값이 기본값입니다">
      <View style={{ gap: 14 }}>
        <Row title="최종 복습 단계" hint="Day가 졸업하는 단계"><Segment options={[2, 3, 4, 5, 6].map((value) => ({ key: value, label: `${value}단계` }))} value={model.srs.maxReviewStage} onChange={(value) => model.updateSrs({ maxReviewStage: value })} /></Row>
        <Row title="틀린 문제 재복습" hint="실패한 Day가 다시 나오는 날수 (1–30)">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Input label="재복습 간격" value={retry} onChangeText={setRetry} style={{ width: 76 }} onBlur={() => { const value = Number(retry); if (Number.isInteger(value) && value >= 1 && value <= 30) model.updateSrs({ failureRetryDays: value }); else setRetry(String(model.srs.failureRetryDays)); }} />
            <T size={13.8}>일</T>
          </View>
        </Row>
      </View>
      <T size={12.2} tone="dim">성공 시 복습 간격은 기존 1, 3, 7, 30일을 유지합니다.</T>
    </Card>
    <Card title="데이터">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Btn title="에셋 백업" disabled={busy} style={{ flexBasis: "47%", flexGrow: 1 }} onPress={() => void run(() => backup(false))} />
        <Btn title="에셋 복구" disabled={busy} style={{ flexBasis: "47%", flexGrow: 1 }} onPress={() => void run(() => backup(true))} />
        <Btn variant="danger" title="로컬 캐시 초기화" disabled={busy || model.queue.items.length > 0} style={{ flexBasis: "47%", flexGrow: 1 }} onPress={() => void run(async () => { if (await confirmAction("이 계정과 책의 로컬 캐시를 지우고 서버에서 다시 불러올까요?")) { await clearState(model.book); onReset(); } })} />
      </View>
    </Card>
    <Card title="전송 큐" hint={`${model.queue.items.length}건`}>
      {!model.queue.isPersistent && <View style={{ padding: 10, borderWidth: 1, borderColor: c.accentLine, borderRadius: 7, backgroundColor: c.soft }}><T size={12.5} style={{ color: c.accentStrong }}>이 기기에서는 영속 저장을 사용할 수 없어 앱을 닫으면 대기 중인 전송이 사라질 수 있습니다.</T></View>}
      {model.queue.items.length === 0 ? <T size={12.2} tone="dim">대기 중인 전송이 없습니다.</T> : <View style={{ gap: 8 }}>{model.queue.items.map((entry: any) => <View key={entry.id} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: c.borderSoft, borderRadius: 11, backgroundColor: c.raised }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}><T size={13.1} weight="700" numberOfLines={1}>{entry.label}</T><View style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: entry.status === "failed" ? c.accentLine : c.border }}><T size={11.2} style={{ color: entry.status === "failed" ? c.accent : c.muted, lineHeight: 15 }}>{queueLabel(entry.status)}</T></View></View>
          <T size={11.5} tone="dim">{entry.retryCount > 0 ? `재시도 ${entry.retryCount}회` : "첫 전송"}{entry.nextAttemptAt ? ` / 다음 시도 ${new Date(entry.nextAttemptAt).toLocaleTimeString()}` : ""}</T>
          {entry.lastError && <T size={11.5} tone="accent">{entry.lastError}</T>}
        </View>
        {entry.status === "failed" && <View style={{ flexDirection: "row", gap: 6 }}><Btn variant="ghost" title="재전송" onPress={() => void run(() => model.queue.retryItem(entry.id))} /><Btn variant="ghost" title="삭제" onPress={() => void run(async () => { if (await confirmAction("이 실패한 전송을 삭제할까요?")) await model.queue.discardItem(entry.id); })} /></View>}
      </View>)}</View>}
      {failed > 0 && <View style={{ flexDirection: "row" }}><Btn variant="ghost" title={`실패 항목 모두 삭제 (${failed})`} onPress={() => void run(async () => { if (await confirmAction("실패한 전송을 모두 삭제할까요?")) await model.queue.discardFailed(); })} /></View>}
    </Card>
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: debug }} onPress={() => setDebug(!debug)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16 }}>
        <T size={13.8} weight="600" tone="muted">{debug ? "▾" : "▸"} 디버깅 로그</T><View style={{ flex: 1 }} />
        <Btn variant="ghost" title="복사" onPress={() => void run(async () => { await Clipboard.setStringAsync([...model.dashboard.debugLogs, ...model.dashboard.homeDueDebug.filter((row: any) => row.dayLevelDue).slice(0, 20).map((row: any) => JSON.stringify(row))].join("\n")); notify("디버깅 로그 복사 완료"); })} />
      </Pressable>
      {debug && <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 4 }}>{model.dashboard.debugLogs.map((text: string, index: number) => <T key={index} size={11.5} mono tone="dim">{text}</T>)}</View>}
    </View>
  </ScrollView>;
}

/** Former settings row: a label with an optional hint on the left and its control on the right. */
function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <View style={{ flexShrink: 1 }}><T size={13.8}>{title}</T>{hint ? <T size={12.2} tone="dim">{hint}</T> : null}</View>{children}
  </View>;
}
