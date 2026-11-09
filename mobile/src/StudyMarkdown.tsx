import React, { useContext } from "react";
import { Image, Linking, Text } from "react-native";
import Markdown from "react-native-markdown-display";
import type { CompanionClient } from "./client";
import { styles } from "./ui";
import { fonts, Theme } from "./unified/ui";
/** Render notes as native text and views; only server-scoped study images carry credentials. */
export function StudyMarkdown({
  text,
  client,
}: {
  text: string;
  client: CompanionClient;
}) {
  const colors = useContext(Theme);
  return (
    <Markdown
      style={{
        body: { color: colors.text, fontSize: 14, lineHeight: 24, fontFamily: fonts.sans },
        paragraph: { marginTop: 0, marginBottom: 8 },
        heading1: { color: colors.text, fontSize: 18 },
        heading2: { color: colors.text, fontSize: 16 },
        link: { color: colors.accent },
        code_inline: { color: colors.text, backgroundColor: colors.raised, fontFamily: fonts.mono, fontSize: 12, borderRadius: 4, paddingHorizontal: 4 },
        fence: { color: colors.text, backgroundColor: colors.raised, fontFamily: fonts.mono, fontSize: 12 },
        table: { borderColor: colors.border, borderWidth: 1, borderRadius: 0 },
        thead: { backgroundColor: colors.raised },
        th: { padding: 5, paddingHorizontal: 8, borderColor: colors.border, borderRightWidth: 1 },
        td: { padding: 5, paddingHorizontal: 8, borderColor: colors.border, borderRightWidth: 1 },
        tr: { borderColor: colors.border, borderBottomWidth: 1 },
        text: { fontSize: 14 },
      }}
      onLinkPress={(url) => {
        if (/^https:\/\//.test(url)) void Linking.openURL(url);
        return false;
      }}
      rules={{
        // Notes write line breaks inside table cells as <br>; show them as breaks instead of raw tags.
        text: (node: any, _children: any, _parent: any, styles: any, inherited: any = {}) => (
          <Text key={node.key} style={[inherited, styles.text]}>{String(node.content).replace(/<br\s*\/?>/gi, "\n")}</Text>
        ),
        image: (node: any) => {
          const src = client.mediaSource(node.attributes.src);
          return src ? (
            <Image
              key={node.key}
              accessibilityLabel={node.content || "학습 이미지"}
              source={src}
              style={{ width: "100%", height: 240 }}
              resizeMode="contain"
            />
          ) : (
            <Text key={node.key} style={styles.muted}>
              {node.content || "이미지를 표시할 수 없습니다."}
            </Text>
          );
        },
      }}
    >
      {text}
    </Markdown>
  );
}
