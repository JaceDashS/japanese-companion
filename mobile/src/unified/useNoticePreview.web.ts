import { useEffect, useState } from "react";
/** Preserve the existing browser developer notice preview and its update event. */
export function useNoticePreview(): "notice" | "outage" | "all" | null {
  const read = () => { try { const value = localStorage.getItem("jace-s:notice-preview"); return ["notice", "outage", "all"].includes(value ?? "") ? value as "notice" | "outage" | "all" : null; } catch { return null; } };
  const [preview, setPreview] = useState(read);
  useEffect(() => { const update = () => setPreview(read()); window.addEventListener("jace-s:notice-preview", update); window.addEventListener("storage", update); return () => { window.removeEventListener("jace-s:notice-preview", update); window.removeEventListener("storage", update); }; }, []);
  return preview;
}
