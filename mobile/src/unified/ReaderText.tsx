import React from "react";
import { Text } from "react-native";
import type { ProseWord } from "./readingWords";

/** Native prose; only registered words are pressable, punctuation and spacing stay unchanged. */
export function ReaderText({ tokens, color, accent, font, size = 20, onWord }: { tokens: ProseWord[]; color: string; accent: string; font: string; size?: number; onWord: (word: string) => void }) {
  return <Text style={{ color, fontFamily: font, fontSize: size, lineHeight: Math.round(size * 1.8) }}>
    {tokens.map((part, index) => part.word ? <Text key={index} accessible accessibilityRole="button" accessibilityLabel={`${part.text} 단어 조회`} onPress={() => onWord(part.text)} style={{ textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: accent }}>{part.text}</Text> : part.text)}
  </Text>;
}
