/** Native builds do not share browser developer preview state. */
export function useNoticePreview(): "notice" | "outage" | "all" | null { return null; }
