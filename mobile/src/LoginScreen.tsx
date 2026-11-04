import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Button, Field, styles } from "./ui";
export function LoginScreen({
  name,
  error,
  busy,
  onLogin,
  children,
  remember = true,
  onRememberChange,
}: {
  name: string;
  error: string;
  busy: boolean;
  onLogin: (u: string, p: string) => void;
  children?: React.ReactNode;
  remember?: boolean;
  onRememberChange?: (value: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { flexGrow: 1, justifyContent: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.text}>jace-s 계정으로 로그인</Text>
        <Text style={styles.muted}>
          웹에서 사용하던 학습 기록을 이어갑니다.
        </Text>
        <Field
          label="아이디"
          value={username}
          onChangeText={setUsername}
          testID="username"
        />
        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secure
          testID="password"
        />
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <Button
          title={busy ? "로그인 중…" : "로그인"}
          disabled={busy || !username.trim() || !password}
          testID="login"
          onPress={() => {
            onLogin(username, password);
            setPassword("");
          }}
        />
        {children}
        {onRememberChange && <View style={styles.row}><Switch accessibilityLabel="로그인 유지" value={remember} onValueChange={onRememberChange} /><Text style={styles.text}>로그인 유지</Text></View>}
        <View style={styles.row}>
          <Button
            title="계정 만들기"
            onPress={() => void Linking.openURL("https://jace-s.com")}
          />
          <Button
            title="비밀번호 찾기"
            onPress={() => void Linking.openURL("https://jace-s.com")}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function PasswordScreen({
  error,
  busy,
  onSave,
  onLogout,
}: {
  error: string;
  busy: boolean;
  onSave: (a: string, b: string) => void;
  onLogout: () => void;
}) {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("");
  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>비밀번호 변경</Text>
      <Text style={styles.text}>
        임시 비밀번호를 새 비밀번호로 변경해 주세요.
      </Text>
      <Field label="현재 비밀번호" value={old} onChangeText={setOld} secure />
      <Field label="새 비밀번호" value={next} onChangeText={setNext} secure />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button
        title="변경"
        disabled={busy || !old || !next}
        onPress={() => {
          onSave(old, next);
          setOld("");
          setNext("");
        }}
      />
      <Button title="로그아웃" disabled={busy} onPress={onLogout} />
    </ScrollView>
  );
}
