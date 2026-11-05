/** Explicit shared-development builds use only the current browser origin. */
export const DEVELOPMENT_BROWSER_ORIGIN = process.env.EXPO_PUBLIC_COMPANION_LOCAL_API === "1" && typeof window !== "undefined" ? window.location?.origin : undefined;
export const API_ORIGIN = (DEVELOPMENT_BROWSER_ORIGIN || process.env.EXPO_PUBLIC_JPC_API_ORIGIN?.trim() || "https://api.jace-s.com").replace(/\/+$/, "");
export const SITE_ORIGIN = (DEVELOPMENT_BROWSER_ORIGIN || process.env.EXPO_PUBLIC_JPC_SITE_ORIGIN?.trim() || "https://jace-s.com").replace(/\/+$/, "");
export const NOTICE_APP_ID = Number(process.env.EXPO_PUBLIC_JPC_NOTICE_APP_ID) || 42;
