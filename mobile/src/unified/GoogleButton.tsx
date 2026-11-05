import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { GoogleOneTapSignIn, GoogleSignInButton, isCancelledResponse, isSuccessResponse } from "react-native-nitro-google-signin";
import type { CompanionClient, User } from "../client";
import { styles } from "../ui";
import { signInWithNativeGoogle } from "./nativeGoogleFlow";

export type GoogleButtonProps = { client: CompanionClient; remember: boolean; disabled: boolean; onBusyChange: (busy: boolean) => void; onLoggedIn: (user: User) => Promise<void> };

const provider = {
  checkPlayServices: () => GoogleOneTapSignIn.checkPlayServices(),
  configure: (options: { webClientId: string; nonce: string; autoSelectOnSignIn: boolean }) => GoogleOneTapSignIn.configure(options),
  async pickAccount(): Promise<string | null> {
    const response = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (isCancelledResponse(response)) return null;
    if (!isSuccessResponse(response) || !response.data.idToken) throw new Error("GOOGLE_TOKEN_MISSING");
    return response.data.idToken;
  },
};

/** Official native button opens Android Credential Manager and uses the same platform account after server verification. */
export function GoogleButton({ client, remember, disabled, onBusyChange, onLoggedIn }: GoogleButtonProps) {
  const latest = useRef({ remember, disabled, onBusyChange, onLoggedIn });
  latest.current = { remember, disabled, onBusyChange, onLoggedIn };
  const mounted = useRef(true);
  const working = useRef(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    void client.googleConfig().then(config => { if (mounted.current) setEnabled(config.enabled); }).catch(() => undefined);
    return () => { mounted.current = false; };
  }, [client]);
  const press = async () => {
    if (working.current || latest.current.disabled) return;
    working.current = true;
    latest.current.onBusyChange(true);
    setError("");
    try {
      const user = await signInWithNativeGoogle(client, provider, latest.current.remember, () => mounted.current);
      if (user && mounted.current) await latest.current.onLoggedIn(user);
    } catch {
      if (mounted.current) setError("Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      working.current = false;
      latest.current.onBusyChange(false);
    }
  };
  if (!enabled || Platform.OS !== "android") return null;
  return <View style={{ gap: 8, alignItems: "center" }}>
    <GoogleSignInButton signInBehavior="none" onPress={press} disabled={disabled} size="standard" colorScheme="light" style={{ width: "100%", maxWidth: 320, height: 44 }} accessibilityLabel="Google로 계속" testID="native-google-login" />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}
