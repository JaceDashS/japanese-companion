import React, { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { LearningPath } from "../../../shared/domain/studyTypes";
import type { StudyModel } from "./useStudyModel";
import { Action, Field, Label, layout, Sheet } from "./ui";
import { confirmAction } from "./platform";

/** Reuse original Day imports and reset rules; only clipboard and confirmation differ by platform. */
export function WordActions({ model, path, onClose, notify }: { model: StudyModel; path: LearningPath; onClose: () => void; notify: (text: string, tone?: string) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (error) { notify(String(error), "error"); } finally { setBusy(false); }
  };
  return <Sheet title="단어 작업" onClose={onClose}>
    <View style={layout.row}>
      <Action title="단어 복사" disabled={busy} onPress={() => void run(async () => { await Clipboard.setStringAsync(model.dayCopy(path)); notify("단어 복사 완료"); })} />
      <Action title="클립보드에서 가져오기" disabled={busy} onPress={() => void run(async () => { const value = await Clipboard.getStringAsync(); if (!value.trim()) throw new Error("클립보드가 비어 있습니다."); setText(value); })} />
    </View>
    <Label muted>기존 분해와 문제는 덮어쓰지 않고 빈 항목만 채웁니다.</Label>
    <Field label="분해와 문제 JSON" multiline value={text} onChangeText={setText} testID="word-import" />
    <Action title="가져오기" disabled={busy || !text.trim()} onPress={() => void run(async () => { if (await model.importDay(path, text)) { setText(""); onClose(); } })} />
    <View style={layout.row}>
      <Action title="분해 초기화" disabled={busy} onPress={() => void run(async () => { if (await confirmAction("이 Day의 한자 디컴포지션을 모두 지울까요?")) await model.resetDay(path, false); })} />
      <Action title="문제 초기화" disabled={busy} onPress={() => void run(async () => { if (await confirmAction("이 Day의 문제와 선택지를 모두 지울까요?")) await model.resetDay(path, true); })} />
    </View>
  </Sheet>;
}
