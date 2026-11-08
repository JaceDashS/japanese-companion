import React, { useContext } from "react";
import { Text, View } from "react-native";
import { Card, Label, Theme } from "./ui";

/** Compact dashboard totals reflow without changing the study model. */
export function Stats({ items }: { items: { label: string; value: string; detail: string }[] }) {
  const c = useContext(Theme);
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
    {items.map(item => <View key={item.label} style={{ flexGrow: 1, flexBasis: 140, padding: 18, gap: 6, backgroundColor: c.panel, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{item.label}</Text><Text style={{ color: c.accent, fontSize: 30, fontWeight: "700" }}>{item.value}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{item.detail}</Text>
    </View>)}
  </View>;
}

/** The original vertical stage chart, using accessible native primitives. */
export function StageChart({ stages }: { stages: { label: string; count: number }[] }) {
  const c = useContext(Theme);
  const maximum = Math.max(1, ...stages.map(item => item.count));
  return <Card title="복습 회차 분포"><View style={{ flexDirection: "row", gap: 12 }}>
    {stages.map((item, index) => <View key={item.label} accessibilityLabel={`${item.label} ${item.count}개`} style={{ flex: 1, gap: 7, alignItems: "center" }}>
      <Text style={{ fontSize: 12, color: c.muted }}>{item.count}</Text>
      <View style={{ height: 98, width: "100%", maxWidth: 38, borderRadius: 7, backgroundColor: c.raised, justifyContent: "flex-end", overflow: "hidden" }}><View style={{ height: `${item.count / maximum * 100}%`, minHeight: item.count ? 4 : 0, backgroundColor: index === 0 ? c.accent : c.good, borderRadius: 7 }} /></View>
      <Label muted>{item.label}</Label>
    </View>)}
  </View></Card>;
}
