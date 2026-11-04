import { useEffect } from "react";
import { AppState } from "react-native";
/** Refresh server content after native foregrounding only while the home screens are active. */
export function useHomeFocus(active: boolean, refresh: () => Promise<void>, onError: (error: unknown) => void) {
  useEffect(() => { if (!active) return; const sub = AppState.addEventListener("change", (state) => { if (state === "active") void refresh().catch(onError); }); return () => sub.remove(); }, [active, refresh, onError]);
}
