import React, { useContext, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Sheet, T, Theme, fonts } from "./ui";

type BookOption = { id: string; title: string };

/** Compact book selector: browser dropdown or a native selection sheet using the product theme. */
export function BookSelect({ books, value, onChange, disabled = false }: {
  books: readonly BookOption[]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const c = useContext(Theme);
  const [open, setOpen] = useState(false);
  const selected = books.find(book => book.id === value);
  const unavailable = disabled || !books.length;
  return <View style={{ gap: 6, minWidth: 0, width: "100%" }}>
    <T size={12.2} tone="dim">교재</T>
    {Platform.OS === "web" ? React.createElement("select", {
      "aria-label": "교재", value, disabled: unavailable,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target.value !== value) onChange(event.target.value);
      },
      style: { width: "100%", minWidth: 0, minHeight: 44, padding: "10px 40px 10px 12px", appearance: "none", backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path d="m3 4.5 3 3 3-3" fill="none" stroke="${c.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: "12px 12px", borderRadius: 10, border: "1px solid " + c.border, backgroundColor: c.panel, color: c.text, fontFamily: fonts.sans, fontSize: 14, colorScheme: c.bg === "#ffffff" ? "light" : undefined },
    }, books.map(book => React.createElement("option", { key: book.id, value: book.id }, book.title))) :
      <Pressable accessibilityRole="button" accessibilityLabel={"교재: " + (selected?.title ?? "교재 없음")} accessibilityState={{ disabled: unavailable, expanded: open }} disabled={unavailable} onPress={() => setOpen(true)}
        style={{ minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.panel, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, opacity: unavailable ? 0.6 : 1 }}>
        <T style={{ flex: 1 }} numberOfLines={1}>{selected?.title ?? "교재 없음"}</T><T tone="muted">▾</T>
      </Pressable>}
    {open && <Sheet title="교재 선택" onClose={() => setOpen(false)}>
      {books.map(book => <Pressable key={book.id} accessibilityRole="radio" accessibilityState={{ checked: book.id === value, disabled: unavailable }} disabled={unavailable}
        onPress={() => { setOpen(false); if (book.id !== value) onChange(book.id); }}
        style={{ minHeight: 44, justifyContent: "center", padding: 12, borderRadius: 8, backgroundColor: book.id === value ? c.soft : c.panel }}>
        <T weight={book.id === value ? "700" : "400"}>{book.title}</T>
      </Pressable>)}
    </Sheet>}
  </View>;
}
