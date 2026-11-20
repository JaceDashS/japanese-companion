import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { T, Theme } from "./ui";

export type DropdownAction = {
  key: string;
  title: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
};

export type AnchorRect = { x: number; y: number; width: number; height: number };

/** Compute clamped dropdown coordinates anchored below the trigger button. */
export function computeDropdownPosition(
  anchor: AnchorRect | null,
  viewport: { width: number; height: number },
  itemCount: number,
): { left: number; top: number; width: number } {
  const margin = 12;
  const width = Math.min(220, Math.max(168, viewport.width - margin * 2));
  const estimatedHeight = Math.max(1, itemCount) * 46 + 12;
  if (!anchor || anchor.width <= 0 || anchor.height <= 0) {
    return {
      left: Math.max(margin, viewport.width - width - margin),
      top: Math.max(margin, Math.min(120, viewport.height - estimatedHeight - margin)),
      width,
    };
  }
  const preferredLeft = anchor.x + anchor.width - width;
  const left = Math.max(margin, Math.min(preferredLeft, viewport.width - width - margin));
  const below = anchor.y + anchor.height + 6;
  const fitsBelow = below + estimatedHeight <= viewport.height - margin;
  const above = anchor.y - estimatedHeight - 6;
  const top = fitsBelow ? below : Math.max(margin, above >= margin ? above : viewport.height - estimatedHeight - margin);
  return { left, top, width };
}

/** Single trigger button that opens an animated dropdown menu of actions on mobile. */
export function ActionDropdown({ label = "메뉴", accessibilityLabel = "교재 작업 메뉴", actions, disabled = false, testID = "material-actions-trigger" }: {
  label?: string;
  accessibilityLabel?: string;
  actions: readonly DropdownAction[];
  disabled?: boolean;
  testID?: string;
}) {
  const c = useContext(Theme);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const triggerRef = useRef<React.ComponentRef<typeof View>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hoverTrigger, setHoverTrigger] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const closingRef = useRef(false);
  const hideChevron = label === "⋯";
  const unavailable = disabled || actions.length === 0;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; sub.remove(); };
  }, []);

  const finishClose = useCallback((after?: () => void) => {
    closingRef.current = false;
    setOpen(false);
    setHoveredKey(null);
    after?.();
  }, []);

  const closeMenu = useCallback((after?: () => void) => {
    if (!open || closingRef.current) return;
    if (reducedMotion) {
      progress.setValue(0);
      finishClose(after);
      return;
    }
    closingRef.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: 130,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => finishClose(after));
  }, [finishClose, open, progress, reducedMotion]);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMenu, open]);

  const openMenu = () => {
    if (open || unavailable) return;
    const present = (rect: AnchorRect | null) => {
      setAnchor(rect);
      closingRef.current = false;
      setOpen(true);
      if (reducedMotion) {
        progress.setValue(1);
      } else {
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    };
    const node = triggerRef.current;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => present({ x, y, width, height }));
    } else {
      present(null);
    }
  };

  const pos = computeDropdownPosition(anchor, { width: viewportWidth, height: viewportHeight }, actions.length);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open, disabled: unavailable }}
          disabled={unavailable}
          onPress={() => (open ? closeMenu() : openMenu())}
          onHoverIn={() => setHoverTrigger(true)}
          onHoverOut={() => setHoverTrigger(false)}
          testID={testID}
          style={({ pressed }) => ({
            minHeight: 44,
            paddingHorizontal: hideChevron ? 12 : 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: open || hoverTrigger ? c.accentLine : c.border,
            backgroundColor: open ? c.soft : c.panel,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: unavailable ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <T size={13.6} weight="600" style={{ color: open ? c.accentStrong : c.text }}>{label}</T>
          {!hideChevron && <T size={12} style={{ color: open ? c.accentStrong : c.muted }}>{open ? "▴" : "▾"}</T>}
        </Pressable>
      </View>

      {open && (
        <Modal transparent animationType="none" onRequestClose={() => closeMenu()}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable accessibilityLabel="메뉴 닫기" onPress={() => closeMenu()} style={StyleSheet.absoluteFill} />
            <Animated.View
              accessibilityRole="menu"
              style={[
                {
                  position: "absolute",
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  padding: 6,
                  gap: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.panel,
                  elevation: 10,
                  opacity: progress,
                  transform: [
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                  ],
                },
                Platform.OS === "web" ? ({ boxShadow: "0 14px 32px rgba(0, 0, 0, 0.35)" } as unknown as ViewStyle) : null,
              ]}
            >
              {actions.map((item) => {
                const hovered = hoveredKey === item.key;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="menuitem"
                    accessibilityLabel={item.title}
                    accessibilityState={{ disabled: Boolean(item.disabled) }}
                    disabled={item.disabled}
                    testID={item.testID}
                    onHoverIn={() => setHoveredKey(item.key)}
                    onHoverOut={() => setHoveredKey((current) => (current === item.key ? null : current))}
                    onPress={() => closeMenu(item.onPress)}
                    style={({ pressed }) => ({
                      minHeight: 42,
                      justifyContent: "center",
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: pressed || hovered ? c.soft : c.raised,
                      opacity: item.disabled ? 0.45 : 1,
                    })}
                  >
                    <T size={13.6} weight="600" style={{ color: hovered ? c.accentStrong : c.text }}>{item.title}</T>
                  </Pressable>
                );
              })}
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
}
