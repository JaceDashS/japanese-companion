import { useEffect, useState } from "react";
import { View } from "react-native";

export function StudySkeleton() {
  return <View accessibilityRole="progressbar" accessibilityLabel="학습 화면 불러오는 중" style={{ flex: 1, gap: 18, padding: 24 }}>
    <View style={{ height: 38, borderRadius: 10, width: "55%", backgroundColor: "#18223a" }} />
    {[0, 1, 2].map(row => <View key={row} style={{ height: 76, borderRadius: 14, backgroundColor: "#131c30" }} />)}
  </View>;
}

export function StudyProgress({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!pending || !visible) return null;
  return <View accessibilityRole="progressbar" accessibilityLabel="학습 자료 불러오는 중" style={{ height: 2, backgroundColor: "#253451" }}>
    <View style={{ width: "35%", height: 2, backgroundColor: "#6f9cff" }} />
  </View>;
}
