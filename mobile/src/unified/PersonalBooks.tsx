import React, { useContext, useEffect, useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { StudyModel } from "./useStudyModel";
import { Btn, Empty, Input, Sheet, T, Theme } from "./ui";
import { confirmAction } from "./platform";
import {
  createPersonalBook,
  deletePersonalBook,
  deletePersonalWord,
  importPersonalWords,
  IMPORT_PROMPT,
  listPersonalBooks,
  renamePersonalBook,
  type ImportResult,
  type PersonalBook,
} from "./japaneseWords";

type View_ = { kind: "list" } | { kind: "import"; book: PersonalBook } | { kind: "words"; book: PersonalBook } | { kind: "rename"; book: PersonalBook };

const REASON = { exists: "이미 있음", repeated: "중복 입력" } as const;

/** Personal textbooks: add, rename and delete books, import words with the prompt, and delete single words. */
export function PersonalBooks({ model, onClose, notify }: { model: StudyModel; onClose: () => void; notify: (text: string, tone?: string) => void }) {
  const c = useContext(Theme);
  const [books, setBooks] = useState<PersonalBook[] | null>(null);
  const [view, setView] = useState<View_>({ kind: "list" });
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => listPersonalBooks().then(setBooks);
  useEffect(() => { void load().catch((error) => notify(String(error), "error")); }, []);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (error) { notify(error instanceof Error ? error.message : String(error), "error"); } finally { setBusy(false); }
  };
  const changed = async () => { await load(); await model.reloadBooks(); };

  if (view.kind === "import") return <Sheet title={`${view.book.title} · 단어 가져오기`} onClose={onClose}>
    <View style={{ gap: 10 }}>
      <T size={13.1} tone="muted">1. 프롬프트를 복사해 외부 AI에 보냅니다. 2. 이어서 모르는 단어를 형식 없이 보냅니다. 3. AI가 출력한 JSON을 아래에 붙여 넣습니다.</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Btn title="프롬프트 복사" onPress={() => void run(async () => { await Clipboard.setStringAsync(IMPORT_PROMPT); notify("프롬프트 복사 완료"); })} />
        <Btn title="클립보드에서 붙여넣기" onPress={() => void run(async () => setText(await Clipboard.getStringAsync()))} />
      </View>
      <Input multiline label="단어 JSON" placeholder='{ "format": "jace-s.japanese-words", ... }' value={text} onChangeText={setText} testID="personal-import" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn variant="primary" title="가져오기" disabled={busy || !text.trim()} onPress={() => void run(async () => {
          const next = await importPersonalWords(view.book.id, text);
          setResult(next);
          if (next.added > 0) { setText(""); await changed(); }
        })} />
        <Btn title="목록으로" onPress={() => { setResult(null); setView({ kind: "list" }); }} />
      </View>
      {result && <View style={{ gap: 6, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
        <T weight="700">{result.added}개 추가 · 새 Day {result.days}개</T>
        {result.excluded.length > 0 && <T size={13.1} tone="muted">제외: {result.excluded.map((entry) => `${entry.expression}(${REASON[entry.reason]})`).join(", ")}</T>}
        {result.invalid.map((entry) => <T key={entry.index} size={13.1} style={{ color: c.accent }}>{entry.index + 1}번 {entry.expression || "(표기 없음)"}: {entry.errors.join(" ")}</T>)}
      </View>}
    </View>
  </Sheet>;

  if (view.kind === "words") {
    const source = model.files[`asset/user-${view.book.id}.json`] as { days?: { day?: { items?: { id: string; expression: string; meaningKo?: string }[] }[] }[] } | undefined;
    const words = (source?.days ?? []).flatMap((unit) => unit.day ?? []).flatMap((day) => day.items ?? []);
    return <Sheet title={`${view.book.title} · 단어`} onClose={onClose}>
      <View style={{ gap: 6 }}>
        {words.length === 0 ? <Empty>단어가 없습니다.</Empty> : words.map((word) => <View key={word.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
          <T size={18} serif>{word.expression}</T>
          <T size={13} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{word.meaningKo ?? ""}</T>
          <Btn variant="ghost" title="삭제" disabled={busy} onPress={() => void run(async () => {
            if (!await confirmAction(`${word.expression}을(를) 지울까요? 결과와 복습 일정도 지워지고 메모는 남습니다.`)) return;
            await deletePersonalWord(view.book.id, word.id);
            await changed();
          })} />
        </View>)}
        <View style={{ flexDirection: "row" }}><Btn title="목록으로" onPress={() => setView({ kind: "list" })} /></View>
      </View>
    </Sheet>;
  }

  if (view.kind === "rename") return <Sheet title="교재 이름 바꾸기" onClose={onClose}>
    <View style={{ gap: 10 }}>
      <Input label="교재 이름" value={title} onChangeText={setTitle} placeholder={view.book.title} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn variant="primary" title="저장" disabled={busy || !title.trim()} onPress={() => void run(async () => {
          await renamePersonalBook(view.book.id, title);
          setTitle(""); setView({ kind: "list" }); await changed();
        })} />
        <Btn title="취소" onPress={() => { setTitle(""); setView({ kind: "list" }); }} />
      </View>
    </View>
  </Sheet>;

  return <Sheet title="내 교재" onClose={onClose}>
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}><Input label="새 교재 이름" value={title} onChangeText={setTitle} placeholder="새 교재 이름" testID="personal-book-title" /></View>
        <Btn variant="primary" title="추가" disabled={busy || !title.trim()} onPress={() => void run(async () => { await createPersonalBook(title); setTitle(""); await changed(); })} />
      </View>
      {books === null ? <T tone="muted">불러오는 중…</T> : books.length === 0 ? <Empty>아직 내 교재가 없습니다.</Empty> : books.map((book) => <View key={book.id} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.panel }}>
        <T weight="700">{book.title}</T>
        <T size={12.2} tone="dim">단어 {book.wordCount}개 · Day {book.dayCount}개</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Btn title="단어 가져오기" onPress={() => { setResult(null); setText(""); setView({ kind: "import", book }); }} />
          <Btn title="단어 관리" onPress={() => setView({ kind: "words", book })} />
          <Btn title="이름 바꾸기" onPress={() => { setTitle(book.title); setView({ kind: "rename", book }); }} />
          <Btn variant="ghost" title="삭제" disabled={busy} onPress={() => void run(async () => {
            if (!await confirmAction(`${book.title} 교재를 지울까요? 단어, 결과, 복습 일정이 지워지고 메모는 남습니다.`)) return;
            await deletePersonalBook(book.id);
            await changed();
          })} />
        </View>
      </View>)}
    </View>
  </Sheet>;
}
