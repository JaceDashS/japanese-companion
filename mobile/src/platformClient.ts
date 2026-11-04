import Constants from "expo-constants";
import { fetch as nativeFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { CompanionClient } from "./client";

/** Create the native client with explicit cookies held in the encrypted store. */
export function createPlatformClient() {
  const key = "jaces.japanese.session";
  return new CompanionClient(Constants.expoConfig?.extra?.apiOrigin ?? "https://api.jace-s.com", "japanese", {
    read: () => SecureStore.getItemAsync(key),
    write: (value) => value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value),
  }, nativeFetch as typeof fetch);
}
