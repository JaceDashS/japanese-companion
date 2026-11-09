import React, { useContext, useEffect, useRef, useState } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import * as Clipboard from "expo-clipboard";
import { toLearningPathKey } from "../../.generated/product/shared/controllers/domain/learningPath.js";
import { getStageLabel } from "../../.generated/product/shared/domain/constants.js";
import type { LearningPath } from "../../../shared/domain/studyTypes";
import { Btn, Chip, Empty, gradient, Input, Meter, Spinner, T, Theme, type Palette } from "./ui";

type Accent = "accent" | "good" | "info" | "warn";
/** Former summary tile with a colored left stripe and a monospace value. */
export function Stats({ items, phone }: { phone: boolean; items: { label: string; value: string; hint: string; accent: Accent }[] }) {
  const c = useContext(Theme);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
    {items.map(item => <View key={item.label} style={{ flexBasis: phone ? "47%" : "22%", flexGrow: 1, minWidth: 0, gap: 3, paddingVertical: 13, paddingRight: 15, paddingLeft: 17, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c[item.accent] }} />
      <T size={11.7} tone="dim" weight="600">{item.label}</T>
      <T size={24} mono weight="700" style={{ letterSpacing: -0.5, lineHeight: 32 }}>{item.value}</T>
      <T size={11.5} tone="muted">{item.hint}</T>
    </View>)}
  </View>;
}

/** Vertical stage bars; the active bars use the sakura gradient. */
export function StageChart({ stages }: { stages: { label: string; count: number }[] }) {
  const c = useContext(Theme);
  const maximum = Math.max(1, ...stages.map(item => item.count));
  return <View style={{ flexDirection: "row", gap: 8, height: 132, alignItems: "flex-end" }}>
    {stages.map(item => <View key={item.label} accessibilityLabel={`${item.label} ${item.count}개`} style={{ flex: 1, height: "100%", gap: 5, alignItems: "center" }}>
      <T size={12} mono tone="muted">{item.count}</T>
      <View style={{ flex: 1, width: "100%", maxWidth: 34, borderRadius: 6, backgroundColor: c.raised, justifyContent: "flex-end", overflow: "hidden" }}>
        <View style={[{ height: `${Math.round(item.count / maximum * 100)}%`, minHeight: 3, borderRadius: 6, backgroundColor: item.count ? c.accent : c.border }, item.count ? gradient(`linear-gradient(180deg, ${c.accentStrong}, ${c.accent})`) : null]} />
      </View>
      <T size={11.2} tone="dim">{item.label}</T>
    </View>)}
  </View>;
}

function relative(date: string, today: string) {
  if (date === today) return "오늘";
  const [fy, fm, fd] = date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
  return diff === 1 ? "어제" : diff > 1 ? `${diff}일 전` : date;
}
function useHover() {
  const [hover, setHover] = useState(false);
  return { hover, bind: { onHoverIn: () => setHover(true), onHoverOut: () => setHover(false) } };
}

export function RecentDays({ rows, today, maxStage, onOpen }: { rows: any[]; today: string; maxStage: number; onOpen: (path: LearningPath) => void }) {
  const recent = rows.filter(row => row.lastAttemptDate).sort((a, b) => String(b.lastAttemptDate).localeCompare(String(a.lastAttemptDate))).slice(0, 5);
  if (!recent.length) return <Empty>아직 학습 기록이 없습니다.</Empty>;
  return <View style={{ gap: 6 }}>{recent.map(row => <RecentRow key={toLearningPathKey(row.path)} row={row} today={today} maxStage={maxStage} onOpen={onOpen} />)}</View>;
}
function RecentRow({ row, today, maxStage, onOpen }: { row: any; today: string; maxStage: number; onOpen: (path: LearningPath) => void }) {
  const c = useContext(Theme);
  const { hover, bind } = useHover();
  return <Pressable accessibilityRole="button" onPress={() => onOpen(row.path)} {...bind} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: hover ? c.accentLine : c.borderSoft, borderRadius: 11, backgroundColor: c.raised }}>
    <View style={{ flex: 1, minWidth: 0 }}><T size={13.8} weight="600">{row.dayTitle}</T><T size={11.5} tone="dim">{relative(row.lastAttemptDate, today)} · 정답률 {Math.round(row.passRatio * 100)}%</T></View>
    <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border }}><T size={11.5} mono tone="muted">{getStageLabel(row.stage, maxStage)}</T></View>
  </Pressable>;
}

/** Day search with a pass-ratio fill behind every tile. */
export function DayGrid({ rows, phone, onOpen }: { rows: any[]; phone: boolean; onOpen: (path: LearningPath) => void }) {
  const [query, setQuery] = useState("");
  const [onlyFail, setOnlyFail] = useState(false);
  const [width, setWidth] = useState(0);
  const keyword = query.trim();
  const shown = rows.filter(row => (!onlyFail || row.failCount > 0) && (!keyword || row.dayTitle.includes(keyword)));
  const minimum = phone ? 128 : 148;
  const columns = Math.max(1, Math.floor((width + 8) / (minimum + 8)));
  const tileWidth = width ? (width - (columns - 1) * 8) / columns : minimum;
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <View style={{ flex: 1, minWidth: 140 }}><Input label="Day 검색" placeholder="Day 검색" value={query} onChangeText={setQuery} /></View>
      <Btn title="오답만" variant={onlyFail ? "danger" : "default"} onPress={() => setOnlyFail(!onlyFail)} />
    </View>
    {!shown.length ? <Empty>조건에 맞는 Day가 없습니다.</Empty> : <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {shown.map(row => <DayTile key={toLearningPathKey(row.path)} row={row} width={tileWidth} onOpen={onOpen} />)}
    </View>}
  </View>;
}
function DayTile({ row, width, onOpen }: { row: any; width: number; onOpen: (path: LearningPath) => void }) {
  const c = useContext(Theme);
  const { hover, bind } = useHover();
  const percent = Math.max(0, Math.min(100, Math.round(row.passRatio * 100)));
  return <Pressable accessibilityRole="button" accessibilityLabel={`${row.dayTitle} 학습`} onPress={() => onOpen(row.path)} {...bind} style={{ width, gap: 6, paddingVertical: 10, paddingHorizontal: 11, borderWidth: 1, borderColor: hover ? c.accentLine : c.border, borderRadius: 11, backgroundColor: c.raised, overflow: "hidden" }}>
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${percent}%`, backgroundColor: c.soft }} />
    <T size={13.1} weight="600">{row.dayTitle}</T>
    <T size={11.4} tone="dim">{row.failCount > 0 ? `오답 ${row.failCount}` : `정답률 ${percent}%`}</T>
  </Pressable>;
}

export function ProgressPanel({ d, srsMax, plan, onPlan }: { d: any; srsMax: number; plan: { start: string; end: string }; onPlan: (next: { start: string; end: string }) => void }) {
  return <View style={{ gap: 16 }}>
    <Meter label="Day 완료" value={`${d.overallMeta.completedDays}/${d.overallMeta.uniqueDayTotal}`} ratio={d.overallMeta.completedRatio} />
    <Meter label="평균 복습 회차" value={`${(1 + d.overallMeta.avgStageRatio * (srsMax - 1)).toFixed(2)} / ${srsMax}`} ratio={d.overallMeta.avgStageRatio} tone="info" />
    <T size={12.2} tone="dim">데이터상 최대 Day 인덱스 {d.overallMeta.maxDayIndex || 0}</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <View style={{ flex: 1, minWidth: 132, gap: 6 }}><T size={13.1} tone="muted" weight="600">시작일</T><Input label="시작일" placeholder="YYYY-MM-DD" value={plan.start} onChangeText={(start) => onPlan({ ...plan, start })} /></View>
      <View style={{ flex: 1, minWidth: 132, gap: 6 }}><T size={13.1} tone="muted" weight="600">종료일</T><Input label="종료일" placeholder="YYYY-MM-DD" value={plan.end} onChangeText={(end) => onPlan({ ...plan, end })} /></View>
    </View>
    {d.dateRangeMeta.valid ? <Meter label="기간 경과" value={`${d.dateRangeMeta.elapsedDays}/${d.dateRangeMeta.totalDays}일 · 남은 ${d.dateRangeMeta.remainingDays}일`} ratio={d.dateRangeMeta.ratio} />
      : <T size={13.1} tone="muted">기간 형식이 올바르지 않거나 종료일이 시작일보다 빠릅니다.</T>}
  </View>;
}

const tint = (c: Palette, soft: string): ViewStyle => gradient(`linear-gradient(150deg, ${soft}, ${c.panel} 60%)`);
/** Queue Day card: blue review tint or green learning tint with a status chip. */
export function DayCard({ title, chip, chipTone, meta, tone, onPress }: { title: string; chip: string; chipTone: "review" | "learning" | "fail"; meta: string[]; tone: "review" | "learning"; onPress: () => void }) {
  const c = useContext(Theme);
  const { hover, bind } = useHover();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${chip}`} onPress={onPress} {...bind}
    style={[{ gap: 9, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: hover ? c.accentLine : c.border, borderRadius: 16, backgroundColor: c.panel, transform: [{ translateY: hover ? -1 : 0 }] }, tint(c, tone === "review" ? c.infoSoft : c.goodSoft)]}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><T size={15.4} weight="700">{title}</T><Chip tone={chipTone}>{chip}</Chip></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>{meta.map(text => <T key={text} size={12.5} tone="muted">{text}</T>)}</View>
  </Pressable>;
}

export function ActionTile({ title, hint, done = false, pending = false, disabled = false, onPress, danger = false }: { title: string; hint: string; done?: boolean; pending?: boolean; disabled?: boolean; danger?: boolean; onPress: () => void }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled, busy: pending }} disabled={disabled} onPress={onPress}
    style={{ flexBasis: "47%", flexGrow: 1, gap: 3, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: done ? c.goodLine : c.border, borderRadius: 11, backgroundColor: done ? c.goodSoft : c.raised, opacity: disabled ? 0.55 : 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{pending && <Spinner />}<T size={13.8} weight="700" style={danger ? { color: c.accent } : undefined}>{title}</T></View>
    <T size={11.5} tone="dim" style={{ lineHeight: 17 }}>{hint}</T>
  </Pressable>;
}

/** Days with missing decompositions keep the former copy and input actions in the queue. */
export function WordActionCard({ title, chip, chipTone, missing, total, mode, copy, importText, notify }: {
  title: string; chip: string; chipTone: "review" | "learning" | "fail"; missing: number; total: number; mode: string;
  copy: () => string; importText: (text: string) => Promise<boolean>; notify: (text: string, tone?: string) => void;
}) {
  const c = useContext(Theme);
  const [pending, setPending] = useState<"copy" | "input" | null>(null);
  const [done, setDone] = useState({ copy: false, input: false });
  const [paste, setPaste] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const run = async (kind: "copy" | "input", work: () => Promise<boolean>) => {
    setPending(kind);
    try {
      if (await work()) { setDone((previous) => ({ ...previous, [kind]: true })); if (kind === "input") { setPaste(null); timer.current = setTimeout(() => setDone((previous) => ({ ...previous, input: false })), 1000); } }
    } catch (error) { notify(String(error), "error"); } finally { setPending(null); }
  };
  const fromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.trim() && await importText(text)) return true;
    setPaste(""); return false;
  };
  return <View style={[{ gap: 11, paddingVertical: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: c.warnSoft, borderRadius: 16, backgroundColor: c.panel }, tint(c, c.warnSoft)]}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><T size={15.4} weight="700">{title}</T><Chip tone={chipTone}>{chip}</Chip></View>
    <T size={12.2} tone="dim">디컴포지션 미입력 {missing}개 / 전체 {total}개 — {mode} 전에 채워 주세요.</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <ActionTile title={pending === "copy" ? "복사 중" : done.copy ? "복사됨" : "단어 복사"} hint="학습 단어 JSON을 클립보드로" done={done.copy} pending={pending === "copy"} disabled={!!pending}
        onPress={() => void run("copy", async () => { await Clipboard.setStringAsync(copy()); return true; })} />
      <ActionTile title={pending === "input" ? "입력 중" : done.input ? "입력됨" : "디컴포지션 입력"} hint="클립보드 JSON을 반영" done={done.input} pending={pending === "input"} disabled={!!pending}
        onPress={() => void run("input", fromClipboard)} />
    </View>
    {paste !== null && <View style={{ gap: 10 }}>
      <T size={11.8} tone="dim" weight="600">{title} JSON 붙여넣기</T>
      <Input multiline label={`${title} JSON`} placeholder="여기에 Day JSON을 붙여넣으세요" value={paste} onChangeText={setPaste} />
      <View style={{ flexDirection: "row", gap: 8 }}><Btn variant="primary" title={pending === "input" ? "가져오는 중" : "가져오기"} disabled={pending === "input"} onPress={() => void run("input", () => importText(paste))} /><Btn title="닫기" onPress={() => setPaste(null)} /></View>
    </View>}
  </View>;
}
