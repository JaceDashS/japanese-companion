import React from "react";
import type { ProseWord } from "./readingWords";

/** Inline native HTML buttons for registered words; other text is plain and not selectable as a word. */
export function ReaderText({ tokens, color, accent, font, size = 20, onWord }: { tokens: ProseWord[]; color: string; accent: string; font: string; size?: number; onWord: (word: string) => void }) {
  return <><style>{`.reading-word { text-decoration: underline dotted; text-decoration-color: ${accent}; text-underline-offset: 5px; text-decoration-thickness: 1.5px; } .reading-word:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; } .reading-word:hover { color: ${accent}; }`}</style>
    <p style={{ color, fontFamily: font, fontSize: size, lineHeight: `${Math.round(size * 1.8)}px`, whiteSpace: "pre-wrap", lineBreak: "strict", wordBreak: "normal", overflowWrap: "anywhere", margin: 0 }}>
      {tokens.map((part, index) => part.word ? <button className="reading-word" key={index} type="button" aria-label={`${part.text} 단어 조회`} onClick={() => onWord(part.text)} style={{ display: "inline", font: "inherit", color: "inherit", lineHeight: "inherit", background: "transparent", border: 0, padding: 0, margin: 0, cursor: "pointer" }}>{part.text}</button> : part.text)}
    </p></>;
}
