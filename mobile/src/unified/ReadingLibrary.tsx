import { ReaderText } from "./ReaderText";
import React, { useContext, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Btn, Card, Input, Segment, Sheet, T, Theme, fonts } from "./ui";
import { segmentProse, type LibraryApi, type LibraryBook, type LibraryWord, type WordDetail } from "./readingWords";

/** Create and edit materials with an explicit book or vocabulary type. */
export function MaterialEditor({ api, book, initialTitle = "", allowVocabulary, onClose, onSaved }: { api: LibraryApi; book?: LibraryBook; initialTitle?: string; allowVocabulary: boolean; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<"book" | "vocabulary">(book?.kind ?? "book");
  const [title, setTitle] = useState(book?.title ?? initialTitle);
  const [content, setContent] = useState(book?.body ?? "");
  const [words, setWords] = useState<LibraryWord[]>(book?.words ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("library/save", { id: book?.id, kind, title, body: kind === "book" ? content : "", words });
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  };
  return <Sheet title={book ? "교재 편집" : "교재 추가"} onClose={() => { if (!busy) onClose(); }}>
    <View style={{ gap: 12 }}>
      {!book && allowVocabulary && <Segment options={[{ key: "book", label: "책" }, { key: "vocabulary", label: "단어장" }]} value={kind} onChange={value => { setKind(value as "book" | "vocabulary"); setContent(""); }} />}
      <T size={12} tone="dim">유형: {kind === "book" ? "책 · 본문 읽기" : "단어장 · 학습과 문제 풀이"}</T>
      <Input label="교재 이름" value={title} onChangeText={setTitle} placeholder="교재 이름" />
      {kind === "book" ? <Input multiline label="본문" value={content} onChangeText={setContent} placeholder="읽을 본문을 입력하세요." /> : <View style={{ gap: 14 }}>
        <T size={12} tone="dim">단어와 뜻을 입력하세요. 같은 단어의 개인 메모는 모든 교재에서 공유합니다.</T>
        {words.map((word, index) => <View key={word.id || index} style={{ gap: 8 }}>
          <T size={12} tone="dim">{index + 1}번 단어</T>
          {([['word', '단어'], ['meaning', '뜻'], ['example', '예문']] as const).map(([field, label]) => <Input key={field} label={`${index + 1}번 ${label}`} value={word[field]} onChangeText={value => setWords(previous => previous.map((entry, at) => at === index ? { ...entry, [field]: value } : entry))} />)}
          <Btn title="이 단어 빼기" onPress={() => setWords(previous => previous.filter((_, at) => at !== index))} />
        </View>)}
        <Btn title="단어 추가" onPress={() => setWords(previous => [...previous, { id: '', word: '', meaning: '', example: '', quiz: null }])} />
      </View>}
      {!!error && <T tone="error">{error}</T>}
      <View style={{ flexDirection: "row", gap: 8 }}><Btn title={busy ? "저장 중…" : "저장"} disabled={busy || !title.trim()} onPress={() => void save()} /><Btn title="취소" disabled={busy} onPress={onClose} /></View>
    </View>
  </Sheet>;
}

/** Show one registered word or an explicit missing result, with one persisted personal note. */
export function WordLookup({ api, word, onClose, onSaved }: { api: LibraryApi; word: string; onClose: () => void; onSaved?: () => void }) {
  const [detail, setDetail] = useState<WordDetail | null | undefined>(undefined);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setDetail(undefined); setError(""); setSaved(false);
    api<{ detail: WordDetail | null }>("word", undefined, { word }).then(result => { if (active) { setDetail(result.detail); setNote(result.detail?.note ?? ""); } }, cause => { if (active) setError(cause instanceof Error ? cause.message : "조회하지 못했습니다."); });
    return () => { active = false; };
  }, [api, word, retry]);
  const save = async () => {
    if (!detail || busy) return;
    setBusy(true); setError(""); setSaved(false);
    try { await api("word-note", { word: detail.word, note }); if (mounted.current) { setSaved(true); onSaved?.(); } }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "메모를 저장하지 못했습니다."); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <Sheet title={word} onClose={onClose}><View style={{ gap: 12 }}>
    {detail === undefined && !error && <T tone="muted">단어를 찾는 중…</T>}
    {detail === null && <T>등록된 단어가 없습니다.</T>}
    {!!error && <><T tone="error">{error}</T>{detail === undefined && <Btn title="다시 조회" onPress={() => setRetry(value => value + 1)} />}</>}
    {detail && <>
      {!!detail.reading && <><T tone="dim" size={12}>후리가나</T><T>{detail.reading}</T></>}
      <T tone="dim" size={12}>뜻</T><T>{detail.meaning || "등록된 뜻이 없습니다."}</T>
      <T tone="dim" size={12}>학습 노트</T><T>{detail.studyNote || "학습 노트가 없습니다."}</T>
      <Input multiline label="내 메모" value={note} onChangeText={value => { setNote(value); setSaved(false); }} placeholder="이 단어의 메모" />
      <T size={12} tone="dim">같은 단어의 메모는 다른 교재에서도 함께 바뀝니다.</T>
      <Btn title={busy ? "저장 중…" : "메모 저장"} disabled={busy} onPress={() => void save()} />
      {saved && <T>저장했습니다.</T>}
    </>}
  </View></Sheet>;
}

/** A plain prose reader. Every segmented word opens a lookup, including unregistered words. */
export function ReadingLibrary({ api, language, allowVocabulary = false, revision = 0, onChanged }: { api: LibraryApi; language: "ja" | "en"; allowVocabulary?: boolean; revision?: number; onChanged?: () => void }) {
  const c = useContext(Theme);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const [editing, setEditing] = useState<LibraryBook | "new" | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ books: LibraryBook[] }>("library").then(data => { if (active) { setBooks(data.books); setError(""); } }, cause => { if (active) setError(cause instanceof Error ? cause.message : "책을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [api, revision, round]);
  const reload = () => { setRound(value => value + 1); onChanged?.(); };
  return <>
    <Card title={allowVocabulary ? "책과 단어장" : "책 읽기"} hint={`${books.filter(book => book.kind === "book").length}권`}>
      <View style={{ gap: 10 }}>
        <T size={12} tone="dim">단어를 누르면 뜻과 내 메모를 확인합니다.</T>
        {books.filter(book => book.kind === "book").map(book => <View key={book.id} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Btn title={book.title} onPress={() => setSelected(book)} /><Btn title="편집" onPress={() => setEditing(book)} /></View>)}
        {allowVocabulary && books.filter(book => book.kind === "vocabulary").map(book => <View key={book.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><T>{book.title} · 단어장</T><Btn title="편집" onPress={() => setEditing(book)} /></View>)}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Btn title={allowVocabulary ? "교재 추가" : "책 추가"} onPress={() => setEditing("new")} /><Btn title="목록 새로고침" onPress={reload} /></View>
        {!!error && <T tone="error">{error}</T>}
      </View>
    </Card>
    {selected && !word && <Sheet title={selected.title} onClose={() => { setSelected(null); setWord(null); }}>
      <T size={12} tone="dim">후리가나와 뜻은 단어를 누르면 표시됩니다.</T>
      {!selected.body.trim() ? <T>본문이 없습니다. 편집에서 본문을 추가하세요.</T> : <ReaderText color={c.text} font={fonts.serif} tokens={selected.tokens ?? segmentProse(selected.body, language)} onWord={setWord} />}
    </Sheet>}
    {word && <WordLookup key={word} api={api} word={word} onSaved={onChanged} onClose={() => setWord(null)} />}
    {editing && <MaterialEditor api={api} book={editing === "new" ? undefined : editing} allowVocabulary={allowVocabulary} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setSelected(null); reload(); }} />}
  </>;
}
