import React, { useContext, useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { T, Theme } from "./ui";
import { completionLines, type Completion } from "./completionText";

export type { Completion } from "./completionText";

const FADE_IN = 260;
const HOLD = 1900;
const FADE_OUT = 480;

/**
 * Heads-up display in the middle of the home screen after a quiz: it fades in, stays briefly and fades out.
 * It never takes touches or clicks, so the screen underneath keeps working the whole time.
 */
export function CompletionHud({ completion, today, onDone }: { completion: Completion | null; today: string; onDone: () => void }) {
  const c = useContext(Theme);
  const opacity = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!completion) return;
    opacity.setValue(0); pop.setValue(0);
    const lines = completionLines(completion, today);
    AccessibilityInfo.announceForAccessibility?.([lines.title, lines.detail, lines.next].filter(Boolean).join(". "));
    const run = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: FADE_IN, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false }),
      ]),
      Animated.delay(HOLD),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]);
    run.start(({ finished }) => { if (finished) done.current(); });
    return () => run.stop();
  }, [completion?.id]);
  if (!completion) return null;
  const lines = completionLines(completion, today);
  const tone = completion.allPass ? { fg: c.good, soft: c.goodSoft, line: c.goodLine } : { fg: c.warn, soft: c.warnSoft, line: c.warn };
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
    <Animated.View testID="completion-hud" accessibilityLiveRegion="polite" style={{ opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }], alignItems: "center", gap: 10, minWidth: 220, maxWidth: 340, paddingVertical: 22, paddingHorizontal: 26, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
      <Animated.View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: tone.line, backgroundColor: tone.soft, alignItems: "center", justifyContent: "center", transform: [{ scale }] }}>
        <T size={completion.allPass ? 30 : 28} weight="800" style={{ color: tone.fg, lineHeight: 36 }}>{completion.allPass ? "✓" : "!"}</T>
      </Animated.View>
      <T size={17} weight="700" style={{ textAlign: "center" }}>{lines.title}</T>
      {!!lines.detail && <T size={13} tone="muted" style={{ textAlign: "center" }}>{lines.detail}</T>}
      {!!lines.next && <T size={13} weight="600" style={{ color: tone.fg, textAlign: "center" }}>{lines.next}</T>}
    </Animated.View>
  </View>;
}
