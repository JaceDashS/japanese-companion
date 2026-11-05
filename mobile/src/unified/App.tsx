import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ApiError, type User } from "../client";
import { LoginScreen, PasswordScreen } from "../LoginScreen";
import { Busy } from "../ui";
import { setStorageScope } from "../../.generated/product/shared/controllers/data/storageScope.js";
import { client, getTodayString, listenForExpiry, setClock } from "./runtime";
import { loadStudy, useStudyModel, type BootData } from "./useStudyModel";
import { HomeScreen } from "./HomeScreen";
import { SessionScreen } from "./SessionScreen";
import { SettingsScreen, type Display } from "./SettingsScreen";
import { Action, Label, layout, palettes, Theme } from "./ui";
import { GoogleButton } from "./GoogleButton";
import { Notices } from "./Notices";
import * as storage from "./storage";
import { useHomeFocus } from "./useHomeFocus";
import { SITE_ORIGIN } from "./config";
type Gate = { kind: "checking" } | { kind: "login" } | { kind: "password" } | { kind: "blocked" } | { kind: "ready"; user: User; boot: BootData };

/** Common Expo root; each account gets a new study screen lifecycle. */
export default function App() {
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [revision, setRevision] = useState(0);
  const working = useRef(false);
  const enter = useCallback(async (user: User | null) => {
    if (!user) { setStorageScope(""); setGate({ kind: "login" }); return; }
    if (user.mustChangePassword) { setGate({ kind: "password" }); return; }
    setStorageScope(user.id); setClock(await client.bootstrap());
    const boot = await loadStudy(); setRevision((value) => value + 1); setGate({ kind: "ready", user, boot });
  }, []);
  const action = useCallback(async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await work(); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { setStorageScope(""); setGate({ kind: "login" }); }
      if (cause instanceof ApiError && cause.code === "PASSWORD_CHANGE_REQUIRED") setGate({ kind: "password" });
      if (cause instanceof ApiError && cause.code === "APP_ACCESS_DENIED") setGate({ kind: "blocked" });
      const messages: Record<string, string> = { INVALID_CREDENTIALS: "아이디 또는 비밀번호를 확인해 주세요.", UNAUTHENTICATED: "로그인이 만료되었습니다. 다시 로그인해 주세요.", APP_ACCESS_DENIED: "이 앱을 사용할 권한이 없습니다.", ACCOUNT_CHANGED: "계정이 바뀌어 저장을 중단했습니다." };
      setError(cause instanceof ApiError ? messages[cause.code] ?? cause.message : String(cause)); throw cause;
    } finally { working.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void action(async () => enter(await client.restore())).catch(() => undefined); }, [action, enter]);
  useEffect(() => listenForExpiry(() => { setStorageScope(""); setGate({ kind: "login" }); setError("로그인이 만료되었습니다. 다시 로그인해 주세요."); }), []);
  const logout = () => action(async () => { await client.logout(); setStorageScope(""); setGate({ kind: "login" }); });
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: palettes.dark.bg }}><StatusBar style="light" />
    {gate.kind !== "ready" && <Notices />}
    {gate.kind === "checking" && <>{busy || !error ? <Busy /> : <View style={layout.body}><Label error>{error}</Label><Action title="다시 불러오기" onPress={() => void action(async () => enter(await client.restore())).catch(() => undefined)} /></View>}</>}
    {gate.kind === "login" && <LoginScreen name="Japanese Companion" busy={busy} error={error} remember={remember} onRememberChange={setRemember} onLogin={(username, password) => void action(async () => enter(await client.login(username, password, remember))).catch(() => undefined)}><GoogleButton client={client} remember={remember} disabled={busy} onBusyChange={setBusy} onLoggedIn={(user) => action(() => enter(user))} /></LoginScreen>}
    {gate.kind === "password" && <PasswordScreen busy={busy} error={error} onSave={(a, b) => void action(async () => { await client.changePassword(a, b); await enter(await client.restore()); }).catch(() => undefined)} onLogout={() => void logout().catch(() => undefined)} />}
    {gate.kind === "blocked" && <View style={layout.body}><Label error>{error}</Label><Action title="메인 페이지" onPress={() => void Linking.openURL(SITE_ORIGIN)} /><Action title="로그아웃" onPress={() => void logout().catch(() => undefined)} /></View>}
    {gate.kind === "ready" && <StudyApp key={gate.user.id + ":" + revision} boot={gate.boot} user={gate.user} onLogout={logout} onReset={() => void action(async () => enter(gate.user)).catch(() => undefined)} />}
  </SafeAreaView></SafeAreaProvider>;
}

function StudyApp({ boot, user, onLogout, onReset }: { boot: BootData; user: User; onLogout: () => Promise<void>; onReset: () => void }) {
  const [tab, setTab] = useState<"today" | "days" | "progress" | "settings">("today");
  const [today, setToday] = useState(getTodayString);
  const [display, updateDisplay] = useState<Display>({ theme: "dark", device: "auto" });
  const [toast, setToast] = useState<{ text: string; tone?: string } | null>(null);
  const width = useWindowDimensions().width;
  const notify = useCallback((text: string, tone?: string) => setToast({ text, tone }), []);
  const model = useStudyModel(boot, today, notify);
  useHomeFocus(!model.session, model.refresh, (error) => notify(String(error), "error"));
  const isPhone = display.device === "phone" || (display.device === "auto" && width <= 768);
  const c = palettes[display.theme];
  useEffect(() => { void Promise.all([storage.readAsync("jpc-theme-v1"), storage.readAsync("jpc-device-mode-v1")]).then(([theme, device]) => updateDisplay({ theme: theme === "light" || theme === "washi" ? "light" : "dark", device: device === "phone" || device === "pc" ? device : "auto" })); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    let active = true;
    const sync = async () => { try { const clock = await client.clock(); if (active) { setClock(clock); setToday(clock.today); } } catch (error) { if (active) notify(String(error), "error"); } };
    const tick = setInterval(() => setToday(getTodayString()), 1000);
    const refresh = setInterval(() => { if (AppState.currentState === "active") void sync(); }, 60000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void sync(); });
    return () => { active = false; clearInterval(tick); clearInterval(refresh); subscription.remove(); };
  }, [notify]);
  const setDisplay = (next: Display) => { updateDisplay(next); void storage.write("jpc-theme-v1", next.theme).catch(() => undefined); void storage.write("jpc-device-mode-v1", next.device).catch(() => undefined); };
  return <Theme.Provider value={c}><View style={{ flex: 1, backgroundColor: c.bg }}><StatusBar style={display.theme === "light" ? "dark" : "light"} /><Notices />
    {toast && <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}><Text accessibilityRole={toast.tone === "error" ? "alert" : "summary"} style={{ color: toast.tone === "error" ? c.error : c.good }}>{toast.text}</Text></View>}
    {model.session ? <SessionScreen key={model.session.unitId + ":" + model.session.dayId} model={model} isPhone={isPhone} notify={notify} /> : <>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}><Label muted>Japanese Companion · {user.username}</Label></View>
      {tab === "settings" ? <SettingsScreen model={model} display={display} setDisplay={setDisplay} notify={notify} onLogout={onLogout} onReset={onReset} /> : <HomeScreen model={model} tab={tab} today={today} notify={notify} />}
      <View style={[layout.row, { padding: 10, borderTopWidth: 1, borderColor: c.border }]}>{(["today", "days", "progress", "settings"] as const).map((key) => <Action key={key} title={{ today: "오늘", days: "Day", progress: "진행률", settings: "설정" }[key]} selected={tab === key} onPress={() => setTab(key)} />)}<Action title="새로고침" onPress={() => void model.refresh().catch((error) => notify(String(error), "error"))} /></View>
    </>}
  </View></Theme.Provider>;
}
