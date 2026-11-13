/** Screen layout values kept on the device per book. Study records always come from the server. */
export const VIEW_FIELDS = ["studyDrawerWidth", "dayListDrawerWidth"] as const;
export type SavedView = Partial<Record<(typeof VIEW_FIELDS)[number], number>>;

/** Keep only finite layout numbers from a study state or a cached value; anything else is dropped. */
export function pickView(value: unknown): SavedView {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const view: SavedView = {};
  for (const field of VIEW_FIELDS) {
    const number = source[field];
    if (typeof number === "number" && Number.isFinite(number)) view[field] = number;
  }
  return view;
}
