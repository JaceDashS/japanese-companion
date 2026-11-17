import type { ProseWord } from "./readingWords";

/** One page of prose: its tokens and the character range [start, end) of the book body it covers. */
export interface ReadingPage { tokens: ProseWord[]; start: number; end: number }

/**
 * Split prose tokens into pages of about targetChars characters. A page ends at a paragraph break, then a line
 * break, then a sentence end near the target; selectable words are never split. Positions are character offsets
 * into the body, so a saved position opens the same text on any screen size.
 */
export function paginate(tokens: readonly ProseWord[], targetChars: number): ReadingPage[] {
  const pages: ReadingPage[] = [];
  let current: ProseWord[] = [];
  let start = 0;
  let offset = 0;
  let size = 0;
  const close = () => {
    // Leading line breaks of a new page carry no text worth showing.
    while (current.length && !current[0].word && /^\s*$/.test(current[0].text)) current.shift();
    if (current.length && !current[0].word) current[0] = { ...current[0], text: current[0].text.replace(/^\n+/, "") };
    if (current.length) pages.push({ tokens: current, start, end: offset });
    current = []; size = 0; start = offset;
  };
  for (const token of tokens) {
    if (token.word) {
      if (size >= targetChars) close();
      current.push(token); size += token.text.length; offset += token.text.length;
      continue;
    }
    let rest = token.text;
    while (rest) {
      if (size + rest.length <= targetChars) { current.push({ text: rest, word: false }); size += rest.length; offset += rest.length; break; }
      const from = Math.max(0, Math.floor(targetChars * 0.6) - size);
      const limit = Math.max(from + 1, Math.floor(targetChars * 1.15) - size);
      const window = rest.slice(0, limit);
      const cut = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), Math.max(...["。", "！", "？", ". ", "! ", "? "].map(mark => { const at = window.lastIndexOf(mark); return at < 0 ? -1 : at + mark.length - 1; }))]
        .find(at => at >= from) ?? -1;
      const take = cut >= 0 ? cut + 1 : size >= targetChars * 0.6 ? 0 : Math.max(1, targetChars - size);
      if (take > 0) { current.push({ text: rest.slice(0, take), word: false }); offset += take; size += take; rest = rest.slice(take); }
      close();
    }
  }
  close();
  return pages;
}

/** Index of the page containing a character offset; offsets past the end open the last page. */
export function pageAt(pages: readonly ReadingPage[], offset: number): number {
  let index = 0;
  for (let at = 0; at < pages.length; at++) if (pages[at].start <= offset) index = at;
  return index;
}

/** First page of the spread that shows the given page: pages pair as (0,1), (2,3) in two-page view. */
export function spreadStart(page: number, spread: 1 | 2): number {
  return spread === 2 ? page - (page % 2) : page;
}

/** Add or remove a bookmark at a character offset, keeping the list sorted and unique. */
export function toggleBookmark(bookmarks: readonly number[], offset: number, pages: readonly ReadingPage[]): number[] {
  const page = pageAt(pages, offset);
  const onPage = bookmarks.filter(mark => pageAt(pages, mark) === page);
  if (onPage.length) return bookmarks.filter(mark => !onPage.includes(mark));
  return [...new Set([...bookmarks, pages[page]?.start ?? offset])].sort((a, b) => a - b);
}
