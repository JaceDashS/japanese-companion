import React, { createContext, useContext, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const dark = { bg: "#0e0d10", header: "#131217", panel: "#17161c", raised: "#1d1c23", text: "#ece8f0", muted: "#a49dae", border: "#2e2b36", accent: "#f2809f", soft: "#34212a", error: "#ff9292", good: "#8fc9a0" };
const light = { bg: "#f4f1ea", header: "#faf8f3", panel: "#ffffff", raised: "#f2eee6", text: "#23202a", muted: "#5d5768", border: "#ddd6c9", accent: "#b23d63", soft: "#f5e3e8", error: "#ad2626", good: "#3f8f5c" };
export const Theme = createContext(dark);
export const palettes = { dark, light };
export const layout = StyleSheet.create({
  body: { padding: 20, paddingBottom: 32, gap: 18, width: "100%", maxWidth: 1320, alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  stack: { gap: 12 },
});
export function Label({ children, muted = false, large = false, error = false }: { children: React.ReactNode; muted?: boolean; large?: boolean; error?: boolean }) {
  const c = useContext(Theme);
  return <Text selectable style={{ color: error ? c.error : muted ? c.muted : c.text, fontSize: large ? 21 : muted ? 13 : 15, lineHeight: large ? 30 : 23, fontWeight: large ? "700" : "400" }}>{children}</Text>;
}
export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  const c = useContext(Theme);
  return <View style={{ padding: 20, borderRadius: 18, gap: 14, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border }}>{title && <Label large>{title}</Label>}{children}</View>;
}
export function Action({ title, onPress, disabled = false, selected = false, testID }: { title: string; onPress: () => void; disabled?: boolean; selected?: boolean; testID?: string }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} testID={testID} style={({ pressed }) => ({ borderWidth: 1, backgroundColor: selected ? c.soft : c.raised, borderColor: selected ? c.accent : c.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, minHeight: 44, justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.7 : 1, maxWidth: "100%" })}><Text style={{ fontSize: 14, fontWeight: "600", color: selected ? c.accent : c.text, flexShrink: 1 }}>{title}</Text></Pressable>;
}
export function Field({ label, value, onChangeText, multiline = false, testID, onBlur }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; testID?: string; onBlur?: () => void }) {
  const c = useContext(Theme);
  return <View style={{ gap: 5 }}><Label muted>{label}</Label><TextInput accessibilityLabel={label} testID={testID} value={value} onChangeText={onChangeText} onBlur={onBlur} autoCapitalize="none" autoCorrect={false} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor={c.muted} style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, color: c.text, padding: 12, borderRadius: 10, minHeight: multiline ? 120 : 44, fontSize: 17 }} /></View>;
}
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const c = useContext(Theme);
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: "#0009", padding: 16, justifyContent: "center" }}><View style={{ backgroundColor: c.bg, maxHeight: "90%", width: "100%", maxWidth: 760, alignSelf: "center", borderRadius: 16, padding: 16, gap: 12 }}><View style={[layout.row, { justifyContent: "space-between" }]}><Label large>{title}</Label><Action title="닫기" onPress={onClose} /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.stack}>{children}</ScrollView></View></View></Modal>;
}
export function Meter({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const c = useContext(Theme);
  return <View style={{ gap: 5 }}><Label>{label} · {value}</Label><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(1, ratio)) * 100) }} style={{ height: 8, backgroundColor: c.border, borderRadius: 5 }}><View style={{ height: 8, backgroundColor: c.accent, width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, borderRadius: 5 }} /></View></View>;
}
/** Editable values use local drafts so moving between words cannot carry another word's note. */
export function Memo({ label, value, onSave, render }: { label: string; value: string; onSave: (text: string) => void; render: (text: string) => React.ReactNode }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(value); setEditing(false); }, [value]);
  return <Card title={label}>{editing ? <><Field label={label} value={draft} onChangeText={setDraft} multiline /><View style={layout.row}><Action title="저장" onPress={() => { onSave(draft); setEditing(false); }} /><Action title="취소" onPress={() => { setDraft(value); setEditing(false); }} /></View></> : <>{render(value)}<Action title={label + " 편집"} onPress={() => setEditing(true)} /></>}</Card>;
}
