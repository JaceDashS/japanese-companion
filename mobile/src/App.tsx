import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, BackHandler, Text, View } from "react-native";
import Constants from "expo-constants";
import { fetch as nativeFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  CompanionClient,
  ApiError,
  accountDate,
  type AppKey,
  type Clock,
  type User,
} from "./client";
import {
  booksFromFiles,
  progressPayload,
  memoPayload,
  type Book,
  type Unit,
  type Item,
  type Result,
  type Settings,
} from "./study";
import { LoginScreen, PasswordScreen } from "./LoginScreen";
import { LibraryScreen } from "./LibraryScreen";
import { StudyScreen } from "./StudyScreen";
import { SettingsScreen } from "./SettingsScreen";
import { Busy, Button, styles } from "./ui";
const app = Constants.expoConfig?.extra?.companionApp as AppKey;
if (!["japanese", "certificate"].includes(app))
  throw new Error("Unknown companion");
const appName =
  app === "japanese" ? "Japanese Companion" : "Certificate Companion";
const key = "jaces." + app + ".session";
const client = new CompanionClient(
  Constants.expoConfig?.extra?.apiOrigin ?? "https://api.jace-s.com",
  app,
  {
    read: () => SecureStore.getItemAsync(key),
    write: (value) =>
      value === null
        ? SecureStore.deleteItemAsync(key)
        : SecureStore.setItemAsync(key, value),
  },
  nativeFetch as typeof fetch,
);
function message(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: "아이디 또는 비밀번호를 확인해 주세요.",
      UNAUTHENTICATED: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
      APP_ACCESS_DENIED: "이 앱을 사용할 권한이 없습니다.",
      EMAIL_NOT_VERIFIED: "이메일 인증을 완료해 주세요.",
      RATE_LIMITED: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      ACCOUNT_CHANGED: "계정이 바뀌어 저장을 중단했습니다.",
      CSRF_VALIDATION_FAILED:
        "세션을 확인할 수 없습니다. 다시 로그인해 주세요.",
      PASSWORD_CHANGE_REQUIRED: "비밀번호를 먼저 변경해 주세요.",
    };
    return (
      messages[error.code] ??
      "요청을 처리하지 못했습니다. (" + error.status + ")"
    );
  }
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}
/** Native entry shared by two separately packaged apps, each with an independent encrypted session. */
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <Companion />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Companion() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<Record<string, unknown>>({});
  const [settings, setSettings] = useState<Settings>({});
  const [bookId, setBookId] = useState("");
  const [unit, setUnit] = useState<Unit | null>(null);
  const [tab, setTab] = useState<"learn" | "settings">("learn");
  const [today, setToday] = useState("");
  const clock = useRef<{ value: Clock; tick: number } | null>(null);
  const working = useRef(false);
  const books = useMemo(
    () => booksFromFiles(app, files, settings),
    [files, settings],
  );
  const syncClock = useCallback(async () => {
    const value = await client.clock();
    clock.current = { value, tick: performance.now() };
    setToday(value.today);
  }, []);
  const handleError = useCallback((e: unknown) => {
    setError(message(e));
    if (e instanceof ApiError && e.status === 401) {
      setUser(null);
      setReady(false);
      setFiles({});
      setUnit(null);
    }
    if (e instanceof ApiError && e.code === "PASSWORD_CHANGE_REQUIRED")
      setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
  }, []);
  const action = useCallback(
    async (work: () => Promise<void>) => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setError("");
      try {
        await work();
      } catch (e) {
        handleError(e);
        throw e;
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [handleError],
  );
  const load = useCallback(async () => {
    setReady(false);
    const value = await client.bootstrap();
    clock.current = { value, tick: performance.now() };
    setToday(value.today);
    const prefs = await client.get<{ preferences: Settings }>(
      "app-preferences",
    );
    const data = await client.get<{ files: Record<string, unknown> }>(
      app === "japanese" ? "reload-curriculum" : "curriculum",
    );
    setSettings(prefs.preferences);
    setFiles(data.files);
    setBookId(
      app === "japanese"
        ? (prefs.preferences.selectedBookId ?? "")
        : (prefs.preferences.selectedCertificationId ?? ""),
    );
    setReady(true);
  }, []);
  useEffect(() => {
    void action(async () => {
      const restored = await client.restore();
      setUser(restored);
      if (restored && !restored.mustChangePassword) await load();
    }).catch(() => undefined);
  }, [action, load]);
  useEffect(() => {
    if (!user || !ready) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncClock().catch(handleError);
    });
    const timer = setInterval(() => {
      const c = clock.current;
      if (c) setToday(accountDate(c.value, performance.now() - c.tick));
    }, 1000);
    const refresh = setInterval(() => {
      if (AppState.currentState === "active")
        void syncClock().catch(handleError);
    }, 60000);
    return () => {
      sub.remove();
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, [user, ready, syncClock, handleError]);
  const back = useCallback(() => {
    if (busy) return true;
    if (unit) return false;
    if (tab === "settings") {
      setTab("learn");
      return true;
    }
    return false;
  }, [busy, unit, tab]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", back);
    return () => sub.remove();
  }, [back]);
  const safely = (promise: Promise<unknown>) =>
    void promise.catch(() => undefined);
  const login = (username: string, password: string) =>
    safely(
      action(async () => {
        const logged = await client.login(username, password);
        setUser(logged);
        if (!logged.mustChangePassword) await load();
      }),
    );
  const logout = () =>
    safely(
      action(async () => {
        await client.logout();
        setUser(null);
        setReady(false);
        setFiles({});
        setUnit(null);
        setTab("learn");
      }),
    );
  const saveSettings = (patch: Settings) =>
    action(async () => {
      const response = await client.post<{ preferences: Settings }>(
        "app-preferences",
        { preferences: patch },
        user!.id,
      );
      setSettings(response.preferences);
    });
  const saveResults = (results: Record<string, Result>) =>
    action(async () => {
      if (!unit || !clock.current)
        throw new Error("날짜 정보를 새로 불러와 주세요.");
      const account = user!.id;
      await syncClock();
      const date = accountDate(
        clock.current.value,
        performance.now() - clock.current.tick,
      );
      await client.post(
        app === "japanese" ? "save-day-result" : "save-chapter-progress",
        progressPayload(app, unit, date, results, settings),
        account,
      );
      setUnit(null);
      await load();
    }).catch(() => undefined);
  const saveMemo = (item: Item, value: string, field?: string) =>
    action(async () => {
      if (!unit) return;
      await client.post(
        app === "japanese" ? "save-item-field" : "save-chapter-progress",
        memoPayload(app, unit, item, value, field),
        user!.id,
      );
      setUnit((u) =>
        u
          ? {
              ...u,
              items: u.items.map((i) =>
                i.key === item.key
                  ? {
                      ...i,
                      ...(field === "memoDecomposition"
                        ? { decomposition: value }
                        : { memo: value }),
                    }
                  : i,
              ),
            }
          : u,
      );
    });
  if (!user)
    return (
      <LoginScreen name={appName} error={error} busy={busy} onLogin={login} />
    );
  if (user.mustChangePassword)
    return (
      <PasswordScreen
        busy={busy}
        error={error}
        onLogout={logout}
        onSave={(a, b) =>
          safely(
            action(async () => {
              await client.changePassword(a, b);
              const refreshed = await client.restore();
              setUser(refreshed);
              if (refreshed) await load();
            }),
          )
        }
      />
    );
  if (!ready)
    return busy ? (
      <Busy />
    ) : (
      <View style={styles.body}>
        <Text style={styles.error}>
          {error || "데이터를 불러오지 못했습니다."}
        </Text>
        <Button title="다시 불러오기" onPress={() => safely(action(load))} />
        <Button title="로그아웃" onPress={logout} />
      </View>
    );
  if (unit)
    return (
      <StudyScreen
        key={unit.key}
        unit={unit}
        shuffleChoices={settings.shuffleChoices !== false}
        app={app}
        client={client}
        busy={busy}
        error={error}
        onSave={saveResults}
        onMemo={saveMemo}
        onBack={() => {
          setUnit(null);
          safely(action(load));
        }}
      />
    );
  return (
    <>
      <View style={{ flex: 1 }}>
        {tab === "settings" ? (
          <SettingsScreen
            app={app}
            user={user}
            settings={settings}
            busy={busy}
            error={error}
            onSave={(patch) => saveSettings(patch).catch(() => undefined)}
            onBackup={(restore) =>
              action(async () => {
                await client.post(
                  "asset-backup/" + (restore ? "import" : "export"),
                  {},
                  user.id,
                );
                await load();
                Alert.alert(restore ? "복원 완료" : "백업 완료");
              }).catch(() => undefined)
            }
            onLogout={logout}
          />
        ) : (
          <>
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <Text style={styles.muted}>
                {appName} · {user.username}
              </Text>
              {!!error && <Text style={styles.error}>{error}</Text>}
            </View>
            <LibraryScreen
              books={books}
              bookId={bookId}
              today={today}
              maxStage={settings.srs?.maxReviewStage ?? 6}
              onBook={(id) => {
                setBookId(id);
                safely(
                  saveSettings(
                    app === "japanese"
                      ? { selectedBookId: id }
                      : { selectedCertificationId: id },
                  ),
                );
              }}
              onUnit={(u) => {
                setError("");
                setUnit(u);
              }}
            />
          </>
        )}
      </View>
      <View style={styles.nav}>
        <Button
          title="학습"
          selected={tab === "learn"}
          onPress={() => setTab("learn")}
        />
        <Button
          title="설정"
          selected={tab === "settings"}
          onPress={() => setTab("settings")}
        />
        <Button
          title="새로고침"
          disabled={busy}
          onPress={() => safely(action(load))}
        />
      </View>
    </>
  );
}
