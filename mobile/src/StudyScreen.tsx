import React, { useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import type { AppKey, CompanionClient } from "./client";
import { grade, type Unit, type Result, type Item } from "./study";
import { Button, Field, styles } from "./ui";
import { StudyMarkdown } from "./StudyMarkdown";
import { useMainReturn } from "./useMainReturn";
import { shuffle } from "../.generated/domain/shuffle.js";
/** One-line scratch memo for the current question; never saved and recreated empty for each question. */
function QuizMemo() {
  const [memo, setMemo] = useState("");
  return <Field label="메모 (저장되지 않음)" value={memo} onChangeText={setMemo} testID="quiz-memo" />;
}

export function StudyScreen({
  unit,
  shuffleChoices = true,
  app,
  client,
  busy,
  error,
  onSave,
  onMemo,
  onBack,
}: {
  unit: Unit;
  shuffleChoices?: boolean;
  app: AppKey;
  client: CompanionClient;
  busy: boolean;
  error: string;
  onSave: (r: Record<string, Result>) => Promise<void>;
  onMemo: (i: Item, v: string, field?: string) => Promise<void>;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<"study" | "quiz" | "done">(
    unit.note || app === "japanese" ? "study" : "quiz",
  );
  const [index, setIndex] = useState(0);
  const [choiceOrder] = useState(() =>
    Object.fromEntries(
      unit.items.map((item) => [
        item.key,
        shuffleChoices ? shuffle(item.choices) : item.choices,
      ]),
    ),
  );
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [memo, setMemo] = useState<{
    item: Item;
    value: string;
    field: string;
  } | null>(null);
  const returnToMain = useMainReturn({
    busy,
    dirty: Object.keys(selected).length > 0 || Object.keys(results).length > 0,
    onReturn: onBack,
  });
  const item = unit.items[index];
  const answered = Object.keys(results).length;
  const current = results[item?.key];
  const select = (key: string) =>
    setSelected((prev) => {
      const old = prev[item.key] ?? [];
      return {
        ...prev,
        [item.key]: item.multi
          ? old.includes(key)
            ? old.filter((k) => k !== key)
            : [...old, key]
          : [key],
      };
    });
  const next = () => {
    setIndex((i) => Math.min(unit.items.length - 1, i + 1));
  };
  const gradeCurrent = (result?: Result) =>
    setResults((prev) => ({
      ...prev,
      [item.key]: result ?? grade(item, selected[item.key] ?? []),
    }));
  const finish = () => {
    if (answered !== unit.items.length) return;
    setPhase("done");
  };
  return (
    <>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.row}>
          <Button title="목록" disabled={busy} onPress={returnToMain} />
          <Text style={styles.heading}>{unit.title}</Text>
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {phase === "study" && unit.note ? (
          <>
            <StudyMarkdown text={unit.note} client={client} />
            <Button
              title="문제 풀기"
              onPress={() => {
                setIndex(0);
                setPhase("quiz");
              }}
            />
          </>
        ) : phase === "done" ? (
          <View style={styles.card}>
            <Text style={styles.title}>학습 결과</Text>
            <Text style={styles.text}>
              정답 {Object.values(results).filter((r) => r === "PASS").length} /{" "}
              {unit.items.length}
            </Text>
            <Text style={styles.muted}>
              저장을 누르면 계정의 진도와 복습 일정에 반영됩니다.
            </Text>
            <Button
              title={busy ? "저장 중…" : "결과 저장"}
              disabled={busy}
              onPress={() => void onSave(results)}
            />
            <Button
              title="문제 다시 보기"
              disabled={busy}
              onPress={() => {
                setIndex(0);
                setPhase("quiz");
              }}
            />
          </View>
        ) : item ? (
          <>
            <Text style={styles.muted}>
              {phase === "study" ? "학습" : "문제"} {index + 1} /{" "}
              {unit.items.length}
            </Text>
            <View style={styles.card}>
              <Text selectable style={styles.title}>
                {item.title}
              </Text>
              {phase === "study" && (
                <>
                  <Text selectable style={styles.text}>
                    {item.reading}
                  </Text>
                  <Text selectable style={styles.text}>
                    {item.meaning}
                  </Text>
                </>
              )}
              {phase === "quiz" && app === "japanese" && !!item.explanation && (
                <Text style={styles.text}>{item.explanation}</Text>
              )}
              {phase === "quiz" && app === "japanese" && item.choices.length > 0 && (
                <QuizMemo key={item.key} />
              )}
              {phase === "quiz" &&
                (choiceOrder[item.key] ?? item.choices).map((c) => (
                  <Button
                    key={c.key}
                    title={c.text}
                    selected={(selected[item.key] ?? []).includes(c.key)}
                    onPress={() => {
                      select(c.key);
                      setResults((prev) => {
                        const copy = { ...prev };
                        delete copy[item.key];
                        return copy;
                      });
                    }}
                  />
                ))}
              {phase === "quiz" &&
                (item.choices.length ? (
                  <Button
                    title="정답 확인"
                    disabled={!selected[item.key]?.length}
                    onPress={() => gradeCurrent()}
                  />
                ) : (
                  <>
                    <Text style={styles.text}>
                      {item.reading} · {item.meaning}
                    </Text>
                    <View style={styles.row}>
                      <Button
                        title="기억했어요"
                        onPress={() => gradeCurrent("PASS")}
                      />
                      <Button
                        title="다시 볼게요"
                        onPress={() => gradeCurrent("FAIL")}
                      />
                    </View>
                  </>
                ))}
              {!!current && (
                <>
                  <Text style={styles.heading}>
                    {current === "PASS" ? "정답" : "다시 복습해 주세요"}
                  </Text>
                  <Text selectable style={styles.text}>
                    정답: {item.answers.join(", ") || item.meaning}
                  </Text>
                  {app === "certificate" && (
                    <StudyMarkdown text={item.explanation} client={client} />
                  )}
                </>
              )}
              {!!item.memo && (
                <Text selectable style={styles.text}>
                  {item.memo}
                </Text>
              )}
              {!!item.decomposition && (
                <Text selectable style={styles.muted}>
                  {item.decomposition}
                </Text>
              )}
              <View style={styles.row}>
                <Button
                  title="메모"
                  disabled={busy}
                  onPress={() =>
                    setMemo({ item, value: item.memo, field: "memoPersonal" })
                  }
                />
                {app === "japanese" && (
                  <Button
                    title="한자 분해"
                    disabled={busy}
                    onPress={() =>
                      setMemo({
                        item,
                        value: item.decomposition,
                        field: "memoDecomposition",
                      })
                    }
                  />
                )}
              </View>
            </View>
            <View style={styles.row}>
              <Button
                title="이전"
                disabled={index === 0}
                onPress={() => setIndex((i) => i - 1)}
              />
              {index < unit.items.length - 1 ? (
                <Button
                  title="다음"
                  disabled={phase === "quiz" && !current}
                  onPress={next}
                />
              ) : phase === "study" ? (
                <Button
                  title="문제 풀기"
                  onPress={() => {
                    setIndex(0);
                    setPhase("quiz");
                  }}
                />
              ) : (
                <Button
                  title="결과 보기"
                  disabled={answered !== unit.items.length}
                  onPress={finish}
                />
              )}
            </View>
          </>
        ) : (
          <Text style={styles.text}>학습 항목이 없습니다.</Text>
        )}
      </ScrollView>
      <Modal
        visible={!!memo}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setMemo(null);
        }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { backgroundColor: "#161a20", flexGrow: 1, paddingTop: 50 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>
            {memo?.field === "memoDecomposition" ? "한자 분해" : "개인 메모"}
          </Text>
          <Field
            label="내용"
            value={memo?.value ?? ""}
            multiline
            onChangeText={(v) =>
              setMemo((m) => (m ? { ...m, value: v } : null))
            }
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            title="저장"
            disabled={busy}
            onPress={() => {
              if (memo)
                void onMemo(memo.item, memo.value, memo.field)
                  .then(() => setMemo(null))
                  .catch(() => undefined);
            }}
          />
          <Button title="취소" disabled={busy} onPress={() => setMemo(null)} />
        </ScrollView>
      </Modal>
    </>
  );
}
