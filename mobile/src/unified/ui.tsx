import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

/** Ink and sakura tokens from the former web theme; light keeps the washi palette. */
const dark = {
  bg: "#0e0d10", header: "#131217", panel: "#17161c", raised: "#1d1c23", sunken: "#24222b",
  border: "#2e2b36", borderSoft: "#26232d", text: "#ece8f0", muted: "#a49dae", dim: "#756e80",
  accent: "#f2809f", accentStrong: "#ffa3bb", soft: "rgba(242, 128, 159, 0.14)", accentLine: "rgba(242, 128, 159, 0.38)",
  good: "#8fc9a0", goodSoft: "rgba(143, 201, 160, 0.14)", goodLine: "rgba(143, 201, 160, 0.32)",
  warn: "#e0a45c", warnSoft: "rgba(224, 164, 92, 0.14)", info: "#7fa8d9", infoSoft: "rgba(127, 168, 217, 0.14)", infoLine: "rgba(127, 168, 217, 0.32)",
  error: "#f2809f", onAccent: "#2a0c16", backdrop: "rgba(6, 5, 8, 0.6)", glow: "rgba(242, 128, 159, 0.08)", infoEnd: "#a9c8e8",
};
const light: typeof dark = {
  bg: "#f4f1ea", header: "#efece4", panel: "#ffffff", raised: "#faf8f3", sunken: "#f2eee6",
  border: "#ddd6c9", borderSoft: "#e7e1d6", text: "#23202a", muted: "#5d5768", dim: "#857e91",
  accent: "#d1567c", accentStrong: "#b23d63", soft: "rgba(209, 86, 124, 0.1)", accentLine: "rgba(209, 86, 124, 0.3)",
  good: "#3f8f5c", goodSoft: "rgba(63, 143, 92, 0.12)", goodLine: "rgba(63, 143, 92, 0.3)",
  warn: "#b7772a", warnSoft: "rgba(183, 119, 42, 0.12)", info: "#3c6fa8", infoSoft: "rgba(60, 111, 168, 0.12)", infoLine: "rgba(60, 111, 168, 0.3)",
  error: "#b23d63", onAccent: "#2a0c16", backdrop: "rgba(35, 32, 42, 0.4)", glow: "rgba(209, 86, 124, 0.06)", infoEnd: "#6d97c6",
};
export type Palette = typeof dark;
export const Theme = createContext<Palette>(dark);
export const palettes = { dark, light };
/** Phone layout flag for parts whose shape differs by device, such as sheets. */
export const Device = createContext({ phone: true });

export const fonts = {
  sans: Platform.select({ web: "Pretendard, \"Hiragino Sans\", \"Yu Gothic\", \"Malgun Gothic\", system-ui, sans-serif", default: undefined }),
  serif: Platform.select({ web: "\"Shippori Mincho\", \"Yu Mincho\", \"Nanum Myeongjo\", serif", default: "serif" }),
  mono: Platform.select({ web: "\"JetBrains Mono\", \"Cascadia Mono\", ui-monospace, monospace", default: "monospace" }),
};
/** CSS gradients: background-image on web, experimental_backgroundImage on Android. */
export function gradient(css: string): ViewStyle {
  return (Platform.OS === "web" ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}
export const primaryFill = (c: Palette) => gradient(`linear-gradient(120deg, ${c.accent}, ${c.accentStrong})`);

export const layout = StyleSheet.create({
  body: { padding: 20, paddingTop: 18, paddingBottom: 40, gap: 16, width: "100%", maxWidth: 1240, alignSelf: "center" },
  phoneBody: { padding: 14, paddingBottom: 26, gap: 12, width: "100%" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  stack: { gap: 10 },
});

type Tone = "text" | "muted" | "dim" | "accent" | "error" | "good";
/** Themed text; size follows the former rem scale (16px base). */
export function T({ children, tone = "text", size = 14, weight, mono = false, serif = false, style, selectable = false, numberOfLines }: {
  children: React.ReactNode; tone?: Tone; size?: number; weight?: TextStyle["fontWeight"]; mono?: boolean; serif?: boolean;
  style?: StyleProp<TextStyle>; selectable?: boolean; numberOfLines?: number;
}) {
  const c = useContext(Theme);
  return <Text selectable={selectable} numberOfLines={numberOfLines} style={[{ color: c[tone], fontSize: size, fontWeight: weight, fontFamily: mono ? fonts.mono : serif ? fonts.serif : fonts.sans, lineHeight: Math.round(size * 1.5) }, style]}>{children}</Text>;
}
export function Label({ children, muted = false, large = false, error = false }: { children: React.ReactNode; muted?: boolean; large?: boolean; error?: boolean }) {
  return <T selectable tone={error ? "error" : muted ? "muted" : "text"} size={large ? 17 : muted ? 13 : 14} weight={large ? "700" : undefined}>{children}</T>;
}

export function Card({ title, hint, actions, children, style }: { title?: React.ReactNode; hint?: string; actions?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useContext(Theme);
  return <View style={[{ borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel, padding: 16 }, style]}>
    {title ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <T size={14.7} weight="700">{title}</T>{hint ? <T size={11.8} tone="dim" weight="500">{hint}</T> : null}
      {actions ? <View style={{ marginLeft: "auto" }}>{actions}</View> : null}
    </View> : null}
    <View style={layout.stack}>{children}</View>
  </View>;
}

type Variant = "default" | "primary" | "ghost" | "danger";
/** Former jc-btn: default, primary gradient, ghost and danger variants; icon and large sizes. */
export function Btn({ title, onPress, variant = "default", size = "md", disabled = false, selected = false, testID, label, style, children }: {
  title?: string; onPress: () => void; variant?: Variant; size?: "md" | "icon" | "lg"; disabled?: boolean; selected?: boolean; testID?: string; label?: string;
  style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const c = useContext(Theme);
  const [hover, setHover] = useState(false);
  const tone = selected ? "danger" : variant;
  const fill = tone === "primary" ? primaryFill(c) : null;
  const color = tone === "primary" ? c.onAccent : tone === "danger" ? (selected ? c.accentStrong : c.accent) : c.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} testID={testID}
    onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={({ pressed }) => [{
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: size === "lg" ? 46 : 36, minWidth: size === "icon" ? 36 : undefined,
      paddingVertical: 7, paddingHorizontal: size === "icon" ? 7 : 13, borderRadius: 11, borderWidth: 1,
      borderColor: tone === "primary" ? "transparent" : tone === "danger" ? c.accentLine : hover && !disabled ? c.accentLine : c.border,
      backgroundColor: tone === "primary" ? c.accent : tone === "ghost" ? "transparent" : tone === "danger" ? c.soft : c.raised,
      opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
    }, fill, style]}>
    {children ?? <T size={size === "lg" ? 15.2 : size === "icon" ? 15 : 13.6} weight="600" style={{ color }}>{title}</T>}
  </Pressable>;
}
/** Kept for screens that only need a plain or selected button. */
export function Action({ title, onPress, disabled = false, selected = false, testID }: { title: string; onPress: () => void; disabled?: boolean; selected?: boolean; testID?: string }) {
  return <Btn title={title} onPress={onPress} disabled={disabled} selected={selected} testID={testID} />;
}

export type ChipTone = "review" | "learning" | "fail" | "pass" | "mute";
export function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const c = useContext(Theme);
  const [bg, fg, line] = tone === "review" ? [c.infoSoft, c.info, c.infoLine] : tone === "learning" || tone === "pass" ? [c.goodSoft, c.good, c.goodLine] : tone === "fail" ? [c.soft, c.accent, c.accentLine] : [c.sunken, c.muted, c.border];
  return <View style={{ alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: line, backgroundColor: bg }}><T size={11.4} weight="700" style={{ color: fg, lineHeight: 16 }}>{children}</T></View>;
}

export function Meter({ ratio, tone, label, value }: { ratio: number; tone?: "info"; label?: string; value?: string }) {
  const c = useContext(Theme);
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const bar = <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 7, borderRadius: 999, backgroundColor: c.sunken, overflow: "hidden" }}>
    <View style={[{ height: "100%", width: `${percent}%`, borderRadius: 999, backgroundColor: tone === "info" ? c.info : c.accent }, gradient(tone === "info" ? `linear-gradient(90deg, ${c.info}, ${c.infoEnd})` : `linear-gradient(90deg, ${c.accent}, ${c.accentStrong})`)]} />
  </View>;
  if (label === undefined) return bar;
  return <View style={{ gap: 6 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}><T size={12.8} tone="muted">{label}</T><T size={12.8} mono weight="600">{value}</T></View>{bar}</View>;
}

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
    <T size={12.5} tone="muted">{label}</T>
    <View style={{ width: 42, height: 24, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accentLine : c.border, backgroundColor: on ? c.soft : c.sunken }}>
      <View style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: on ? c.accent : c.dim }} />
    </View>
  </Pressable>;
}

export function CopyId({ id, onCopy }: { id: string; onCopy: (id: string) => void }) {
  const c = useContext(Theme);
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={`ID ${id} 복사`} onPress={() => onCopy(id)} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={{ paddingVertical: 2, paddingHorizontal: 7, borderRadius: 999, borderWidth: 1, borderColor: hover ? c.accentLine : c.border, backgroundColor: c.raised }}>
    <T size={11.2} mono tone={hover ? "accent" : "dim"} style={{ lineHeight: 16 }}>{id}</T>
  </Pressable>;
}

/** Former jc-segment: a compact one-of-many switch. */
export function Segment<K extends string | number>({ options, value, onChange }: { options: Array<{ key: K; label: string }>; value: K | null; onChange: (key: K) => void }) {
  const c = useContext(Theme);
  return <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", padding: 3, gap: 2, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.raised, alignSelf: "flex-start" }}>
    {options.map(option => <Pressable key={String(option.key)} accessibilityRole="radio" accessibilityState={{ checked: value === option.key }} onPress={() => onChange(option.key)}
      style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 7, backgroundColor: value === option.key ? c.soft : "transparent" }}>
      <T size={12.8} weight="600" style={{ color: value === option.key ? c.accentStrong : c.muted }}>{option.label}</T>
    </Pressable>)}
  </View>;
}

export function Input({ value, onChangeText, placeholder, label, multiline = false, testID, onBlur, autoFocus, style, sunken = false, onSubmit, secure = false }: {
  value: string; onChangeText: (value: string) => void; placeholder?: string; label?: string; multiline?: boolean; testID?: string; onBlur?: () => void;
  autoFocus?: boolean; style?: StyleProp<TextStyle>; sunken?: boolean; onSubmit?: () => void; secure?: boolean;
}) {
  const c = useContext(Theme);
  return <TextInput accessibilityLabel={label ?? placeholder} testID={testID} value={value} onChangeText={onChangeText} onBlur={onBlur} autoFocus={autoFocus} placeholder={placeholder}
    placeholderTextColor={c.dim} autoCapitalize="none" autoCorrect={false} spellCheck={false} multiline={multiline} secureTextEntry={secure} textAlignVertical={multiline ? "top" : "center"} onSubmitEditing={onSubmit}
    style={[{ minHeight: multiline ? 92 : 38, paddingVertical: multiline ? 10 : 7, paddingHorizontal: multiline ? 12 : 11, borderRadius: 11, borderWidth: 1, borderColor: c.border,
      backgroundColor: multiline || sunken ? c.header : c.raised, color: c.text, fontSize: multiline ? 13.8 : 14, lineHeight: multiline ? 22 : undefined, fontFamily: fonts.sans }, style]} />;
}
/** Former jc-field: a muted bold caption above an input. */
export function Field({ label, value, onChangeText, multiline = false, testID, onBlur, placeholder, style }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; testID?: string; onBlur?: () => void; placeholder?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap: 6 }, style]}><T size={13.1} tone="muted" weight="600">{label}</T><Input label={label} value={value} onChangeText={onChangeText} multiline={multiline} testID={testID} onBlur={onBlur} placeholder={placeholder} /></View>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  const c = useContext(Theme);
  return <View style={{ padding: 22, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: c.border, borderRadius: 11 }}><T size={13.4} tone="dim" style={{ textAlign: "center" }}>{children}</T></View>;
}
export function Spinner() {
  const c = useContext(Theme);
  return <ActivityIndicator size={12} color={c.accent} />;
}

/** Bottom sheet with a grip on phones and a centered dialog on PC, as in the former UI. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const c = useContext(Theme);
  const { phone } = useContext(Device);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <Modal transparent animationType={phone ? "slide" : "fade"} onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: c.backdrop, justifyContent: phone ? "flex-end" : "center", alignItems: phone ? "stretch" : "center", padding: phone ? 0 : 28 }}>
      <Pressable accessibilityLabel="닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityRole="none" aria-modal style={{ width: "100%", maxWidth: phone ? undefined : 680, maxHeight: phone ? "86%" : "78%", backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, borderBottomWidth: phone ? 0 : 1, borderRadius: phone ? 0 : 16, borderTopLeftRadius: phone ? 20 : 16, borderTopRightRadius: phone ? 20 : 16 }}>
        {phone && <View style={{ position: "absolute", top: 7, alignSelf: "center", width: 38, height: 4, borderRadius: 999, backgroundColor: c.border }} />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: c.borderSoft }}>
          <T size={15} weight="700" style={{ flex: 1 }}>{title}</T>{footer}<Btn variant="ghost" size="icon" title="×" label="닫기" onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 20, gap: 12 }}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

/** Dashed preview that turns into an editor; the decomposition memo needs a double press like before. */
export function MemoEditor({ label, value, onCommit, placeholder, render, requireDouble = false }: { label?: string; value: string; onCommit: (text: string) => void; placeholder: string; render: (text: string) => React.ReactNode; requireDouble?: boolean }) {
  const c = useContext(Theme);
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const lastTap = useRef(0);
  useEffect(() => { setDraft(value); setEditing(false); }, [value]);
  const open = () => {
    const now = Date.now();
    if (!requireDouble || now - lastTap.current < 400) setEditing(true);
    lastTap.current = now;
  };
  return <View style={{ gap: 6 }}>
    {label ? <T size={11.8} tone="dim" weight="600">{label}</T> : null}
    {editing ? <Input multiline autoFocus label={label} value={draft} onChangeText={setDraft} placeholder="Markdown으로 메모를 작성하세요." onBlur={() => { setEditing(false); if (draft !== value) onCommit(draft); }} />
      : <Pressable accessibilityRole="button" accessibilityLabel={(label ?? "메모") + " 편집"} onPress={open} style={{ minHeight: 44, paddingVertical: 11, paddingHorizontal: 13, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, borderRadius: 11, backgroundColor: c.header }}>
        {draft ? render(draft) : <T size={14} tone="dim">{placeholder}</T>}
      </Pressable>}
  </View>;
}
export function MarkdownBox({ text, placeholder, render }: { text: string; placeholder: string; render: (text: string) => React.ReactNode }) {
  const c = useContext(Theme);
  return <View style={{ minHeight: 44, paddingVertical: 11, paddingHorizontal: 13, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, borderRadius: 11, backgroundColor: c.header }}>{text ? render(text) : <T size={14} tone="dim">{placeholder}</T>}</View>;
}

/** Former pill toast: bottom center above the tab bar on phones, bottom right on PC. */
export function Toast({ text, tone, phone }: { text: string; tone?: string; phone: boolean }) {
  const c = useContext(Theme);
  return <View pointerEvents="none" style={[{ position: "absolute", zIndex: 90, bottom: phone ? 76 : 22, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: tone === "error" ? c.accentLine : c.border, backgroundColor: c.sunken, maxWidth: 460, boxShadow: "0 16px 38px rgba(0, 0, 0, 0.5)" } as ViewStyle, phone ? { alignSelf: "center", marginHorizontal: 16 } : { right: 22 }]}>
    <Text accessibilityRole={tone === "error" ? "alert" : "summary"} style={{ color: tone === "error" ? c.accent : c.text, fontSize: 13.4, fontWeight: "600", textAlign: "center", fontFamily: fonts.sans }}>{text}</Text>
  </View>;
}
