import React, { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import type { AppKey, User } from "./client";
import type { Settings } from "./study";
import { Button, Field, styles } from "./ui";
export function SettingsScreen({
  app,
  user,
  settings,
  busy,
  error,
  onSave,
  onBackup,
  onLogout,
}: {
  app: AppKey;
  user: User;
  settings: Settings;
  busy: boolean;
  error: string;
  onSave: (p: Settings) => Promise<void>;
  onBackup: (restore: boolean) => Promise<void>;
  onLogout: () => void;
}) {
  const [max, setMax] = useState(String(settings.srs?.maxReviewStage ?? 6));
  const [retry, setRetry] = useState(
    String(settings.srs?.failureRetryDays ?? 1),
  );
  const [daily, setDaily] = useState(
    String(settings.dailyNewLearningCount ?? 1),
  );
  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>설정</Text>
      <Text style={styles.text}>{user.username}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.card}>
        <Text style={styles.heading}>학습과 복습</Text>
        <Field label="최종 복습 단계 2–6" value={max} onChangeText={setMax} />
        <Field
          label="틀린 문제 재복습 간격 1–30일"
          value={retry}
          onChangeText={setRetry}
        />
        {app === "japanese" && (
          <Field
            label="하루 신규 학습량 1–5"
            value={daily}
            onChangeText={setDaily}
          />
        )}
        <Button
          title="설정 저장"
          disabled={
            busy ||
            ![max, retry, ...(app === "japanese" ? [daily] : [])].every(
              (v) => Number.isFinite(Number(v)) && Number(v) > 0,
            )
          }
          onPress={() =>
            void onSave({
              srs: {
                maxReviewStage: Math.min(
                  6,
                  Math.max(2, Math.round(Number(max))),
                ),
                failureRetryDays: Math.min(
                  30,
                  Math.max(1, Math.round(Number(retry))),
                ),
              },
              ...(app === "japanese"
                ? {
                    dailyNewLearningCount: Math.min(
                      5,
                      Math.max(1, Math.round(Number(daily))),
                    ),
                  }
                : {}),
            })
          }
        />
      </View>
      {app === "certificate" && (
        <View style={styles.card}>
          <Text style={styles.heading}>학습자료 언어</Text>
          <View style={styles.row}>
            {(["ko", "en"] as const).map((lang) => (
              <Button
                key={lang}
                title={lang === "ko" ? "한국어" : "English"}
                selected={(settings.language ?? "ko") === lang}
                disabled={busy}
                onPress={() => void onSave({ language: lang })}
              />
            ))}
          </View>
          <Button
            title={
              settings.shuffleChoices === false
                ? "선택지 섞기 켜기"
                : "선택지 섞기 끄기"
            }
            disabled={busy}
            onPress={() =>
              void onSave({ shuffleChoices: settings.shuffleChoices === false })
            }
          />
        </View>
      )}
      <View style={styles.card}>
        <Text style={styles.heading}>계정 기록 백업</Text>
        <Text style={styles.muted}>
          서버에 현재 계정의 백업을 저장하거나 마지막 백업으로 복원합니다.
        </Text>
        <Button
          title="백업 저장"
          disabled={busy}
          onPress={() => void onBackup(false)}
        />
        <Button
          title="백업 복원"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "백업 복원",
              "현재 계정의 학습 기록을 마지막 백업으로 바꿀까요?",
              [
                { text: "취소", style: "cancel" },
                { text: "복원", onPress: () => void onBackup(true) },
              ],
            )
          }
        />
      </View>
      <Button title="로그아웃" disabled={busy} onPress={onLogout} />
    </ScrollView>
  );
}
