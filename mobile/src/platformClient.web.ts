import { CompanionClient } from "./client";
import { API_ORIGIN, DEVELOPMENT_BROWSER_ORIGIN } from "./unified/config";

/** Create the browser client using API-origin cookies and response-body CSRF tokens. */
export function createPlatformClient() {
  return new CompanionClient(API_ORIGIN, "japanese", {
    read: async () => null,
    write: async () => undefined,
  }, (input, init) => fetch(input, init), true, DEVELOPMENT_BROWSER_ORIGIN);
}
