function hasOwn(obj: unknown, key: "word" | "kanji"): boolean {
  return Boolean(obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key));
}

export function assertNoDisallowedExpressionKeys(item: unknown, context = "item"): void {
  const hasWord = hasOwn(item, "word");
  const hasKanji = hasOwn(item, "kanji");
  if (hasWord || hasKanji) {
    const foundKeys = [hasWord ? "word" : null, hasKanji ? "kanji" : null].filter(Boolean).join(",");
    throw new Error(`${context}: disallowed keys detected [${foundKeys}]. Use "expression" only.`);
  }
}

export function getExpressionStrict(item: unknown, context = "item"): string {
  assertNoDisallowedExpressionKeys(item, context);
  const expression = typeof (item as { expression?: unknown })?.expression === "string"
    ? (item as { expression: string }).expression.trim()
    : "";
  if (!expression) {
    throw new Error(`${context}: missing required "expression".`);
  }
  return expression;
}

/** Canonical memo key for Japanese expressions: NFKC normalized with parenthesized context removed. */
export function japaneseMemoKey(expression: string): string {
  const normalized = expression.normalize("NFKC").trim();
  const stripped = normalized.replace(/[(（][^()（）]*[)）]/g, "").trim();
  return stripped || normalized;
}
