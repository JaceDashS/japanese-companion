import React, { useContext, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { Btn, Empty, fonts, MarkdownBox, Sheet, T, Theme } from "./ui";
import { relatedMemos, type FuriganaSegment, type MemoEntry } from "./japaneseWords";

/** Lets the reading box keep its full width (word plus a margin on each side) so the reading centers on the word. */
const RUBY_WIDTH = (Platform.OS === "web" ? { maxWidth: "none" } : {}) as TextStyle;

/**
 * Problem sentence with readings over its kanji groups. Readings sit in a reserved row above the text and never
 * change the sentence width or height, so switching them on or off moves nothing. Any reading that overlaps the
 * target, or that is the answer, stays hidden until the question is answered.
 */
export function FuriganaSentence({ segments, target, answer, showReadings, revealTarget, size }: { segments: FuriganaSegment[]; target: string; answer: string; showReadings: boolean; revealTarget: boolean; size: number }) {
  const c = useContext(Theme);
  const sentence = segments.map((segment) => segment.text).join("");
  const start = target ? sentence.indexOf(target) : -1;
  const end = start < 0 ? -1 : start + target.length;
  const cells: Array<{ text: string; reading: string; inTarget: boolean; hidden: boolean }> = [];
  let offset = 0;
  for (const segment of segments) {
    const segmentStart = offset;
    offset += segment.text.length;
    if (segment.reading) {
      const inTarget = start >= 0 && segmentStart < end && offset > start;
      const revealsAnswer = !!answer && (segment.reading === answer || answer.includes(segment.reading) || (start < 0 && !!target && target.includes(segment.text)));
      cells.push({ text: segment.text, reading: segment.reading, inTarget, hidden: inTarget || revealsAnswer });
      continue;
    }
    // Plain text is laid out per character so long kana runs still wrap.
    [...segment.text].forEach((char, index) => {
      const position = segmentStart + index;
      cells.push({ text: char, reading: "", inTarget: start >= 0 && position >= start && position < end, hidden: false });
    });
  }
  const rubySize = size * 0.45;
  return <View accessibilityLabel={sentence} style={{ paddingVertical: 20, paddingHorizontal: 18, borderWidth: 1, borderColor: c.border, borderRadius: 16, backgroundColor: c.panel, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
    {cells.map((cell, index) => <View key={index} style={{ paddingTop: rubySize * 1.35 }}>
      {/* numberOfLines adds max-width: 100% on web, which shrinks the box to the word and centers the reading on its left edge. */}
      {!!cell.reading && <Text numberOfLines={1} style={{ ...RUBY_WIDTH, position: "absolute", top: 0, left: -size, right: -size, textAlign: "center", fontSize: rubySize, lineHeight: rubySize * 1.35, color: c.accent, opacity: showReadings && (!cell.hidden || revealTarget) ? 1 : 0, fontFamily: fonts.sans }}>{cell.reading}</Text>}
      <Text selectable style={[{ fontSize: size, lineHeight: size * 1.45, color: cell.inTarget ? c.accent : c.text, fontFamily: fonts.serif }, cell.inTarget ? { textDecorationLine: "underline", textDecorationColor: c.accentLine } : null]}>{cell.text}</Text>
    </View>)}
  </View>;
}

/** Reads stored furigana from the item's problem; edited problems have none. */
export function problemFurigana(problem: unknown): FuriganaSegment[] | null {
  const value = problem && typeof problem === "object" ? (problem as { furigana?: unknown }).furigana : null;
  if (!Array.isArray(value) || value.length === 0) return null;
  const segments = value.filter((segment): segment is FuriganaSegment => Boolean(segment) && typeof segment === "object" && typeof (segment as FuriganaSegment).text === "string");
  return segments.length === value.length ? segments : null;
}

/** Memos of words sharing a kanji with the current word: pick one from the list to read it. */
export function RelatedNotes({ expression, memos, onClose, render }: { expression: string; memos: readonly MemoEntry[]; onClose: () => void; render: (text: string) => React.ReactNode }) {
  const c = useContext(Theme);
  const related = useMemo(() => relatedMemos(expression, memos), [expression, memos]);
  const [picked, setPicked] = useState<MemoEntry | null>(null);
  return <Sheet title={picked ? `${picked.expression} 노트` : `${expression} 관련 노트`} onClose={onClose}>
    {picked ? <View style={{ gap: 10 }}>
      <T size={24} serif weight="700">{picked.expression}</T>
      {!!picked.reading && <T tone="muted">{picked.reading}</T>}
      {!!picked.meaningKo && <T>{picked.meaningKo}</T>}
      <MarkdownBox text={picked.memo} placeholder="메모 없음" render={render} />
      <View style={{ flexDirection: "row" }}><Btn title="목록으로" onPress={() => setPicked(null)} /></View>
    </View> : related.length === 0 ? <Empty>한자를 공유하는, 메모가 있는 단어가 없습니다.</Empty> : <View style={{ gap: 6 }}>
      {related.map((entry) => <Pressable key={entry.expression} accessibilityRole="button" accessibilityLabel={`${entry.expression} 노트 보기`} onPress={() => setPicked(entry)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.panel }}>
        <T size={18} serif>{entry.expression}</T>
        <T size={13} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{[entry.reading, entry.meaningKo].filter(Boolean).join(" · ")}</T>
      </Pressable>)}
    </View>}
  </Sheet>;
}
