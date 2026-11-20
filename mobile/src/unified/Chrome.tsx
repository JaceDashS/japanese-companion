import React, { useContext, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { fonts, Segment, T, Theme } from "./ui";

export type Tab = "today" | "days" | "progress" | "settings";
export type HeaderSection = "vocabulary" | "bookshelf";
const tabs = [
  { key: "today", title: "오늘", heading: "오늘 할 학습", icon: "◐" },
  { key: "days", title: "Day", heading: "Day 선택", icon: "▤" },
  { key: "progress", title: "진행", heading: "전체 진행률", icon: "◫" },
  { key: "settings", title: "설정", heading: "설정", icon: "⚙" },
] as const;

function BrandMark() {
  return <Image source={require("../../assets/icon.png")} accessible={false} resizeMode="contain" style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0 }} />;
}

/** App icon and name; pressing either returns to the home screen (today's study). */
function Brand({ phone, today, onHome, compact }: { phone: boolean; today?: string; onHome: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="link" accessibilityLabel="Japanese Companion 홈" onPress={onHome} testID="brand-home" style={{ flexDirection: "row", alignItems: "center", gap: phone ? 8 : 9, minWidth: 0, flexShrink: 1 }}>
    <BrandMark />
    <View style={{ minWidth: 0, flexShrink: 1 }}>
      <T size={phone ? 15.5 : 15.2} weight="700" numberOfLines={1}>{compact ? "Japanese" : "Japanese Companion"}</T>
      {!!today && <T size={11.5} tone="dim">{today}</T>}
    </View>
  </Pressable>;
}

function HubButton({ onPress }: { onPress: () => void }) {
  const c = useContext(Theme);
  return <Pressable accessibilityRole="button" accessibilityLabel="통합 메인으로" onPress={onPress} testID="hub-return"
    style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.raised, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <T size={16} weight="700" style={{ color: c.text, lineHeight: 18 }}>⊞</T>
  </Pressable>;
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
export function Chrome({ desktop, section, onSectionChange, tab, today, dueCount, onNavigate, onHome, onOpenHub, adSlot, children }: {
  desktop: boolean; section: HeaderSection; onSectionChange: (section: HeaderSection) => void; tab: Tab; today: string; dueCount: number; onNavigate: (tab: Tab) => void; onHome: () => void; onOpenHub?: () => void; adSlot?: React.ReactNode; children: React.ReactNode;
}) {
  const c = useContext(Theme);
  // Segment aligns itself to the top; the header row centers it vertically.
  const sectionSwitch = <View style={{ alignSelf: "center", flexShrink: 0 }}><Segment options={[{ key: "vocabulary", label: "단어장" }, { key: "bookshelf", label: "책장" }]} value={section} onChange={value => onSectionChange(value as HeaderSection)} /></View>;
  return <View style={{ flex: 1 }}>
    {desktop ? <View accessibilityRole="header" style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      {onOpenHub && <HubButton onPress={onOpenHub} />}
      <Brand phone={false} onHome={onHome} />
      {sectionSwitch}
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 2 }}>
        {tabs.map(item => <TopTab key={item.key} active={section === "vocabulary" ? tab === item.key : item.key === "settings" && tab === "settings"} onPress={() => { if (item.key !== "settings") onSectionChange("vocabulary"); onNavigate(item.key); }} title={item.title + (item.key === "today" && dueCount > 0 ? ` · ${dueCount}` : "")} />)}
      </View>
      <T size={12.2} tone="dim" style={{ marginLeft: "auto" }}>{today}</T>
    </View> : <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: c.borderSoft, backgroundColor: c.bg }}>
      {onOpenHub && <HubButton onPress={onOpenHub} />}
      <View style={{ minWidth: 0, flex: 1, flexDirection: "row" }}><Brand phone today={today} onHome={onHome} compact={Boolean(onOpenHub)} /></View>
      {sectionSwitch}
    </View>}
    <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    {adSlot}
    {!desktop && <View accessibilityRole="tablist" style={{ height: 58, flexDirection: "row", borderTopWidth: 1, borderColor: c.border, backgroundColor: c.header }}>
      {tabs.map(item => {
        const active = section === "vocabulary" ? tab === item.key : item.key === "settings" && tab === "settings";
        return <Pressable key={item.key} accessibilityRole="tab" aria-selected={active} accessibilityLabel={item.title} accessibilityState={{ selected: active }} onPress={() => { if (item.key !== "settings") onSectionChange("vocabulary"); onNavigate(item.key); }}
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
