import React, { useContext, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Btn, Card, Input, T, Theme } from "./unified/ui";
import { SITE_ORIGIN } from "./unified/config";

/** Former centered login card: notice, Google sign-in, fields, remember check, primary submit and main page link. */
function Gate({ children }: { children: React.ReactNode }) {
  const c = useContext(Theme);
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.55)" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 360, backgroundColor: c.panel, borderRadius: 16 }}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
function LabeledInput({ label, value, onChangeText, secure = false, testID, onSubmit }: { label: string; value: string; onChangeText: (value: string) => void; secure?: boolean; testID?: string; onSubmit?: () => void }) {
  return <View style={{ gap: 6 }}><T size={13.1} tone="muted" weight="600">{label}</T><Input label={label} value={value} onChangeText={onChangeText} secure={secure} testID={testID} onSubmit={onSubmit} /></View>;
}
function Check({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: checked ? c.accent : c.border, backgroundColor: checked ? c.accent : c.raised, alignItems: "center", justifyContent: "center" }}>{checked && <T size={11} weight="800" style={{ color: c.onAccent, lineHeight: 13 }}>✓</T>}</View>
    <T size={13.1} tone="muted">{label}</T>
  </Pressable>;
}
function MainLink() {
  return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(SITE_ORIGIN)}><T size={13.1} tone="muted" style={{ textDecorationLine: "underline" }}>메인 페이지로</T></Pressable>;
}

export function LoginScreen({ error, busy, onLogin, children, remember = true, onRememberChange }: {
  name: string; error: string; busy: boolean; onLogin: (u: string, p: string) => void; children?: React.ReactNode; remember?: boolean; onRememberChange?: (value: boolean) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submit = () => { if (busy || !username.trim() || !password) return; onLogin(username.trim(), password); setPassword(""); };
  return <Gate><Card title="로그인">
    <T size={13.1} tone="muted">jace-s 계정으로 로그인하면 학습 기록이 계정별로 저장됩니다.</T>
    {children}
    <LabeledInput label="아이디" value={username} onChangeText={setUsername} testID="username" />
    <LabeledInput label="비밀번호" value={password} onChangeText={setPassword} secure testID="password" onSubmit={submit} />
    {onRememberChange && <Check label="로그인 유지" checked={remember} onChange={onRememberChange} />}
    {!!error && <T size={13.1} tone="muted" selectable>{error}</T>}
    <Btn variant="primary" title={busy ? "로그인 중" : "로그인"} disabled={busy || !username.trim() || !password} testID="login" onPress={submit} />
    <MainLink />
  </Card></Gate>;
}

export function PasswordScreen({ error, busy, onSave, onLogout }: { error: string; busy: boolean; onSave: (a: string, b: string) => void; onLogout: () => void }) {
  const [old, setOld] = useState("");
  const [next, setNext] = useState("");
  return <Gate><Card title="비밀번호 변경">
    <T size={13.1} tone="muted">임시 비밀번호를 새 비밀번호로 변경해 주세요.</T>
    <LabeledInput label="현재 비밀번호" value={old} onChangeText={setOld} secure />
    <LabeledInput label="새 비밀번호" value={next} onChangeText={setNext} secure />
    {!!error && <T size={13.1} tone="muted" selectable>{error}</T>}
    <Btn variant="primary" title="변경" disabled={busy || !old || !next} onPress={() => { onSave(old, next); setOld(""); setNext(""); }} />
    <Btn title="로그아웃" disabled={busy} onPress={onLogout} />
  </Card></Gate>;
}
