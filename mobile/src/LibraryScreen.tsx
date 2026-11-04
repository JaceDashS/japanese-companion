import React, { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import type { Book, Unit } from "./study";
import { Button, Field, styles } from "./ui";
export function LibraryScreen({
  books,
  bookId,
  today,
  maxStage,
  onBook,
  onUnit,
}: {
  books: Book[];
  bookId: string;
  today: string;
  maxStage: number;
  onBook: (b: string) => void;
  onUnit: (u: Unit) => void;
}) {
  const [filter, setFilter] = useState<"all" | "due" | "wrong">("all");
  const [query, setQuery] = useState("");
  const book = books.find((b) => b.id === bookId) ?? books[0];
  const units = useMemo(
    () =>
      (book?.units ?? []).filter(
        (u) =>
          (filter === "all" ||
            (filter === "due" &&
              u.stage < maxStage &&
              !!u.due &&
              u.due <= today) ||
            (filter === "wrong" &&
              u.items.some((i) => i.raw.lastResult === "FAIL"))) &&
          (!query ||
            [u.title, u.group, ...u.items.map((i) => i.title)].some((s) =>
              s.toLowerCase().includes(query.toLowerCase()),
            )),
      ),
    [book, filter, query, today, maxStage],
  );
  return (
    <FlatList
      data={units}
      keyExtractor={(u) => u.key}
      contentContainerStyle={styles.body}
      initialNumToRender={10}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>학습</Text>
          <Text style={styles.muted}>
            {today} · 오늘의 복습{" "}
            {book?.units.filter(
              (u) => u.stage < maxStage && u.due && u.due <= today,
            ).length ?? 0}{" "}
            · 전체 {book?.units.length ?? 0}
          </Text>
          <View style={styles.row}>
            {books.map((b) => (
              <Button
                key={b.id}
                title={b.title}
                selected={book?.id === b.id}
                onPress={() => onBook(b.id)}
              />
            ))}
          </View>
          <View style={styles.row}>
            <Button
              title="전체"
              selected={filter === "all"}
              onPress={() => setFilter("all")}
            />
            <Button
              title="복습"
              selected={filter === "due"}
              onPress={() => setFilter("due")}
            />
            <Button
              title="오답"
              selected={filter === "wrong"}
              onPress={() => setFilter("wrong")}
            />
          </View>
          <Field label="검색" value={query} onChangeText={setQuery} />
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.muted}>해당하는 학습 항목이 없습니다.</Text>
      }
      renderItem={({ item: u }) => (
        <View style={styles.card}>
          <Text style={styles.heading}>{u.title}</Text>
          <Text style={styles.muted}>
            {u.group} · {u.items.length}개 ·{" "}
            {u.stage >= maxStage ? "졸업" : u.stage + "단계"}
            {u.due ? " · 복습 " + u.due : ""}
          </Text>
          <Button title="열기" onPress={() => onUnit(u)} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}
