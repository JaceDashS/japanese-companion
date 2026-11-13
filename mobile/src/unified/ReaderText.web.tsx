import React from "react";
import type { ProseWord } from "./readingWords";

/** Inline native HTML buttons support keyboard activation without changing prose spacing. */
export function ReaderText({ tokens, color, font, onWord }: { tokens: ProseWord[]; color: string; font: string; onWord: (word: string) => void }) {
  return <><style>{`.reading-word:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: 2px; } .reading-word:hover { text-decoration: underline; text-underline-offset: 4px; }`}</style>
    <p style={{ color, fontFamily: font, fontSize: 20, lineHeight: "36px", whiteSpace: "pre-wrap", lineBreak: "strict", wordBreak: "normal", overflowWrap: "anywhere", margin: 0 }}>
      {tokens.map((part, index) => part.word ? <button className="reading-word" key={index} type="button" aria-label={`${part.text} 단어 조회`} onClick={() => onWord(part.text)} style={{ display: "inline", font: "inherit", color: "inherit", lineHeight: "inherit", background: "transparent", border: 0, padding: 0, margin: 0, cursor: "pointer" }}>{part.text}</button> : part.text)}
    </p></>;
}
