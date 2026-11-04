export const API_ORIGIN = (process.env.EXPO_PUBLIC_JPC_API_ORIGIN?.trim() || "https://api.jace-s.com").replace(/\/+$/, "");
export const SITE_ORIGIN = (process.env.EXPO_PUBLIC_JPC_SITE_ORIGIN?.trim() || "https://jace-s.com").replace(/\/+$/, "");
export const NOTICE_APP_ID = Number(process.env.EXPO_PUBLIC_JPC_NOTICE_APP_ID) || 42;
