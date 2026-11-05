import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, ScrollView, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { normalizeProblem } from "../../.generated/product/shared/controllers/domain/problem.js";
import type { StudyItem } from "../../../shared/domain/studyTypes";
import type { StudyModel } from "./useStudyModel";
import { StudyMarkdown } from "../StudyMarkdown";
import { useMainReturn } from "../useMainReturn";
import { client } from "./runtime";
import { Action, Card, Field, Label, layout, Memo, Sheet, Theme } from "./ui";
import { WordActions } from "./WordActions";
import { useSessionKeys } from "./useSessionKeys";

function QuizMemo() {
  const [memo, setMemo] = useState("");
  return <Field label="메모 (저장되지 않음)" value={memo} onChangeText={setMemo} testID="quiz-memo" />;
}
function Furigana({ item, visible }: { item: StudyItem; visible: boolean }) {
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
  return <View accessibilityLabel={word + (visible && item.reading ? " " + item.reading : "")} style={[layout.row, { gap: 0, paddingVertical: 16 }]}>{parts.map((part, index) => <View key={index} style={{ alignItems: "center" }}><Text style={{ fontSize: 16, color: c.muted, minHeight: 24 }}>{visible ? part.reading : ""}</Text><Text selectable style={{ color: c.text, fontSize: 42, lineHeight: 58 }}>{part.base}</Text></View>)}</View>;
}
function Sentence({ text, target }: { text: string; target: string }) {
  const c = useContext(Theme);
  const index = target ? text.indexOf(target) : -1;
  return <Text selectable style={{ fontSize: 25, lineHeight: 39, color: c.text }}>{index < 0 ? text : <>{text.slice(0, index)}<Text style={{ color: c.accent, textDecorationLine: "underline", fontWeight: "700" }}>{target}</Text>{text.slice(index + target.length)}</>}</Text>;
}

/** Shared study and quiz screen backed by the existing product session controllers. */
export function SessionScreen({ model, isPhone, notify }: { model: StudyModel; isPhone: boolean; notify: (text: string, tone?: string) => void }) {
  const [reading, setReading] = useState(true);
  const [meaning, setMeaning] = useState(true);
  const [panel, setPanel] = useState<"items" | "notes" | null>("items");
  const [sheet, setSheet] = useState<"items" | "notes" | "words" | null>(null);
  const [width, setWidth] = useState(Number(model.state.studyDrawerWidth) || 340);
  const resizeOrigin = useRef(width);
  useEffect(() => { model.setSideWidth(width); }, [width]);
  const c = useContext(Theme);
  const session = model.session!;
  const item = model.currentItem;
  const queued = model.queue.items.some((entry: any) => entry.status === "pending");
  const back = useMainReturn({ busy: queued, dirty: session.phase === "quiz" && Object.keys(session.graded ?? {}).length > 0, onReturn: model.goHome });
  const toggleNotes = () => isPhone ? setSheet((previous) => previous === "notes" ? null : "notes") : setPanel((previous) => previous === "notes" ? "items" : "notes");
  useSessionKeys(model, toggleNotes, back);
  const resizer = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: () => { resizeOrigin.current = width; }, onPanResponderMove: (_, gesture) => setWidth(Math.max(260, Math.min(560, resizeOrigin.current - gesture.dx))) }), [width]);
  const copy = async (text: string) => { try { await Clipboard.setStringAsync(text); notify("복사 완료"); } catch (error) { notify(String(error), "error"); } };
  const notes = item ? <><Label>내 메모</Label><StudyMarkdown text={String(item.memoPersonal ?? "") || "메모 없음"} client={client} /><Label>한자 디컴포지션</Label><StudyMarkdown text={String(item.memoDecomposition ?? "") || "메모 없음"} client={client} /></> : null;
  const items = <>{(model.sessionDay?.items ?? []).map((entry: any) => <Action key={entry.id} title={`${model.getDisplayItemId(entry)} · ${entry.expression ?? ""}${entry.lastResult === "FAIL" ? " · 오답" : ""}`} selected={entry.id === item?.id} onPress={() => {
    const allIds = model.sessionDay.items.map((value: any) => value.id);
    const index = model.sessionItems.findIndex((value: any) => value.id === entry.id);
    model.setSession((previous) => previous && ({ ...previous, ...(index >= 0 ? { index } : { itemIds: allIds, index: allIds.indexOf(entry.id) }) }));
    setSheet(null);
  }} />)}</>;
  const problem = normalizeProblem(item?.problem);
  const selected = item && session.selectedChoices?.[item.id];
  const verdict = item && session.graded?.[item.id];
  const showChoices = item && (session.showChoices?.[item.id] || selected);
  const draft = model.editor.draft;
  const patchDraft = (patch: Record<string, string>) => model.setEditor((previous) => ({ ...previous, draft: { ...previous.draft, ...patch }, error: "" }));
  return <View style={{ flex: 1 }}>
    <View style={[layout.row, { padding: 12, borderBottomWidth: 1, borderColor: c.border }]}>
      <Action title="목록으로" disabled={queued} onPress={back} testID="back-home" />
      <Label>{model.sessionDay?.title} · {session.phase === "study" ? "학습" : session.phase === "quiz" ? "문제" : "완료"} · {session.index + 1}/{model.sessionItems.length}</Label>
      {session.phase !== "done" && <Action title={session.phase === "study" ? "문제로" : "학습으로"} onPress={() => {
        if (session.phase === "study") model.markDayAttemptNow(session);
        model.setSession((previous) => previous && ({ ...previous, phase: previous.phase === "quiz" ? "study" : "quiz" }));
      }} />}
      <Action title="단어 목록" onPress={() => isPhone ? setSheet("items") : setPanel((previous) => previous === "items" ? null : "items")} />
      <Action title="단어 노트" onPress={toggleNotes} />
      <Action title="단어 작업" onPress={() => setSheet("words")} />
    </View>
    <View style={{ flex: 1, flexDirection: "row" }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.body} style={{ flex: 1 }}>
        {item && session.phase !== "done" && <Action title={model.getDisplayItemId(item)} onPress={() => void copy(model.getDisplayItemId(item))} />}
        {item && session.phase === "study" && <>
          <Card><Furigana item={item} visible={reading} />{meaning && <Label large>{item.meaningKo}</Label>}<Label muted>{item.lastResult === "PASS" ? "지난 정답" : item.lastResult === "FAIL" ? "지난 오답" : ""}</Label><View style={layout.row}><Action title="후리가나" selected={reading} onPress={() => setReading(!reading)} /><Action title="뜻" selected={meaning} onPress={() => setMeaning(!meaning)} /><Action title="단어 복사" onPress={() => void copy(String(item.expression ?? ""))} /></View></Card>
          <Memo key={item.id + ":personal"} label="내 메모" value={String(item.memoPersonal ?? "")} onSave={(value) => model.updateMemo(item.id, "memoPersonal", value)} render={(text) => <StudyMarkdown text={text || "메모 없음"} client={client} />} />
          <Memo key={item.id + ":decomposition"} label="한자 디컴포지션" value={String(item.memoDecomposition ?? "")} onSave={(value) => model.updateMemo(item.id, "memoDecomposition", value)} render={(text) => <StudyMarkdown text={text || "메모 없음"} client={client} />} />
        </>}
        {item && session.phase === "quiz" && <Card>
          <Sentence text={problem?.sentence || `${item.expression ?? ""} (${item.reading ?? ""})`} target={problem?.target ?? ""} />
          {problem?.choices.length ? <><QuizMemo key={item.id} />{showChoices ? (session.choiceOrders?.[item.id] ?? problem.choices).map((choice: string, index: number) => <Action key={index + ":" + choice} title={`${index + 1} · ${choice}`} selected={selected === choice} onPress={() => model.selectQuizChoice(choice)} />) : <Action title="보기 열기" onPress={model.openQuizChoices} />}{verdict && <Label>{verdict === "PASS" ? "정답입니다." : `오답입니다. 정답: ${problem.answer || "(미설정)"}`}</Label>}</> : <Label muted>{problem ? "보기가 없습니다." : "아직 문제가 없습니다."}</Label>}
          <Action title={problem?.choices.length ? "문제 수정" : "문제와 보기 추가하기"} onPress={() => model.openProblemEditor(item.problem)} />
        </Card>}
        {session.phase === "done" ? <Card title="학습 완료"><Label>{session.mode === "review" ? `오늘 복습 반영 완료 · PASS ${session.passCount ?? 0}/${session.reviewedCount ?? 0}` : session.allPass ? "FAIL 없음. 복습 회차가 올라갔습니다." : "FAIL 존재. 내일 복습으로 이동했습니다."}</Label><Action title="확인" disabled={queued} onPress={model.goHome} /></Card> : <View style={layout.row}><Action title="이전" disabled={session.index === 0} onPress={session.phase === "study" ? model.goPrevStudyItem : model.goPrevQuizItem} /><Action title={session.index === model.sessionItems.length - 1 ? session.phase === "study" ? "문제 풀기" : "완료" : "다음"} disabled={session.phase === "quiz" && !model.canGoQuizNext()} onPress={session.phase === "study" ? model.goNextStudyItem : model.goNextQuizItem} testID="next-question" /></View>}
        {!!model.queue.items.length && <Label muted>전송 대기 {model.queue.items.length}건 · 설정에서 상태와 재시도를 확인할 수 있습니다.</Label>}
      </ScrollView>
      {!isPhone && panel && <><View {...resizer.panHandlers} accessibilityLabel="보조 패널 너비 조절" style={{ width: 12, backgroundColor: c.border }} /><ScrollView style={{ width, maxWidth: "45%", borderLeftWidth: 1, borderColor: c.border }} contentContainerStyle={{ padding: 16, gap: 12 }}>{panel === "items" ? items : notes}</ScrollView></>}
    </View>
    {(sheet === "items" || sheet === "notes") && <Sheet title={sheet === "items" ? "단어 목록" : "현재 단어 노트"} onClose={() => setSheet(null)}>{sheet === "items" ? items : notes}</Sheet>}
    {sheet === "words" && <WordActions model={model} path={session} notify={notify} onClose={() => setSheet(null)} />}
    {model.editor.open && item && <Sheet title="문제 편집" onClose={() => model.setEditor((previous) => ({ ...previous, open: false }))}>
      <View style={layout.row}><Action title="폼" selected={draft.mode === "form"} onPress={() => patchDraft({ mode: "form" })} /><Action title="JSON" selected={draft.mode === "json"} onPress={() => patchDraft({ mode: "json" })} /></View>
      {draft.mode === "json" ? <Field label="문제 JSON" value={draft.jsonText} onChangeText={(value) => patchDraft({ jsonText: value })} multiline /> : <><Field label="문제 문장" value={draft.sentence} onChangeText={(value) => patchDraft({ sentence: value })} multiline /><Field label="대상 표현" value={draft.target} onChangeText={(value) => patchDraft({ target: value })} /><Field label="보기 (한 줄에 하나)" value={draft.choicesText} onChangeText={(value) => patchDraft({ choicesText: value })} multiline /><Field label="정답" value={draft.answer} onChangeText={(value) => patchDraft({ answer: value })} /></>}
      {!!model.editor.error && <Label error>{model.editor.error}</Label>}<Action title="문제 저장" onPress={model.saveProblemEditor} />
    </Sheet>}
  </View>;
}
