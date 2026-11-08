import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { palettes } from "./unified/ui";
export const colors = palettes.dark;
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 20, gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 26, fontWeight: "700", color: colors.text },
  heading: { fontSize: 20, fontWeight: "600", color: colors.text },
  text: { fontSize: 17, lineHeight: 27, color: colors.text },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 17,
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: colors.text },
  error: { fontSize: 15, lineHeight: 23, color: colors.error },
  nav: {
    padding: 12,
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.accent, backgroundColor: "#393124" },
});
export function Button({
  title,
  onPress,
  disabled = false,
  selected = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        selected && styles.selected,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  secure = false,
  multiline = false,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  secure?: boolean;
  multiline?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && { minHeight: 120 }]}
      />
    </View>
  );
}
export function Busy() {
  return (
    <View style={styles.body}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.muted}>불러오는 중…</Text>
    </View>
  );
}
