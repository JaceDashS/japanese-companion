import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Btn, Input, Sheet, T } from "./ui";

/** Animated in app composer. Failed sends retain the draft; only a successful send clears it. */
export function FeedbackSheet({ send, onClose, english = false }: { send: (content: string) => Promise<unknown>; onClose: () => void; english?: boolean }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const label = (ko: string, en: string) => english ? en : ko;
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive.current) setReducedMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { alive.current = false; listener.remove(); };
  }, []);
  const submit = async () => {
    if (sending.current || !content.trim()) return;
    sending.current = true;
    setBusy(true); setError("");
    try {
      await send(content.trim());
      if (alive.current) { setSent(true); setContent(""); }
    } catch {
      if (alive.current) setError(label("전송하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.", "Could not send feedback. Your text has been kept. Please try again later."));
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const close = () => { if (!sending.current) onClose(); };
  if (reducedMotion === null) return null;
  return <Sheet title={label("피드백", "Feedback")} onClose={close} reducedMotion={reducedMotion}>
    <T size={13.1} tone="muted">{label("피드백은 앱 이름과 함께 메인 사이트 댓글에 공개됩니다.", "Feedback is posted publicly in the main site comments with this app’s name.")}</T>
    {sent ? <T>{label("감사합니다. 피드백이 등록되었습니다.", "Thank you. Your feedback has been posted.")}</T> : <View style={{ gap: 12 }}>
      <T>{label("피드백 내용", "Your feedback")}</T>
      <Input label={label("피드백 내용", "Your feedback")} multiline value={content} onChangeText={value => { if (!sending.current) setContent(value); }} testID="feedback-content" />
      {!!error && <T>{error}</T>}
      <Btn title={busy ? label("전송 중…", "Sending…") : label("피드백 보내기", "Send feedback")} disabled={busy || !content.trim()} onPress={() => void submit()} testID="feedback-send" />
    </View>}
  </Sheet>;
}
