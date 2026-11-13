import React, { useContext, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { fonts, T, Theme } from "./ui";

export type Tab = "today" | "days" | "progress" | "settings";
const tabs = [
  { key: "today", title: "오늘", heading: "오늘 할 학습", icon: "◐" },
  { key: "days", title: "Day", heading: "Day 선택", icon: "▤" },
  { key: "progress", title: "진행", heading: "전체 진행률", icon: "◫" },
  { key: "settings", title: "설정", heading: "설정", icon: "⚙" },
] as const;

function BrandMark() {
  return <Image source={require("../../assets/icon.png")} accessibilityLabel="Japanese Companion" resizeMode="contain" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }} />;
}

function TopTab({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  const c = useContext(Theme);
  const [hover, setHover] = useState(false);
  return <Pressable accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} accessibilityLabel={title} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: active ? c.accentLine : "transparent", backgroundColor: active ? c.soft : "transparent" }}>
    <T size={13.8} weight="600" style={{ color: active ? c.accentStrong : hover ? c.text : c.muted }}>{title}</T>
  </Pressable>;
}

/** PC top bar with the due count, phone header with bottom tab bar and due badge, as in the former shell. */
export function Chrome({ desktop, tab, today, dueCount, onNavigate, children }: {
  desktop: boolean; tab: Tab; today: string; dueCount: number; onNavigate: (tab: Tab) => void; children: React.ReactNode;
}) {
  const c = useContext(Theme);
  const current = tabs.find(item => item.key === tab) ?? tabs[0];
  return <View style={{ flex: 1 }}>
    {desktop ? <View accessibilityRole="header" style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><BrandMark /><T size={15.2} weight="700">Japanese Companion</T></View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 2 }}>
        {tabs.map(item => <TopTab key={item.key} active={tab === item.key} onPress={() => onNavigate(item.key)} title={item.title + (item.key === "today" && dueCount > 0 ? ` · ${dueCount}` : "")} />)}
      </View>
      <T size={12.2} tone="dim" style={{ marginLeft: "auto" }}>{today}</T>
    </View> : <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: c.borderSoft, backgroundColor: c.bg }}>
      <BrandMark />
      <View style={{ minWidth: 0, flex: 1 }}><T size={16} weight="700" numberOfLines={1}>{current.heading}</T><T size={11.5} tone="dim">{today}</T></View>
    </View>}
    <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    {!desktop && <View accessibilityRole="tablist" style={{ height: 58, flexDirection: "row", borderTopWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      {tabs.map(item => {
        const active = tab === item.key;
        return <Pressable key={item.key} accessibilityRole="tab" aria-selected={active} accessibilityLabel={item.title} accessibilityState={{ selected: active }} onPress={() => onNavigate(item.key)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 6 }}>
          <View>
            <T size={18} style={{ color: active ? c.accent : c.dim, lineHeight: 20, fontFamily: fonts.sans }}>{item.icon}</T>
            {item.key === "today" && dueCount > 0 && <View style={{ position: "absolute", left: 12, top: -8, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><T size={9.9} weight="800" style={{ color: c.onAccent, lineHeight: 12 }}>{dueCount}</T></View>}
          </View>
          <T size={10.9} weight="600" style={{ color: active ? c.accent : c.dim, lineHeight: 14 }}>{item.title}</T>
        </Pressable>;
      })}
    </View>}
  </View>;
}
