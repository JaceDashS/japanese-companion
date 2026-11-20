import { StudyProgress, StudySkeleton } from "./StudyLoading";
import { clearSnapshot, readSnapshot, saveSnapshot } from "./studySnapshot";
import type { Clock } from "../client";
import { useCompanionReady } from "./useCompanionReady";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ApiError, type User } from "../client";
import { LoginScreen, PasswordScreen } from "../LoginScreen";
import { setStorageScope } from "../../.generated/product/shared/controllers/data/storageScope.js";
import { client, getTodayString, listenForExpiry, setClock, snapshotClock } from "./runtime";
import { loadStudy, useStudyModel, type BootData } from "./useStudyModel";
import { HomeScreen } from "./HomeScreen";
import { SessionScreen } from "./SessionScreen";
import { SettingsScreen, type Display } from "./SettingsScreen";
import { Action, Device, gradient, Label, layout, palettes, Theme, Toast } from "./ui";
import { GoogleButton } from "./GoogleButton";
import { Notices } from "./Notices";
import * as storage from "./storage";
import { useHomeFocus } from "./useHomeFocus";
import { SITE_ORIGIN } from "./config";
import { Chrome, type HeaderSection } from "./Chrome";
import { useMainReturn } from "../useMainReturn";
import { isDesktopLayout } from "./responsive";
import { BrowserTheme } from "./BrowserTheme";
import { ReaderScreen, useReadingLibrary } from "./ReadingLibrary";
import { readingApi } from "./japaneseWords";
import { CompletionHud } from "./CompletionHud";
type Gate = { kind: "checking" } | { kind: "login" } | { kind: "password" } | { kind: "blocked" } | { kind: "ready"; user: User; boot: BootData; verified: boolean };
type CachedStudy = { user: User; clock: Clock; data: Parameters<typeof loadStudy> };

export interface CompanionHost {
  embedded?: boolean;
  active?: boolean;
  initialUser?: User;
  onOpenHub?: () => void;
  onLogout?: () => Promise<void>;
  onExpired?: () => void;
  onStatusChange?: (status: { state: "loading" | "ready" | "error"; dueCount?: number; summary?: string }) => void;
  renderAdSlot?: (placement: string) => React.ReactNode;
}

/** Common Expo root; each account gets a new study screen lifecycle. */
export function JapaneseCompanionApp({ host }: { host?: CompanionHost } = {}) {
  const embedded = Boolean(host?.embedded);
  const hostActive = host?.active !== false;
  const hostRef = useRef(host);
  hostRef.current = host;
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [revision, setRevision] = useState(0);
  const working = useRef(false);
  const enter = useCallback(async (user?: User) => {
    let finished = false;
    const preview = !user ? readSnapshot<CachedStudy>().then(snapshot => {
      if (!snapshot || snapshot.payload.user.id !== snapshot.owner) return;
      if (finished) return snapshot.owner;
      const { user: cachedUser, clock, data } = snapshot.payload;
      const adjustedClock = { ...clock, serverNow: new Date(Date.parse(clock.serverNow) + Math.max(0, Date.now() - snapshot.savedAt)).toISOString() };
      setClock(adjustedClock);
      const [curriculum, { preferences }] = data;
      setGate({ kind: "ready", verified: false, user: cachedUser, boot: { ...curriculum, preferences: preferences } });
      return snapshot.owner;
    }).catch(() => undefined) : Promise.resolve(undefined);
    const request = client.startStudy<Parameters<typeof loadStudy>>(["curriculum", "app-preferences"], user);
    let result: Awaited<typeof request>;
    try { result = await request; }
    catch (error) { await preview; throw error; }
    finished = true;
    const cachedOwner = await preview;
    if (!result || (cachedOwner && cachedOwner !== result.user.id)) {
      await clearSnapshot(cachedOwner);
      setStorageScope(""); setGate({ kind: "login" }); return;
    }
    if (!result.study) { setStorageScope(""); setGate({ kind: "password" }); return; }
    setStorageScope(result.user.id);
    setClock(result.study.clock);
    const boot = await loadStudy(...result.study.data);
    setRevision(value => value + 1);
    setGate({ kind: "ready", verified: true, user: result.user, boot });
    void saveSnapshot(result.user.id, boot.book, { user: result.user, clock: result.study.clock, data: result.study.data });
  }, []);
  const action = useCallback(async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await work(); }
    catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.code === "ACCOUNT_CHANGED")) { void clearSnapshot(); setStorageScope(""); setGate({ kind: "login" }); }
      if (cause instanceof ApiError && cause.code === "PASSWORD_CHANGE_REQUIRED") setGate({ kind: "password" });
      if (cause instanceof ApiError && cause.code === "APP_ACCESS_DENIED") setGate({ kind: "blocked" });
      const messages: Record<string, string> = { INVALID_CREDENTIALS: "아이디 또는 비밀번호를 확인해 주세요.", UNAUTHENTICATED: "로그인이 만료되었습니다. 다시 로그인해 주세요.", APP_ACCESS_DENIED: "이 앱을 사용할 권한이 없습니다.", ACCOUNT_CHANGED: "계정이 바뀌어 저장을 중단했습니다." };
      setError(cause instanceof ApiError ? messages[cause.code] ?? cause.message : String(cause)); throw cause;
    } finally { working.current = false; setBusy(false); }
  }, []);
  useEffect(() => { void action(async () => enter(hostRef.current?.initialUser)).catch(() => undefined); }, [action, enter]);
  useEffect(() => listenForExpiry(() => {
    void clearSnapshot();
    setStorageScope("");
    if (hostRef.current?.onExpired) { hostRef.current.onExpired(); return; }
    setGate({ kind: "login" });
    setError("로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }), []);
  useEffect(() => {
    const report = hostRef.current?.onStatusChange;
    if (!report) return;
    if (gate.kind === "checking") report({ state: "loading" });
    else if (gate.kind === "blocked") report({ state: "error", summary: error || "접근 권한이 없습니다." });
    else if (gate.kind === "login" || gate.kind === "password") report({ state: "error", summary: "로그인이 필요합니다." });
  }, [gate.kind, error]);
  const logout = () => action(async () => {
    if (hostRef.current?.onLogout) {
      await clearSnapshot(gate.kind === "ready" ? gate.user.id : undefined);
      setStorageScope("");
      await hostRef.current.onLogout();
      return;
    }
    await client.logout();
    await clearSnapshot(gate.kind === "ready" ? gate.user.id : undefined);
    setStorageScope("");
    setGate({ kind: "login" });
  });
  const inner = <View style={[{ flex: 1, backgroundColor: palettes.dark.bg }, gradient(`radial-gradient(900px 480px at 85% -10%, ${palettes.dark.glow}, transparent 70%)`)]}>{hostActive && <StatusBar style="light" />}
    {gate.kind !== "ready" && <>{hostActive && <BrowserTheme scheme="dark" />}<Notices /></>}
    {gate.kind === "checking" && <>{busy || !error ? <StudySkeleton /> : <View style={layout.body}><Label error>{error}</Label><Action title="다시 불러오기" onPress={() => void action(async () => enter()).catch(() => undefined)} /></View>}</>}
    {gate.kind === "login" && <LoginScreen name="Japanese Companion" busy={busy} error={error} remember={remember} onRememberChange={setRemember} onLogin={(username, password) => void action(async () => enter(await client.login(username, password, remember))).catch(() => undefined)} onDevLogin={__DEV__ ? () => void action(async () => enter(await client.devLogin())).catch(() => undefined) : undefined}><GoogleButton client={client} remember={remember} disabled={busy} onBusyChange={setBusy} onLoggedIn={(user) => action(() => enter(user))} /></LoginScreen>}
    {gate.kind === "password" && <PasswordScreen busy={busy} error={error} onSave={(a, b) => void action(async () => { await client.changePassword(a, b); await enter(); }).catch(() => undefined)} onLogout={() => void logout().catch(() => undefined)} />}
    {gate.kind === "blocked" && <View style={layout.body}><Label error>{error}</Label><Action title="메인 페이지" onPress={() => void Linking.openURL(SITE_ORIGIN)} /><Action title="로그아웃" onPress={() => void logout().catch(() => undefined)} /></View>}
    {gate.kind === "ready" && !gate.verified && <Action title="연결 다시 확인" onPress={() => void action(() => enter()).catch(() => undefined)} />}
    {gate.kind === "ready" && <StudyApp key={gate.user.id + ":" + revision} boot={gate.boot} user={gate.user} verified={gate.verified} host={host} onLogout={logout} onReset={() => void action(async () => enter(gate.user)).catch(() => undefined)} />}
  </View>;
  if (embedded) return inner;
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: palettes.dark.bg }}>{inner}</SafeAreaView></SafeAreaProvider>;
}

export default function App() {
  return <JapaneseCompanionApp />;
}

function StudyApp({ boot, user, verified, host, onLogout, onReset }: { boot: BootData; user: User; verified: boolean; host?: CompanionHost; onLogout: () => Promise<void>; onReset: () => void }) {
  const hostActive = host?.active !== false;
  const hostRef = useRef(host);
  hostRef.current = host;
  useCompanionReady(true);
  const [section, setSection] = useState<HeaderSection>("vocabulary");
  const [tab, setTab] = useState<"today" | "days" | "progress" | "settings">("today");
  const [today, setToday] = useState(getTodayString);
  const [display, updateDisplay] = useState<Display>({ theme: "dark", device: "auto" });
  const [toast, setToast] = useState<{ text: string; tone?: string } | null>(null);
  const { width, height } = useWindowDimensions();
  const notify = useCallback((text: string, tone?: string) => setToast({ text, tone }), []);
  const cache = useCallback((data: Parameters<typeof loadStudy>[0], preferences: BootData["preferences"]) => {
    void saveSnapshot(user.id, data.book, { user, clock: snapshotClock(), data: [data, { preferences }] } satisfies CachedStudy);
  }, [user]);
  const model = useStudyModel(boot, today, notify, verified, cache);
  const library = useReadingLibrary(readingApi, notify, verified);
  useHomeFocus(hostActive && verified && !model.session, model.refresh, (error) => notify(String(error), "error"));
  // The account's last section opens again: a visit that ended in the bookshelf starts there.
  const sectionRestored = useRef(false);
  useEffect(() => {
    if (sectionRestored.current || !library.loaded) return;
    sectionRestored.current = true;
    if (library.reading.section === "bookshelf") setSection("bookshelf");
  }, [library.loaded, library.reading.section]);
  const changeSection = (next: HeaderSection) => { setSection(next); library.setSection(next); };
  const goHome = () => { changeSection("vocabulary"); setTab("today"); };
  const isPhone = !isDesktopLayout(width, height, display.device);
  const c = palettes[display.theme];
  useEffect(() => { void Promise.all([storage.readAsync("jpc-theme-v1"), storage.readAsync("jpc-device-mode-v1")]).then(([theme, device]) => updateDisplay({ theme: theme === "light" || theme === "washi" ? "light" : "dark", device: device === "phone" || device === "pc" ? device : "auto" })); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!verified) return;
    let active = true;
    const sync = async () => { try { const clock = await client.clock(); if (active) { setClock(clock); setToday(clock.today); } } catch (error) { if (active) notify(String(error), "error"); } };
    const tick = setInterval(() => setToday(getTodayString()), 1000);
    const refresh = setInterval(() => { if (AppState.currentState === "active") void sync(); }, 60000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void sync(); });
    return () => { active = false; clearInterval(tick); clearInterval(refresh); subscription.remove(); };
  }, [notify, verified]);
  const setDisplay = (next: Display) => { updateDisplay(next); void storage.write("jpc-theme-v1", next.theme).catch(() => undefined); void storage.write("jpc-device-mode-v1", next.device).catch(() => undefined); };
  const dueCount = model.dashboard.reviewDue.length;
  useEffect(() => {
    hostRef.current?.onStatusChange?.({ state: "ready", dueCount, summary: dueCount > 0 ? `복습 ${dueCount} Day` : "오늘 복습 완료" });
  }, [dueCount]);
  useMainReturn({
    active: hostActive && !model.session && !library.openId && tab !== "today",
    dirty: false,
    subPath: tab !== "today" ? tab : undefined,
    onReturn: () => setTab("today"),
  });
  return <Theme.Provider value={c}><Device.Provider value={{ phone: isPhone }}><View ref={node => { if (Platform.OS === "web" && node instanceof HTMLElement) node.inert = !verified; }} accessibilityElementsHidden={!verified} importantForAccessibility={!verified ? "no-hide-descendants" : "auto"} pointerEvents={!verified ? "none" : "auto"} style={[{ flex: 1, backgroundColor: c.bg }, gradient(`radial-gradient(900px 480px at 85% -10%, ${c.glow}, transparent 70%)`)]}>{hostActive && <BrowserTheme scheme={display.theme} />}{hostActive && <StatusBar style={display.theme === "light" ? "dark" : "light"} />}<Notices /><StudyProgress pending={model.switching} />
    {model.session ? <SessionScreen key={model.session.unitId + ":" + model.session.dayId} model={model} isPhone={isPhone} notify={notify} /> : library.openId ? <ReaderScreen library={library} api={readingApi} language="ja" notify={notify} onNoteSaved={model.applyMemo} /> : <>
      <Chrome desktop={!isPhone} section={section} onSectionChange={(next) => { changeSection(next); if (tab === "settings") setTab("today"); }} tab={tab} today={today} dueCount={dueCount} onNavigate={setTab} onHome={goHome} onOpenHub={host?.onOpenHub} adSlot={tab !== "settings" ? host?.renderAdSlot?.("japanese-bottom") : undefined}>
        {tab === "settings" ? <SettingsScreen phone={isPhone} model={model} display={display} setDisplay={setDisplay} notify={notify} onLogout={onLogout} onReset={onReset} hideUnifiedAppLink={Boolean(host?.embedded)} /> : <HomeScreen model={model} library={library} section={section} tab={tab} today={today} desktop={!isPhone} notify={notify} />}
      </Chrome>
    </>}
    <CompletionHud completion={model.session ? null : model.completion} today={today} onDone={model.clearCompletion} />
    {toast && <Toast text={toast.text} tone={toast.tone} phone={isPhone && !model.session} />}
  </View></Device.Provider></Theme.Provider>;
}
