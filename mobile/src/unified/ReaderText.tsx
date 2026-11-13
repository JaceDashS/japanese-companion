import React from "react";
import { Text } from "react-native";
import type { ProseWord } from "./readingWords";

/** Native prose with accessible word actions and unchanged punctuation. */
export function ReaderText({ tokens, color, font, onWord }: { tokens: ProseWord[]; color: string; font: string; onWord: (word: string) => void }) {
  return <Text style={{ color, fontFamily: font, fontSize: 20, lineHeight: 36 }}>
    {tokens.map((part, index) => part.word ? <Text key={index} accessible accessibilityRole="button" accessibilityLabel={`${part.text} 단어 조회`} onPress={() => onWord(part.text)}>{part.text}</Text> : part.text)}
  </Text>;
}
