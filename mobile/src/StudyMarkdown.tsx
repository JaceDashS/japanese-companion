import React from "react";
import { Image, Linking, Text } from "react-native";
import Markdown from "react-native-markdown-display";
import type { CompanionClient } from "./client";
import { colors, styles } from "./ui";
/** Render notes as native text and views; only server-scoped study images carry credentials. */
export function StudyMarkdown({
  text,
  client,
}: {
  text: string;
  client: CompanionClient;
}) {
  return (
    <Markdown
      style={{
        body: { color: colors.text, fontSize: 17, lineHeight: 27 },
        heading1: { color: colors.text },
        heading2: { color: colors.text },
        link: { color: colors.accent },
        code_inline: { color: colors.text, backgroundColor: colors.panel },
        fence: { color: colors.text, backgroundColor: colors.panel },
        table: { borderColor: colors.border },
      }}
      onLinkPress={(url) => {
        if (/^https:\/\//.test(url)) void Linking.openURL(url);
        return false;
      }}
      rules={{
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
