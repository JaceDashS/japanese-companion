import { StudyMarkdown } from "../StudyMarkdown";
import { client } from "./runtime";
import { ActionDropdown } from "./ActionDropdown";
import { BookSelect } from "./BookSelect";
import { bookImportPrompt, importBookFromClipboard, importBookJson, type BookImportOutcome } from "./bookImport";
import { ReaderText } from "./ReaderText";
import { pageAt, paginate, spreadStart, toggleBookmark, type ReadingPage } from "./readingPagination";
import * as storage from "./storage";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from "react-native";
import { Btn, Card, Device, Empty, Input, Segment, Sheet, T, Theme, fonts } from "./ui";
import { EMPTY_READING, proseTokens, wordKey, type LibraryApi, type LibraryBook, type ReadingSection, type ReadingState, type WordDetail } from "./readingWords";

type Notify = (text: string, tone?: string) => void;
type Language = "ja" | "en";
const SPREAD_KEY = "jpc-reading-spread-v1";
/** Characters per page; a two-page spread shows two such pages side by side. */
const PAGE_CHARS: Record<Language, { phone: number; pc: number }> = { ja: { phone: 220, pc: 380 }, en: { phone: 420, pc: 700 } };
const errorText = (cause: unknown, fallback: string) => cause instanceof Error && cause.message ? cause.message : fallback;

/** Centered loading indicator used while a screen or sheet waits for the server. */
export function Loading({ text = "불러오는 중…" }: { text?: string }) {
  const c = useContext(Theme);
  return <View accessibilityRole="progressbar" accessibilityLabel={text} style={{ flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
    <ActivityIndicator size="large" color={c.accent} /><T tone="muted">{text}</T>
  </View>;
}

/**
 * Account books, reader state and the open book. Position, bookmarks, the header section and the open book follow the
 * account across devices, and the details of every selectable word arrive with the books.
 */
export function useReadingLibrary(api: LibraryApi, notify: Notify, enabled = true) {
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [reading, setReading] = useState<ReadingState>(EMPTY_READING);
  const [wordDetails, setWordDetails] = useState<Record<string, WordDetail>>({});
  // The first load reopens the book the account left open; later reloads never move the reader.
  const restored = useRef(false);
  const [usedExamples, setUsedExamples] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [spread, setSpreadValue] = useState<1 | 2>(1);
  const pending = useRef(new Map<string, { offset: number; bookmarks: number[] }>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await api<{ books: LibraryBook[]; reading?: ReadingState; usedExamples?: Record<string, string[]>; wordDetails?: Record<string, WordDetail> }>("library");
      if (!restored.current) {
        restored.current = true;
        const open = data.reading?.openBookId;
        if (open && data.books.some(book => book.id === open && book.kind === "book")) setOpenId(open);
      }
      setWordDetails(data.wordDetails ?? {});
      setBooks(data.books); setUsedExamples(data.usedExamples ?? {}); setReading(() => ({ ...(data.reading ?? EMPTY_READING), books: { ...(data.reading?.books ?? {}), ...Object.fromEntries(pending.current) } })); setError("");
    } catch (cause) { setError(errorText(cause, "책을 불러오지 못했습니다.")); }
  }, [api]);
  useEffect(() => { if (enabled) void load(); else { restored.current = false; setBooks(null); setReading(EMPTY_READING); setWordDetails({}); setOpenId(null); } }, [load, enabled]);
  useEffect(() => { void storage.readAsync(SPREAD_KEY).then(value => { if (value === "2") setSpreadValue(2); }).catch(() => undefined); }, []);
  const send = useCallback((patch: Record<string, unknown>) => { void api("library/state", patch).catch(cause => notify(errorText(cause, "읽은 위치를 저장하지 못했습니다."), "error")); }, [api, notify]);
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    for (const [id, entry] of pending.current) send({ book: { id, ...entry } });
    pending.current.clear();
  }, [send]);
  useEffect(() => flush, [flush]);
  return {
    books, reading, usedExamples, error, openId, spread, reload: load,
    /** False until the first load answers, so the app can wait before choosing the section to start in. */
    loaded: books !== null || !!error,
    open(id: string) { setOpenId(id); setReading(previous => ({ ...previous, lastBookId: id, openBookId: id })); send({ lastBookId: id, openBookId: id }); },
    close() { flush(); setOpenId(null); setReading(previous => ({ ...previous, openBookId: "" })); send({ openBookId: "" }); },
    /** Remember the header section, so the next visit starts in the bookshelf when it was left there. */
    setSection(section: ReadingSection) { if ((reading.section ?? "vocabulary") === section) return; setReading(previous => ({ ...previous, section })); send({ section }); },
    /** Details of a selectable word, already loaded with the books. */
    wordDetail(language: Language, word: string): WordDetail | undefined { return wordDetails[wordKey(language, word)]; },
    /** Keep the loaded details in step after a note is saved, so reopening the word shows it. */
    rememberNote(language: Language, word: string, note: string) { const key = wordKey(language, word); setWordDetails(previous => previous[key] ? { ...previous, [key]: { ...previous[key], note } } : previous); },
    position(id: string) { return reading.books[id] ?? { offset: 0, bookmarks: [] }; },
    /** Local state changes at once; the server write waits briefly so fast page turns send one request. */
    setPosition(id: string, offset: number, bookmarks: number[]) {
      setReading(previous => ({ ...previous, books: { ...previous.books, [id]: { offset, bookmarks } } }));
      pending.current.set(id, { offset, bookmarks });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    setVocabulary(id: string) { setReading(previous => ({ ...previous, vocabularyId: id })); send({ vocabularyId: id }); },
    setSpread(next: 1 | 2) { setSpreadValue(next); void storage.write(SPREAD_KEY, String(next)).catch(() => undefined); },
    replaceBook(book: LibraryBook) { setBooks(previous => previous && (previous.some(entry => entry.id === book.id) ? previous.map(entry => entry.id === book.id ? book : entry) : [...previous, book])); void load(); },
  };
}
export type ReadingLibraryModel = ReturnType<typeof useReadingLibrary>;

function pagesOf(book: LibraryBook, language: Language, phone: boolean): ReadingPage[] {
  return paginate(proseTokens(book), PAGE_CHARS[language][phone ? "phone" : "pc"]);
}

/** Shelf: every reading book and the last book read. Any book opens at its saved position. */
export function Bookshelf({ library, api, language, notify }: { library: ReadingLibraryModel; api: LibraryApi; language: Language; notify: Notify }) {
  const c = useContext(Theme);
  const { phone } = useContext(Device);
  const [importing, setImporting] = useState<string | null | undefined>(undefined);
  const books = (library.books ?? []).filter(book => book.kind === "book");
  const last = books.find(book => book.id === library.reading.lastBookId);
  const progress = (book: LibraryBook) => {
    const pages = pagesOf(book, language, phone);
    if (!pages.length) return "본문 없음";
    const page = pageAt(pages, library.position(book.id).offset);
    const marks = library.position(book.id).bookmarks.length;
    return `${page + 1} / ${pages.length}페이지${marks ? ` · 책갈피 ${marks}개` : ""}`;
  };
  if (library.books === null) return library.error ? <Card title="책장"><T tone="error">{library.error}</T><Btn title="다시 불러오기" onPress={() => void library.reload()} /></Card> : <Loading />;
  return <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <T size={phone ? 18 : 21.6} serif weight="700" style={{ flex: 1 }}>책장</T>
      <Btn title="책 추가" onPress={() => setImporting(null)} testID="add-book" />
    </View>
    {!!library.error && <T tone="error">{library.error}</T>}
    {last && <Card title="마지막에 읽던 책">
      <Pressable accessibilityRole="button" accessibilityLabel={`${last.title} 이어서 읽기`} onPress={() => library.open(last.id)} testID="resume-last-book"
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.accentLine, backgroundColor: pressed ? c.soft : c.raised })}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><T size={16.5} serif weight="700" numberOfLines={1}>{last.title}</T><T size={12.5} tone="muted">{progress(last)}</T></View>
        <T weight="700" style={{ color: c.accentStrong }}>이어서 읽기 →</T>
      </Pressable>
    </Card>}
    <Card title="책 목록" hint={`${books.length}권`}>
      {books.length === 0 ? <Empty>아직 책이 없습니다. 책 추가에서 프롬프트를 복사한 뒤 AI가 만든 JSON을 넣으세요.</Empty> : <View style={{ gap: 8 }}>
        {books.map(book => <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`${book.title} 읽기`} onPress={() => library.open(book.id)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: book.id === last?.id ? c.accentLine : c.border, backgroundColor: pressed ? c.soft : c.raised })}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}><T size={15.2} serif weight="700" numberOfLines={1}>{book.title}</T><T size={12} tone="dim">{progress(book)}</T></View>
          <T tone="dim">›</T>
        </Pressable>)}
      </View>}
    </Card>
    {importing !== undefined && <BookImporter api={api} language={language} books={books} targetId={importing} notify={notify} onClose={() => setImporting(undefined)} onSaved={library.replaceBook} />}
  </>;
}

/** Full-screen reader: the top row keeps the book selector and actions; pages, bookmarks and page turns below. */
export function ReaderScreen({ library, api, language, notify, onNoteSaved }: { library: ReadingLibraryModel; api: LibraryApi; language: Language; notify: Notify; onNoteSaved?: (word: string, note: string) => void }) {
  const c = useContext(Theme);
  const { phone } = useContext(Device);
  const [word, setWord] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [marks, setMarks] = useState(false);
  const [editing, setEditing] = useState(false);
  const books = (library.books ?? []).filter(book => book.kind === "book");
  const book = books.find(entry => entry.id === library.openId) ?? null;
  const spread: 1 | 2 = phone ? 1 : library.spread;
  const pages = useMemo(() => book ? pagesOf(book, language, phone) : [], [book, language, phone]);
  const saved = book ? library.position(book.id) : { offset: 0, bookmarks: [] };
  const first = spreadStart(pageAt(pages, saved.offset), spread);
  const visible = pages.slice(first, first + spread);
  const marked = saved.bookmarks.some(mark => visible.some(page => pageAt(pages, mark) === pages.indexOf(page)));
  const go = (page: number) => { if (!book || !pages.length) return; const target = spreadStart(Math.max(0, Math.min(pages.length - 1, page)), spread); library.setPosition(book.id, pages[target].start, saved.bookmarks); };
  const canPrev = first > 0;
  const canNext = first + spread < pages.length;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (event: KeyboardEvent) => {
      const node = event.target as HTMLElement | null;
      if (word || importing || editing || marks || (node && ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName))) return;
      if (event.key === "ArrowLeft" && canPrev) { event.preventDefault(); go(first - spread); }
      if (event.key === "ArrowRight" && canNext) { event.preventDefault(); go(first + spread); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const fontSize = language === "ja" ? (phone ? 19 : 20) : (phone ? 18 : 19);
  const pageView = (page: ReadingPage | undefined, number: number) => <View key={number} style={{ flex: 1, minWidth: 0, padding: phone ? 18 : 26, borderRadius: 14, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.panel, gap: 14 }}>
    <View style={{ flex: 1 }}>{page ? <ReaderText color={c.text} accent={c.accent} font={fonts.serif} size={fontSize} tokens={page.tokens} onWord={setWord} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><T tone="dim">마지막 페이지입니다.</T></View>}</View>
    {page && <T size={11.5} mono tone="dim" style={{ textAlign: "center" }}>{number}</T>}
  </View>;
  const noCaret = Platform.OS === "web" ? ({ caretColor: "transparent", userSelect: "none", WebkitUserSelect: "none" } as any) : null;
  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.header }, noCaret]}>
      <Btn size="icon" title="←" label="책장으로" onPress={library.close} testID="back-to-bookshelf" />
      <View style={{ flex: 1, minWidth: 0, maxWidth: 420 }}><BookSelect label="책" hideLabel books={books.map(entry => ({ id: entry.id, title: entry.title }))} value={book?.id ?? ""} onChange={library.open} /></View>
      {!phone && <View style={{ flex: 1 }} />}
      {!phone && pages.length > 1 && <Segment options={[{ key: 1, label: "1페이지" }, { key: 2, label: "2페이지" }]} value={library.spread} onChange={value => library.setSpread(value as 1 | 2)} />}
      <Btn title="내용 추가" onPress={() => setImporting(true)} testID="append-book" />
      <ActionDropdown label="⋯" accessibilityLabel="책 더보기 메뉴" testID="reader-more-menu" actions={[{ key: "edit", title: "편집", testID: "edit-book", onPress: () => setEditing(true) }]} />
    </View>
    {!book ? (library.books === null ? <Loading /> : <View style={{ padding: 20 }}><Empty>책을 찾을 수 없습니다.</Empty></View>) :
      <ScrollView key={first} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: phone ? 12 : 20, width: "100%", maxWidth: spread === 2 ? 1320 : 820, alignSelf: "center" }}>
        {!pages.length ? <Empty>본문이 없습니다. 내용 추가로 본문을 넣으세요.</Empty> :
          <View style={{ flex: 1, flexDirection: "row", gap: 18 }}>{spread === 2 ? [pageView(visible[0], first + 1), pageView(visible[1], first + 2)] : pageView(visible[0], first + 1)}</View>}
      </ScrollView>}
    {book && pages.length > 0 && <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.header }, noCaret]}>
      <Btn size="lg" title="←" label="이전 페이지" disabled={!canPrev} onPress={() => go(first - spread)} testID="prev-page" style={{ minWidth: 64 }} />
      <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
        <T size={12.8} mono tone="muted">{visible.length > 1 ? `${first + 1}–${first + 2}` : first + 1} / {pages.length}</T>
      </View>
      <Btn title={marked ? "★" : "☆"} label={marked ? "책갈피 빼기" : "책갈피 꽂기"} selected={marked} onPress={() => library.setPosition(book.id, pages[first].start, toggleBookmark(saved.bookmarks, pages[first].start, pages))} testID="toggle-bookmark" />
      <Btn title={`책갈피 ${saved.bookmarks.length}`} label="책갈피 목록" disabled={!saved.bookmarks.length} onPress={() => setMarks(true)} testID="bookmark-list" />
      <Btn size="lg" variant="primary" title="→" label="다음 페이지" disabled={!canNext} onPress={() => go(first + spread)} testID="next-page" style={{ minWidth: 64 }} />
    </View>}
    {marks && book && <Sheet title="책갈피" onClose={() => setMarks(false)}>
      {saved.bookmarks.map(mark => { const page = pageAt(pages, mark); return <Pressable key={mark} accessibilityRole="button" accessibilityLabel={`${page + 1}페이지로 이동`} onPress={() => { setMarks(false); go(page); }}
        style={({ pressed }) => ({ gap: 4, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.soft : c.raised })}>
        <T weight="700">{page + 1}페이지</T><T size={12.5} tone="muted" numberOfLines={2}>{pages[page]?.tokens.map(token => token.text).join("").trim()}</T>
      </Pressable>; })}
    </Sheet>}
    {word && <WordLookup key={word} api={api} word={word} language={language} initial={library.wordDetail(language, word)} onNoteSaved={note => { library.rememberNote(language, word, note); onNoteSaved?.(word, note); }} onClose={() => setWord(null)} />}
    {editing && book && <MaterialEditor api={api} book={book} onClose={() => setEditing(false)} onSaved={saved => { setEditing(false); library.replaceBook(saved); }} />}
    {importing && book && <BookImporter api={api} language={language} books={books} targetId={book.id} notify={notify} onClose={() => setImporting(false)} onSaved={library.replaceBook} />}
  </View>;
}

/** Add a book from JSON, or append pages to one: the same title, or the chosen book, keeps growing. */
export function BookImporter({ api, language, books, targetId, notify, onClose, onSaved }: {
  api: LibraryApi; language: Language; books: LibraryBook[]; targetId: string | null; notify: Notify; onClose: () => void; onSaved: (book: LibraryBook) => void;
}) {
  const c = useContext(Theme);
  const [text, setText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const knownBooksRef = useRef<LibraryBook[]>(books);
  useEffect(() => {
    const merged = [...books];
    for (const entry of knownBooksRef.current) {
      if (!merged.some(book => book.id === entry.id)) merged.push(entry);
    }
    knownBooksRef.current = merged;
  }, [books]);
  const target = knownBooksRef.current.find(book => book.id === targetId) ?? books.find(book => book.id === targetId);
  const deps = () => ({
    books: knownBooksRef.current,
    targetId,
    saveBook: async (title: string, body: string) => (await api<{ book: LibraryBook }>("library/save", { kind: "book", title, body, words: [] })).book,
    appendBook: async (id: string, body: string) => (await api<{ book: LibraryBook }>("library/append", { id, body })).book,
  });
  const applyOutcome = (outcome: BookImportOutcome<LibraryBook>) => {
    if (outcome.ok) {
      knownBooksRef.current = knownBooksRef.current.some(book => book.id === outcome.book.id)
        ? knownBooksRef.current.map(book => (book.id === outcome.book.id ? outcome.book : book))
        : [...knownBooksRef.current, outcome.book];
      setText("");
      setStatus(outcome.status);
      onSaved(outcome.book);
      return;
    }
    setError(outcome.error);
    setText(outcome.text);
    if (outcome.openManual) setManualOpen(true);
  };
  const submitClipboard = async () => {
    if (busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      applyOutcome(await importBookFromClipboard(() => Clipboard.getStringAsync(), text, deps()));
    } finally {
      setBusy(false);
    }
  };
  const submitManual = async () => {
    if (busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      applyOutcome(await importBookJson(text, deps()));
    } finally {
      setBusy(false);
    }
  };
  return <Sheet title={target ? `${target.title} · 내용 추가` : "책 추가"} onClose={() => { if (!busy) onClose(); }}>
    <T size={13} tone="muted">외부 AI에 책 페이지 사진을 첨부하거나 본문 텍스트를 붙여 넣으세요. AI가 출력한 JSON을 복사한 뒤 클립보드에서 추가를 누르세요.</T>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Btn title="프롬프트 복사" disabled={busy} onPress={() => void Clipboard.setStringAsync(bookImportPrompt(language)).then(() => notify("책 프롬프트 복사 완료"), cause => setError(errorText(cause, "프롬프트를 복사하지 못했습니다.")))} testID="copy-book-prompt" />
      <Btn variant="primary" title={busy ? "저장 중…" : "클립보드에서 추가"} disabled={busy} onPress={() => void submitClipboard()} testID="import-book-clipboard" />
      <Btn title="JSON 직접 입력" selected={manualOpen} disabled={busy} onPress={() => setManualOpen(open => !open)} testID="toggle-book-manual" />
      <Btn title="닫기" disabled={busy} onPress={onClose} testID="close-book-import" />
    </View>
    {manualOpen && <View style={{ gap: 10 }}>
      <Input multiline label="책 JSON" placeholder='{ "title": "책 이름", "body": "본문" }' value={text} onChangeText={value => { setText(value); setStatus(""); }} testID="book-json-input" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn variant="primary" title={busy ? "저장 중…" : "추가"} disabled={busy || !text.trim()} onPress={() => void submitManual()} testID="book-json-submit" />
      </View>
    </View>}
    {!!error && <T tone="error">{error}</T>}
    {!!status && <View style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.goodLine, backgroundColor: c.goodSoft }}><T size={13} tone="good">{status}</T></View>}
  </Sheet>;
}

/**
 * One registered word in the order furigana, meaning, personal note, decomposition. The note is shared by every material.
 * A word from a book opens at once from the details loaded with it; elsewhere it is fetched. A changed note saves itself
 * when the field loses focus or the sheet closes, as in word study.
 */
export function WordLookup({ api, word, language, initial, onNoteSaved, onClose }: { api: LibraryApi; word: string; language: Language; initial?: WordDetail; onNoteSaved?: (note: string) => void; onClose: () => void }) {
  const [detail, setDetail] = useState<WordDetail | null | undefined>(initial);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  // The note as last stored on the server (null after a failed save); a save is sent only when the field differs.
  const stored = useRef<string | null>(initial?.note ?? "");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (initial) return;
    let active = true;
    setDetail(undefined); setError("");
    api<{ detail: WordDetail | null }>("word", undefined, { word }).then(result => { if (active) { setDetail(result.detail); setNote(result.detail?.note ?? ""); stored.current = result.detail?.note ?? ""; } }, cause => { if (active) setError(errorText(cause, "조회하지 못했습니다.")); });
    return () => { active = false; };
  }, [api, word, retry]);
  const save = () => {
    if (!detail || note === stored.current) return;
    const value = note;
    stored.current = value;
    setStatus("saving"); setError("");
    void api("word-note", { word: detail.word, note: value }).then(() => { onNoteSaved?.(value); if (mounted.current) setStatus("saved"); }, cause => { stored.current = null; if (mounted.current) { setStatus("idle"); setError(errorText(cause, "메모를 저장하지 못했습니다.")); } });
  };
  return <Sheet title={word} onClose={() => { save(); onClose(); }}>
    {detail === undefined && !error && <Loading text="단어를 찾는 중…" />}
    {detail === null && <T>등록된 단어가 없습니다.</T>}
    {!!error && <><T tone="error">{error}</T>{detail === undefined && <Btn title="다시 조회" onPress={() => setRetry(value => value + 1)} />}</>}
    {detail && <>
      {language === "ja" && <><T tone="dim" size={12}>후리가나</T><T size={18}>{detail.reading || "-"}</T></>}
      <T tone="dim" size={12}>뜻</T><T>{detail.meaning || "등록된 뜻이 없습니다."}</T>
      <Input multiline label="내 메모" value={note} onChangeText={value => { setNote(value); setStatus("idle"); }} onBlur={save} placeholder="이 단어의 메모" testID="reader-word-note" />
      <T size={12} tone="dim">{status === "saving" ? "저장 중…" : status === "saved" ? "저장했습니다." : "바꾸면 자동으로 저장됩니다. 같은 단어의 메모는 모든 단어장과 책에서 함께 바뀝니다."}</T>
      <T tone="dim" size={12}>{language === "ja" ? "한자 디컴포지션" : "제공 예문"}</T>
      {detail.studyNote.trim() ? <StudyMarkdown text={detail.studyNote} client={client} /> : <T tone="muted">없음</T>}
    </>}
  </Sheet>;
}

/** Edit a reading book's title and full text directly. */
export function MaterialEditor({ api, book, onClose, onSaved }: { api: LibraryApi; book: LibraryBook; onClose: () => void; onSaved: (book: LibraryBook) => void }) {
  const [title, setTitle] = useState(book.title);
  const [content, setContent] = useState(book.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { onSaved((await api<{ book: LibraryBook }>("library/save", { id: book.id, kind: "book", title, body: content, words: [] })).book); }
    catch (cause) { setError(errorText(cause, "저장하지 못했습니다.")); }
    finally { setBusy(false); }
  };
  return <Sheet title={`${book.title} 편집`} onClose={() => { if (!busy) onClose(); }}>
    <Input label="책 이름" value={title} onChangeText={setTitle} placeholder="이름을 입력하세요" />
    <Input multiline label="본문" value={content} onChangeText={setContent} placeholder="본문" />
    {!!error && <T tone="error">{error}</T>}
    <View style={{ flexDirection: "row", gap: 8 }}><Btn variant="primary" title={busy ? "저장 중…" : "저장"} disabled={busy || !title.trim()} onPress={() => void save()} /><Btn title="취소" disabled={busy} onPress={onClose} /></View>
  </Sheet>;
}
