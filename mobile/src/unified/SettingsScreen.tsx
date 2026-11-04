import React, { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { User } from "../client";
import type { StudyModel } from "./useStudyModel";
import { client, clearState } from "./runtime";
import { confirmAction } from "./platform";
import { Action, Card, Field, Label, layout } from "./ui";
import { SITE_ORIGIN } from "./config";

export type Display = { theme: "dark" | "light"; device: "auto" | "phone" | "pc" };
/** Shared account, scheduling, display, backup and source-write retry settings. */
export function SettingsScreen({ model, display, setDisplay, notify, onLogout, onReset }: { model: StudyModel; display: Display; setDisplay: (next: Display) => void; notify: (text: string, tone?: string) => void; onLogout: () => Promise<void>; onReset: () => void }) {
  const [account, setAccount] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(String(model.srs.failureRetryDays));
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
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.body}>
    <Label large>설정</Label>
    <Card title="계정">{account ? rows.map(([name, value]) => <View key={name} style={{ gap: 2 }}><Label muted>{name}</Label><Label>{value}</Label></View>) : <Label muted>계정 정보를 불러오는 중</Label>}
      <Action title="메인 사이트에서 계정 관리" onPress={() => void Linking.openURL(SITE_ORIGIN + "/#my-page")} />
      <Action title={busy ? "처리 중" : "로그아웃"} disabled={busy} onPress={() => void run(onLogout)} testID="logout" />
      {Platform.OS === "web" && <Label muted>같은 브라우저의 다른 jace-s 앱과 메인 사이트도 함께 로그아웃됩니다.</Label>}
    </Card>
    {!!error && <Label error>{error}</Label>}
    <Card title="화면"><Label>레이아웃 모드</Label><View style={layout.row}>{(["auto", "phone", "pc"] as const).map((device) => <Action key={device} title={device === "auto" ? "자동" : device === "phone" ? "폰" : "PC"} selected={display.device === device} onPress={() => setDisplay({ ...display, device })} />)}</View><View style={layout.row}><Action title="다크 모드" selected={display.theme === "dark"} onPress={() => setDisplay({ ...display, theme: "dark" })} /><Action title="라이트 모드" selected={display.theme === "light"} onPress={() => setDisplay({ ...display, theme: "light" })} /></View></Card>
    <Card title="학습"><Label>하루 신규 학습</Label><View style={layout.row}>{[1, 2, 3, 4, 5].map((value) => <Action key={value} title={`${value}개`} selected={model.state.dailyNewLearningCount === value} onPress={() => model.updateDaily(String(value))} />)}</View></Card>
    <Card title="복습 설정"><Label>최종 복습 단계</Label><View style={layout.row}>{[2, 3, 4, 5, 6].map((value) => <Action key={value} title={`${value}단계`} selected={model.srs.maxReviewStage === value} onPress={() => model.updateSrs({ maxReviewStage: value })} />)}</View><Field label="틀린 문제 재복습 간격 1–30일" value={retry} onChangeText={setRetry} /><Action title="복습 간격 저장" disabled={!Number.isInteger(Number(retry)) || Number(retry) < 1 || Number(retry) > 30} onPress={() => model.updateSrs({ failureRetryDays: Number(retry) })} /><Label muted>성공 시 복습 간격은 기존 1, 3, 7, 30일을 유지합니다.</Label></Card>
    <Card title="데이터"><View style={layout.row}><Action title="에셋 백업" disabled={busy} onPress={() => void run(() => backup(false))} /><Action title="에셋 복구" disabled={busy} onPress={() => void run(() => backup(true))} /><Action title="로컬 캐시 초기화" disabled={busy || model.queue.items.length > 0} onPress={() => void run(async () => { if (await confirmAction("이 계정과 책의 로컬 캐시를 지우고 서버에서 다시 불러올까요?")) { await clearState(model.book); onReset(); } })} /></View></Card>
    <Card title={`전송 큐 ${model.queue.items.length}건`}>
      {!model.queue.isPersistent && <Label error>영속 저장소를 사용할 수 없어 앱을 닫으면 대기 중인 전송이 사라질 수 있습니다.</Label>}
      {model.queue.items.length === 0 && <Label muted>대기 중인 전송이 없습니다.</Label>}
      {model.queue.items.map((entry: any) => <View key={entry.id} style={{ gap: 6 }}><Label>{entry.label}</Label><Label muted>{entry.status === "failed" ? "실패" : entry.status === "retrying" ? "재시도 대기" : "전송 대기"} · 재시도 {entry.retryCount}회{entry.nextAttemptAt ? ` · 다음 ${new Date(entry.nextAttemptAt).toLocaleTimeString()}` : ""}</Label>{entry.lastError && <Label error>{entry.lastError}</Label>}{entry.status === "failed" && <View style={layout.row}><Action title="재전송" onPress={() => void run(() => model.queue.retryItem(entry.id))} /><Action title="삭제" onPress={() => void run(async () => { if (await confirmAction("이 실패한 전송을 삭제할까요?")) await model.queue.discardItem(entry.id); })} /></View>}</View>)}
      {model.queue.items.some((entry: any) => entry.status === "failed") && <Action title="실패 항목 모두 삭제" onPress={() => void run(async () => { if (await confirmAction("실패한 전송을 모두 삭제할까요?")) await model.queue.discardFailed(); })} />}
    </Card>
    <Card title="디버깅 로그"><Action title="디버깅 로그 복사" onPress={() => void run(async () => { await Clipboard.setStringAsync([...model.dashboard.debugLogs, ...model.dashboard.homeDueDebug.filter((row: any) => row.dayLevelDue).slice(0, 20).map((row: any) => JSON.stringify(row))].join("\n")); notify("디버깅 로그 복사 완료"); })} />{model.dashboard.debugLogs.map((text: string, index: number) => <Label key={index} muted>{text}</Label>)}</Card>
  </ScrollView>;
}
