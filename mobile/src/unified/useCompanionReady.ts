import { useEffect } from "react";
import { Platform } from "react-native";

const startedAt = performance.now();
let recorded = false;

export function useCompanionReady(ready: boolean) {
  useEffect(() => {
    if (!ready || recorded) return;
    let paint = 0;
    // The second frame runs after the committed study screen has had a chance to paint.
    const frame = requestAnimationFrame(() => {
      paint = requestAnimationFrame(() => {
        if (recorded) return;
        recorded = true;
        if (Platform.OS === "web") performance.mark("companion:ready");
        else if (__DEV__) console.info("companion:ready", Math.round(performance.now() - startedAt), "ms");
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(paint);
    };
  }, [ready]);
}
