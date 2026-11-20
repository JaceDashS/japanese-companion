import React, { useContext, useEffect, useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { StudyModel } from "./useStudyModel";
import { ActionDropdown } from "./ActionDropdown";
import { importWordsFromClipboard, importWordsJson, type WordImportOutcome } from "./bookImport";
import { Btn, Empty, Input, Sheet, T, Theme } from "./ui";
import { confirmAction } from "./platform";
import { Loading } from "./ReadingLibrary";
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

/** Personal textbooks: add, rename and delete books, import words from clipboard or JSON, and delete single words. */
export function PersonalBooks({ model, onClose, notify }: { model: StudyModel; onClose: () => void; notify: (text: string, tone?: string) => void }) {
  const c = useContext(Theme);
  const [books, setBooks] = useState<PersonalBook[] | null>(null);
  const [view, setView] = useState<View_>({ kind: "list" });
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => listPersonalBooks().then((list) => { setBooks(list); return list; });
  useEffect(() => { void load().catch((cause) => notify(String(cause), "error")); }, []);
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (cause) { notify(cause instanceof Error ? cause.message : String(cause), "error"); } finally { setBusy(false); }
  };
  const changed = async () => { await load(); await model.reloadBooks(); };
  const safeClose = () => { if (!busy) onClose(); };
  const openImport = (book: PersonalBook) => {
    setResult(null); setError(""); setText(""); setManualOpen(false);
    setView({ kind: "import", book });
  };
  const applyImportOutcome = async (outcome: WordImportOutcome<ImportResult>) => {
    if (outcome.ok) {
      setError("");
      setResult(outcome.result);
      setText(outcome.text);
      if (outcome.result.added > 0) await changed();
      return;
    }
    setError(outcome.error);
    setText(outcome.text);
    setResult(outcome.result);
    if (outcome.openManual) setManualOpen(true);
  };

  if (view.kind === "import") return <Sheet title={`${view.book.title} · 단어 가져오기`} onClose={safeClose}>
    <View style={{ gap: 10 }}>
      <T size={13.1} tone="muted">프롬프트를 복사해 외부 AI에 단어 목록을 보낸 뒤, 출력된 JSON을 복사하고 클립보드에서 가져오기를 누르세요.</T>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Btn title="프롬프트 복사" disabled={busy} onPress={() => void Clipboard.setStringAsync(IMPORT_PROMPT).then(() => notify("단어장 프롬프트 복사 완료"), cause => setError(cause instanceof Error ? cause.message : String(cause)))} testID="copy-vocab-prompt" />
        <Btn variant="primary" title={busy ? "가져오는 중…" : "클립보드에서 가져오기"} disabled={busy} onPress={() => void run(async () => {
          setError(""); setResult(null);
          await applyImportOutcome(await importWordsFromClipboard(() => Clipboard.getStringAsync(), text, payload => importPersonalWords(view.book.id, payload)));
        })} testID="import-vocab-clipboard" />
        <Btn title="JSON 직접 입력" selected={manualOpen} disabled={busy} onPress={() => setManualOpen(open => !open)} testID="toggle-vocab-manual" />
        <Btn title="목록으로" disabled={busy} onPress={() => { setResult(null); setError(""); setText(""); setManualOpen(false); setView({ kind: "list" }); }} testID="back-to-vocab-list" />
      </View>
      {manualOpen && <View style={{ gap: 10 }}>
        <Input multiline label="단어 JSON" placeholder='{ "format": "jace-s.japanese-words", ... }' value={text} onChangeText={value => { setText(value); setError(""); }} testID="personal-import" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn variant="primary" title={busy ? "가져오는 중…" : "가져오기"} disabled={busy || !text.trim()} onPress={() => void run(async () => {
            setError(""); setResult(null);
            await applyImportOutcome(await importWordsJson(text, payload => importPersonalWords(view.book.id, payload)));
          })} testID="personal-import-submit" />
        </View>
      </View>}
      {!!error && <T tone="error">{error}</T>}
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
    return <Sheet title={`${view.book.title} · 단어`} onClose={safeClose}>
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
        <View style={{ flexDirection: "row" }}><Btn title="목록으로" disabled={busy} onPress={() => setView({ kind: "list" })} /></View>
      </View>
    </Sheet>;
  }

  if (view.kind === "rename") return <Sheet title="단어장 이름 바꾸기" onClose={safeClose}>
    <View style={{ gap: 10 }}>
      <Input label="단어장 이름" value={title} onChangeText={setTitle} placeholder={view.book.title} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn variant="primary" title="저장" disabled={busy || !title.trim()} onPress={() => void run(async () => {
          await renamePersonalBook(view.book.id, title);
          setTitle(""); setView({ kind: "list" }); await changed();
        })} />
        <Btn title="취소" disabled={busy} onPress={() => { setTitle(""); setView({ kind: "list" }); }} />
      </View>
    </View>
  </Sheet>;

  return <Sheet title="단어장 관리" onClose={safeClose}>
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <View style={{ flex: 1, gap: 8 }}><Input label="새 단어장 이름" value={title} onChangeText={setTitle} placeholder="새 단어장 이름" testID="personal-book-title" /></View>
        <Btn variant="primary" title="새 단어장 추가" disabled={busy || !title.trim()} onPress={() => void run(async () => { const book = await createPersonalBook(title); setTitle(""); await changed(); openImport(book); })} testID="create-personal-book" />
      </View>
      {books === null ? <Loading /> : books.length === 0 ? <Empty>아직 단어장이 없습니다.</Empty> : books.map((book) => <View key={book.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.panel }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T weight="700" numberOfLines={1}>{book.title}</T>
          <T size={12.2} tone="dim">단어 {book.wordCount}개 · Day {book.dayCount}개</T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Btn title="단어 가져오기" disabled={busy} onPress={() => openImport(book)} testID={`import-vocab-${book.id}`} />
          <ActionDropdown
            label="⋯"
            accessibilityLabel={`${book.title} 더보기 메뉴`}
            disabled={busy}
            testID={`vocab-more-${book.id}`}
            actions={[
              { key: "rename", title: "이름 바꾸기", onPress: () => { setTitle(book.title); setView({ kind: "rename", book }); } },
              { key: "words", title: "단어 관리", onPress: () => setView({ kind: "words", book }) },
              {
                key: "delete",
                title: "삭제",
                onPress: () => void run(async () => {
                  if (!await confirmAction(`${book.title} 교재를 지울까요? 단어, 결과, 복습 일정이 지워지고 메모는 남습니다.`)) return;
                  await deletePersonalBook(book.id);
                  await changed();
                }),
              },
            ]}
          />
        </View>
      </View>)}
    </View>
  </Sheet>;
}
