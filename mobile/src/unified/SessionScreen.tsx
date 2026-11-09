import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { normalizeProblem } from "../../.generated/product/shared/controllers/domain/problem.js";
import type { StudyItem } from "../../../shared/domain/studyTypes";
import type { StudyModel } from "./useStudyModel";
import { StudyMarkdown } from "../StudyMarkdown";
import { useMainReturn } from "../useMainReturn";
import { client } from "./runtime";
import { Btn, Chip, CopyId, Empty, fonts, Input, MarkdownBox, MemoEditor, primaryFill, Segment, Sheet, Switch, T, Theme } from "./ui";
import { WordActions } from "./WordActions";
import { useSessionKeys } from "./useSessionKeys";

const markdown = (text: string) => <StudyMarkdown text={text} client={client} />;

function Furigana({ item, visible, size }: { item: StudyItem; visible: boolean; size: number }) {
  const c = useContext(Theme);
  const word = String(item.expression ?? "");
  const entries = Object.entries(item.kanjiToKana ?? {}).filter(([base, kana]) => base && kana).sort((a, b) => b[0].length - a[0].length);
  const parts: Array<{ base: string; reading: string }> = [];
  if (!entries.length) parts.push({ base: word, reading: item.reading ?? "" });
  else for (let index = 0; index < word.length;) {
    const match = entries.find(([base]) => word.startsWith(base, index));
    parts.push({ base: match?.[0] ?? word[index], reading: match?.[1] ?? "" });
    index += match?.[0].length ?? 1;
  }
  return <View accessibilityLabel={word + (visible && item.reading ? " " + item.reading : "")} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end" }}>
    {parts.map((part, index) => <View key={index} style={{ alignItems: "center" }}>
      <Text style={{ fontSize: size * 0.38, lineHeight: size * 0.5, color: c.accent, opacity: visible && part.reading ? 1 : 0, fontFamily: fonts.sans }}>{part.reading || " "}</Text>
      <Text selectable style={{ color: c.text, fontSize: size, lineHeight: size * 1.25, letterSpacing: size * 0.04, fontFamily: fonts.serif }}>{part.base}</Text>
    </View>)}
  </View>;
}
function Sentence({ text, target, size }: { text: string; target: string; size: number }) {
  const c = useContext(Theme);
  const index = target ? text.indexOf(target) : -1;
  return <View style={{ paddingVertical: 20, paddingHorizontal: 18, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel }}>
    <Text selectable style={{ fontSize: size, lineHeight: size * 2, color: c.text, fontFamily: fonts.serif }}>{index < 0 ? text : <>{text.slice(0, index)}<Text style={{ color: c.accent, textDecorationLine: "underline", textDecorationColor: c.accentLine }}>{target}</Text>{text.slice(index + target.length)}</>}</Text>
  </View>;
}
function Choice({ index, text, selected, phone, onPress }: { index: number; text: string; selected: boolean; phone: boolean; onPress: () => void }) {
  const c = useContext(Theme);
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${index + 1}번 ${text}`} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: phone ? 52 : undefined, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderRadius: 11, borderColor: selected ? c.accent : hover ? c.accentLine : c.border, backgroundColor: selected ? c.soft : c.panel }}>
    <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" }}><T size={12.2} mono tone="muted" style={{ lineHeight: 16 }}>{index + 1}</T></View>
    <T size={16} style={{ flex: 1 }}>{text}</T>
  </Pressable>;
}
function Verdict({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  const c = useContext(Theme);
  return <View accessibilityRole="alert" style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: pass ? c.goodLine : c.accentLine, backgroundColor: pass ? c.goodSoft : c.soft }}><T size={14.4} weight="600" style={{ color: pass ? c.good : c.accent }}>{children}</T></View>;
}
function WordCard({ children }: { children: React.ReactNode }) {
  const c = useContext(Theme);
  return <View style={{ alignItems: "center", gap: 12, paddingVertical: 22, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel }}>{children}</View>;
}
function ItemGrid({ items, current, onJump, onCopy, displayId }: { items: any[]; current?: string; onJump: (id: string) => void; onCopy: (id: string) => void; displayId: (item: any) => string }) {
  const c = useContext(Theme);
  const [width, setWidth] = useState(0);
  if (!items.length) return <Empty>항목이 없습니다.</Empty>;
  const columns = Math.max(1, Math.floor((width + 7) / (84 + 7)));
  const tile = width ? (width - (columns - 1) * 7) / columns : 84;
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === current }} accessibilityLabel={String(item.expression ?? "")} onPress={() => onJump(item.id)}
      style={{ width: tile, alignItems: "center", gap: 3, paddingVertical: 9, paddingHorizontal: 6, borderWidth: 1, borderRadius: 7, borderColor: item.id === current ? c.accent : c.border, backgroundColor: item.id === current ? c.soft : c.raised }}>
      <T size={20.5} serif numberOfLines={1}>{item.expression ?? ""}</T>
      <Pressable accessibilityRole="button" accessibilityLabel="ID 복사" onPress={() => onCopy(displayId(item))}><T size={9.9} mono tone="dim">{displayId(item)}</T></Pressable>
    </Pressable>)}
  </View>;
}

/** Study and quiz session in the former full-screen layout: top bar, split side panel on PC, sheets on phones and a bottom navigator. */
export function SessionScreen({ model, isPhone, notify }: { model: StudyModel; isPhone: boolean; notify: (text: string, tone?: string) => void }) {
  const c = useContext(Theme);
  const { width: viewport } = useWindowDimensions();
  const [reading, setReading] = useState(true);
  const [meaning, setMeaning] = useState(true);
  const [panel, setPanel] = useState<"items" | "notes" | null>("items");
  const [sheet, setSheet] = useState<"items" | "notes" | "words" | null>(null);
  const [width, setWidth] = useState(Number(model.state.studyDrawerWidth) || 340);
  const resizeOrigin = useRef(width);
  useEffect(() => { model.setSideWidth(width); }, [width]);
  const session = model.session!;
  const item = model.currentItem;
  const study = session.phase === "study";
  const quiz = session.phase === "quiz";
  const queued = model.queue.items.some((entry: any) => entry.status === "pending");
  const back = useMainReturn({ busy: queued, dirty: quiz && Object.keys(session.graded ?? {}).length > 0, onReturn: model.goHome });
  const toggleNotes = () => isPhone ? setSheet((previous) => previous === "notes" ? null : "notes") : setPanel((previous) => previous === "notes" ? "items" : "notes");
  useSessionKeys(model, toggleNotes, back);
  const resizer = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: () => { resizeOrigin.current = width; }, onPanResponderMove: (_, gesture) => setWidth(Math.max(260, Math.min(560, resizeOrigin.current - gesture.dx))) }), [width]);
  const copy = async (text: string) => { try { await Clipboard.setStringAsync(text); notify("복사 완료"); } catch (error) { notify(String(error), "error"); } };
  const dayItems = (model.sessionDay?.items ?? []).filter(Boolean);
  const jump = (id: string) => {
    const allIds = dayItems.map((value: any) => value.id);
    const index = model.sessionItems.findIndex((value: any) => value.id === id);
    model.setSession((previous) => previous && ({ ...previous, ...(index >= 0 ? { index } : { itemIds: allIds, index: Math.max(0, allIds.indexOf(id)) }) }));
    setSheet(null);
  };
  const togglePhase = () => {
    if (session.phase === "done") return;
    if (study) model.markDayAttemptNow({ unitId: session.unitId, dayId: session.dayId });
    model.setSession((previous) => previous && ({ ...previous, phase: previous.phase === "quiz" ? "study" : "quiz" }));
  };
  const notes = item ? <View style={{ gap: 10 }}>
    <T size={11.8} tone="dim" weight="600">내 메모</T><MarkdownBox text={String(item.memoPersonal ?? "")} placeholder="메모 없음" render={markdown} />
    <T size={11.8} tone="dim" weight="600">한자 디컴포지션</T><MarkdownBox text={String(item.memoDecomposition ?? "")} placeholder="메모 없음" render={markdown} />
  </View> : null;
  const items = <ItemGrid items={dayItems} current={item?.id} onJump={jump} onCopy={(id) => void copy(id)} displayId={model.getDisplayItemId} />;
  const problem = normalizeProblem(item?.problem);
  const selected = item && session.selectedChoices?.[item.id];
  const verdict = item && session.graded?.[item.id];
  const showChoices = item && (session.showChoices?.[item.id] || selected);
  const wordSize = Math.max(41.6, Math.min(70.4, viewport * 0.12));
  const sentenceSize = Math.max(18.4, Math.min(24.8, viewport * 0.046));
  const draft = model.editor.draft;
  const patchDraft = (patch: Record<string, string>) => model.setEditor((previous) => ({ ...previous, draft: { ...previous.draft, ...patch }, error: "" }));

  const body = <>
    {item && study && <>
      <WordCard>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center" }}>
          <CopyId id={model.getDisplayItemId(item)} onCopy={(id) => void copy(id)} />
          {item.lastResult === "PASS" && <Chip tone="pass">지난 정답</Chip>}{item.lastResult === "FAIL" && <Chip tone="fail">지난 오답</Chip>}
        </View>
        <Furigana item={item} visible={reading} size={wordSize} />
        {meaning && <T size={16.3} tone="muted" selectable style={{ textAlign: "center" }}>{item.meaningKo}</T>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center" }}>
          <Switch on={reading} onToggle={() => setReading(!reading)} label="후리가나" /><Switch on={meaning} onToggle={() => setMeaning(!meaning)} label="뜻" />
          <Btn variant="ghost" title="단어 복사" onPress={() => void copy(String(item.expression ?? ""))} />
        </View>
      </WordCard>
      <MemoEditor key={item.id + ":personal"} label="내 메모" value={String(item.memoPersonal ?? "")} placeholder="눌러서 메모 입력" onCommit={(value) => model.updateMemo(item.id, "memoPersonal", value)} render={markdown} />
      <MemoEditor key={item.id + ":decomposition"} label="한자 디컴포지션" requireDouble value={String(item.memoDecomposition ?? "")} placeholder="두 번 눌러서 편집" onCommit={(value) => model.updateMemo(item.id, "memoDecomposition", value)} render={markdown} />
    </>}
    {item && quiz && <>
      <View style={{ flexDirection: "row" }}><CopyId id={model.getDisplayItemId(item)} onCopy={(id) => void copy(id)} /></View>
      <Sentence text={problem?.sentence || `${item.expression ?? ""} (${item.reading ?? ""})`} target={problem?.target ?? ""} size={sentenceSize} />
      {problem?.choices.length ? <>
        <QuizMemo key={item.id} />
        {showChoices ? <View style={{ gap: 8 }}>{(session.choiceOrders?.[item.id] ?? problem.choices).map((choice: string, index: number) => <Choice key={index + ":" + choice} index={index} text={choice} phone={isPhone} selected={selected === choice} onPress={() => model.selectQuizChoice(choice)} />)}</View>
          : <Btn size="lg" title="보기 열기" onPress={model.openQuizChoices} />}
        {verdict && <Verdict pass={verdict === "PASS"}>{verdict === "PASS" ? "정답입니다." : `오답입니다. 정답: ${problem.answer || "(미설정)"}`}</Verdict>}
        <Btn variant="ghost" title="문제 수정" onPress={() => model.openProblemEditor(item.problem)} />
      </> : <>
        <T size={13.1} tone="muted">{problem ? "보기가 없습니다." : "아직 문제가 없습니다."}</T>
        <Btn variant="primary" title="문제와 보기 추가하기" onPress={() => model.openProblemEditor(item.problem)} />
      </>}
    </>}
    {session.phase === "done" && <WordCard>
      <T serif size={41.6} style={{ lineHeight: 52 }}>{session.mode === "review" ? ((session.passCount ?? 0) === (session.reviewedCount ?? 0) ? "満点" : "完") : session.allPass ? "昇" : "続"}</T>
      <T size={16.3} tone="muted" style={{ textAlign: "center" }}>{session.mode === "review" ? `오늘 복습 반영 완료 — PASS ${session.passCount ?? 0}/${session.reviewedCount ?? 0}` : session.allPass ? "FAIL 없음. 복습 회차가 올라갔습니다." : "FAIL 존재. 내일 복습으로 이동했습니다."}</T>
      <Btn variant="primary" title="확인" disabled={queued} onPress={model.goHome} />
    </WordCard>}
    {!!model.queue.items.length && <T size={12.2} tone="dim">전송 대기 {model.queue.items.length}건 · 설정에서 상태와 재시도를 확인할 수 있습니다.</T>}
  </>;
  const split = !isPhone && panel !== null;
  return <View style={[{ flex: 1, backgroundColor: c.bg }]}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      <Btn size="icon" title="←" label="세션 닫기" disabled={queued} onPress={back} testID="back-home" />
      <View style={{ minWidth: 0, flexShrink: 1 }}>
        <T size={14.7} weight="700" numberOfLines={1}>{model.sessionDay?.title}</T>
        <T size={11.4} mono tone="dim">{session.phase === "done" ? "-" : session.index + 1}/{model.sessionItems.length} · {session.mode === "review" ? "복습" : "학습"} · {study ? "단어" : quiz ? "문제" : "완료"}</T>
      </View>
      <View style={{ flex: 1 }} />
      <Btn title={quiz ? "学" : "問"} label={quiz ? "학습으로" : "문제로"} disabled={session.phase === "done" || Boolean(session.postQuizStudy && study)} onPress={togglePhase} />
      {isPhone ? <>
        <Btn size="icon" title="▦" label="목록" onPress={() => setSheet("items")} />
        <Btn size="icon" title="✎" label="노트" disabled={!quiz} onPress={() => setSheet("notes")} />
        <Btn size="icon" title="⋯" label="단어 데이터" disabled={session.phase === "done"} onPress={() => setSheet("words")} />
      </> : <>
        <Segment options={[{ key: "items", label: "목록" }, { key: "notes", label: "노트" }, { key: "hide", label: "숨김" }]} value={panel ?? "hide"} onChange={(key) => setPanel(key === "hide" ? null : key as "items" | "notes")} />
        <Btn title="단어 데이터" disabled={session.phase === "done"} onPress={() => setSheet("words")} />
      </>}
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingTop: isPhone ? 14 : 18, paddingHorizontal: isPhone ? 14 : 16, paddingBottom: isPhone ? 8 : 12 }}>
      {split ? <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, width: "100%", maxWidth: 1320, alignSelf: "center" }}>
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>{body}</View>
        <View style={{ width, maxWidth: "45%", gap: 12, padding: 14, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel }}>
          <View {...resizer.panHandlers} accessibilityLabel="패널 너비 조절" style={[{ position: "absolute", left: -12, top: 0, bottom: 0, width: 10, borderRadius: 999 }, Platform.OS === "web" ? { cursor: "col-resize" } as any : null]} />
          <T size={14.7} weight="700">{panel === "items" ? `${model.sessionDay?.title} 목록` : "현재 단어 노트"}</T>
          {panel === "items" ? items : notes}
        </View>
      </View> : <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: 14 }}>{body}</View>}
    </ScrollView>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      {session.phase !== "done" ? <>
        <NavButton label="이전" title="←" phone={isPhone} disabled={session.index === 0} onPress={quiz ? model.goPrevQuizItem : model.goPrevStudyItem} />
        {!isPhone && <View style={{ flex: 1 }} />}
        <NavButton label="다음" title="→" phone={isPhone} primary disabled={quiz && !model.canGoQuizNext()} onPress={quiz ? model.goNextQuizItem : model.goNextStudyItem} />
      </> : <><View style={{ flex: 1 }} /><Btn variant="primary" size="lg" title="홈으로" disabled={queued} onPress={model.goHome} /></>}
    </View>
    {sheet === "items" && <Sheet title={`${model.sessionDay?.title} 목록`} onClose={() => setSheet(null)}>{items}</Sheet>}
    {sheet === "notes" && <Sheet title="현재 단어 노트" onClose={() => setSheet(null)}>{notes}</Sheet>}
    {sheet === "words" && <WordActions model={model} path={session} notify={notify} onClose={() => setSheet(null)} />}
    {model.editor.open && item && <Sheet title="문제 편집" onClose={() => model.setEditor((previous) => ({ ...previous, open: false, error: "" }))}>
      <Segment options={[{ key: "form", label: "폼" }, { key: "json", label: "JSON" }]} value={draft.mode} onChange={(mode) => patchDraft({ mode })} />
      {draft.mode === "json" ? <Input multiline label="문제 JSON" value={draft.jsonText} onChangeText={(value) => patchDraft({ jsonText: value })} placeholder={'{\n  "sentence": "문장",\n  "target": "대상",\n  "choices": ["보기1", "보기2"],\n  "answer": "보기1"\n}'} /> : <>
        <EditorField label="문제 문장" value={draft.sentence} onChange={(value) => patchDraft({ sentence: value })} placeholder="문제 문장을 입력하세요." />
        <EditorField label="대상 표현" value={draft.target} onChange={(value) => patchDraft({ target: value })} placeholder="문장에서 강조할 표현" single />
        <EditorField label="보기 (한 줄에 하나)" value={draft.choicesText} onChange={(value) => patchDraft({ choicesText: value })} placeholder={"こう\nごう\nほう\nぼう"} />
        <EditorField label="정답" value={draft.answer} onChange={(value) => patchDraft({ answer: value })} placeholder="정답 보기 텍스트" single />
      </>}
      {!!model.editor.error && <Verdict pass={false}>{model.editor.error}</Verdict>}
      <View style={{ flexDirection: "row", gap: 8 }}><Btn variant="primary" title="저장" onPress={model.saveProblemEditor} /><Btn title="취소" onPress={() => model.setEditor((previous) => ({ ...previous, open: false, error: "" }))} /></View>
    </Sheet>}
  </View>;
}

/** One-line scratch memo; never saved and recreated empty for each question. */
function QuizMemo() {
  const [memo, setMemo] = useState("");
  return <Input label="메모" placeholder="메모 (저장되지 않음)" value={memo} onChangeText={setMemo} testID="quiz-memo" />;
}
function EditorField({ label, value, onChange, placeholder, single = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; single?: boolean }) {
  return <View style={{ gap: 6 }}><T size={13.1} tone="muted" weight="600">{label}</T><Input multiline={!single} sunken label={label} value={value} onChangeText={onChange} placeholder={placeholder} style={single ? { minHeight: 44 } : undefined} /></View>;
}
function NavButton({ title, label, phone, primary = false, disabled, onPress }: { title: string; label: string; phone: boolean; primary?: boolean; disabled: boolean; onPress: () => void }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[{ flex: phone ? 1 : undefined, minWidth: 74, minHeight: phone ? 50 : 44, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: primary ? "transparent" : c.border, backgroundColor: primary ? c.accent : c.raised, opacity: disabled ? 0.35 : 1 }, primary ? primaryFill(c) : null]}>
    <T size={16.8} weight="700" style={{ color: primary ? c.onAccent : c.text }}>{title}</T>
  </Pressable>;
}
