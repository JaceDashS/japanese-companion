import { useEffect } from "react";
import { createSessionKeyboardHandler } from "../../.generated/product/shared/controllers/domain/sessionInput.js";
import type { StudyModel } from "./useStudyModel";
/** Preserve browser quiz navigation, number keys and the note shortcut outside editable fields. */
export function useSessionKeys(model: StudyModel, onNotes: () => void, onHome: () => void) {
  useEffect(() => {
    if (!model.session) return;
    const handle = createSessionKeyboardHandler({ ...model, goHome: onHome });
    const onKeyDown = (event: KeyboardEvent) => {
      const node = event.target as HTMLElement | null;
      if (node && (["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName) || node.isContentEditable)) return;
      if (event.code === "Backquote" && !event.altKey && !event.ctrlKey && !event.metaKey && model.session?.phase === "quiz") { event.preventDefault(); onNotes(); return; }
      handle(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [model, onNotes, onHome]);
}
