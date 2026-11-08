import React, { useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { Theme } from "./ui";

export type Tab = "today" | "days" | "progress" | "settings";
const tabs = [
  { key: "today", title: "오늘", icon: "◐" },
  { key: "days", title: "Day", icon: "▤" },
  { key: "progress", title: "진행", icon: "◫" },
  { key: "settings", title: "설정", icon: "⚙" },
] as const;

/** Original top navigation on desktop, compact identity and bottom tabs on phones. */
export function Chrome({ desktop, tab, today, onNavigate, children }: {
  desktop: boolean; tab: Tab; today: string; onNavigate: (tab: Tab) => void; children: React.ReactNode;
}) {
  const c = useContext(Theme);
  const navigation = <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: desktop ? 8 : 0, flex: desktop ? undefined : 1 }}>
    {tabs.map(item => <Pressable key={item.key} accessibilityRole="tab" aria-selected={tab === item.key} accessibilityLabel={item.title} accessibilityState={{ selected: tab === item.key }} onPress={() => onNavigate(item.key)}
      style={({ pressed }) => ({ flex: desktop ? undefined : 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 52, paddingHorizontal: desktop ? 20 : 8, borderRadius: 14, backgroundColor: tab === item.key ? c.soft : "transparent", opacity: pressed ? 0.7 : 1 })}>
      {!desktop && <Text style={{ fontSize: 21, color: tab === item.key ? c.accent : c.muted }}>{item.icon}</Text>}
      <Text style={{ color: tab === item.key ? c.accent : c.muted, fontWeight: "700", fontSize: desktop ? 15 : 12 }}>{item.title}</Text>
    </Pressable>)}
  </View>;
  return <View style={{ flex: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: desktop ? 28 : 18, minHeight: desktop ? 76 : 70, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.soft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accent, fontSize: 22, fontWeight: "700" }}>和</Text></View>
      <View style={{ flex: desktop ? undefined : 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 17 }}>{desktop ? "Japanese Companion" : tabs.find(item => item.key === tab)?.title}</Text>{!desktop && <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>Japanese Companion · {today}</Text>}</View>
      {desktop && <>{navigation}<Text style={{ color: c.muted, fontSize: 13, marginLeft: "auto" }}>{today}</Text></>}
    </View>
    <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    {!desktop && <View style={{ flexDirection: "row", padding: 6, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.header }}>{navigation}</View>}
  </View>;
}
