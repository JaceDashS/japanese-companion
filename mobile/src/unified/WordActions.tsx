import React, { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { LearningPath } from "../../../shared/domain/studyTypes";
import type { StudyModel } from "./useStudyModel";
import { Btn, Input, Sheet, T } from "./ui";
import { ActionTile } from "./Dashboard";
import { confirmAction } from "./platform";

/** Former "word data" sheet: copy, clipboard import and Day resets as a two-column action grid. */
export function WordActions({ model, path, onClose, notify }: { model: StudyModel; path: LearningPath; onClose: () => void; notify: (text: string, tone?: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (error) { notify(String(error), "error"); } finally { setBusy(false); }
  };
  const importFromClipboard = async () => {
    const value = await Clipboard.getStringAsync();
    if (value.trim() && await model.importDay(path, value)) { notify("디컴포지션 입력 완료"); onClose(); return; }
    setText(value);
  };
  return <Sheet title="단어 데이터" onClose={onClose}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <ActionTile title="단어 복사" hint="이 Day의 학습 단어 JSON을 클립보드로" disabled={busy} onPress={() => void run(async () => { await Clipboard.setStringAsync(model.dayCopy(path)); notify("단어 복사 완료"); })} />
      <ActionTile title="디컴포지션 입력" hint="클립보드 JSON을 이 Day에 반영" disabled={busy} onPress={() => void run(importFromClipboard)} />
      <ActionTile title="분해 초기화" hint="디컴포지션 메모를 비웁니다" disabled={busy} onPress={() => void run(async () => { if (await confirmAction("이 Day의 한자 디컴포지션을 모두 지울까요?")) await model.resetDay(path, false); })} />
      <ActionTile title="문제 초기화" hint="이 Day의 문제를 비웁니다" disabled={busy} onPress={() => void run(async () => { if (await confirmAction("이 Day의 문제와 선택지를 모두 지울까요?")) await model.resetDay(path, true); })} />
    </View>
    {text !== null && <View style={{ gap: 10 }}>
      <T size={11.8} tone="dim" weight="600">JSON 붙여넣기</T>
      <Input multiline label="분해와 문제 JSON" placeholder="여기에 Day JSON을 붙여넣으세요" value={text} onChangeText={setText} testID="word-import" />
      <T size={12.2} tone="dim">기존 분해와 문제는 덮어쓰지 않고 빈 항목만 채웁니다.</T>
      <View style={{ flexDirection: "row" }}><Btn variant="primary" title="가져오기" disabled={busy || !text.trim()} onPress={() => void run(async () => { if (await model.importDay(path, text)) { setText(null); onClose(); } })} /></View>
    </View>}
  </Sheet>;
}
