import { CompanionClient } from "./client";

/** Create the browser client using API-origin cookies and response-body CSRF tokens. */
export function createPlatformClient() {
  const origin = process.env.EXPO_PUBLIC_JPC_API_ORIGIN?.trim() || "https://api.jace-s.com";
  return new CompanionClient(origin, "japanese", {
    read: async () => null,
    write: async () => undefined,
  }, (input, init) => fetch(input, init), true);
}
