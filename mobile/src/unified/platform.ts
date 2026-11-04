import { Alert } from "react-native";
/** Confirm destructive or unsaved-work actions with the native dialog. */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => Alert.alert("확인", message, [{ text: "취소", style: "cancel", onPress: () => resolve(false) }, { text: "계속", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
}
