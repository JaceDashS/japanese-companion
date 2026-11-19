import React from "react";
import type { ProseWord } from "./readingWords";

/**
 * Inline native HTML buttons for registered words; other text is plain. Words carry no underline or other mark, so the
 * page reads like a book, and its text can be selected without showing a caret.
 */
export function ReaderText({ tokens, color, font, size = 20, onWord }: { tokens: ProseWord[]; color: string; accent: string; font: string; size?: number; onWord: (word: string) => void }) {
  return <><style>{`.reading-prose { caret-color: transparent; cursor: default; -webkit-tap-highlight-color: transparent; } .reading-word { cursor: pointer; user-select: text; -webkit-user-select: text; } .reading-word:focus { outline: none; } .reading-word:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; }`}</style>
    <p className="reading-prose" style={{ color, fontFamily: font, fontSize: size, lineHeight: `${Math.round(size * 1.8)}px`, whiteSpace: "pre-wrap", lineBreak: "strict", wordBreak: "normal", overflowWrap: "anywhere", margin: 0 }}>
      {tokens.map((part, index) => part.word ? <button className="reading-word" key={index} type="button" aria-label={`${part.text} 단어 조회`} onClick={() => onWord(part.text)} style={{ display: "inline", font: "inherit", color: "inherit", lineHeight: "inherit", background: "transparent", border: 0, padding: 0, margin: 0 }}>{part.text}</button> : part.text)}
    </p></>;
}
