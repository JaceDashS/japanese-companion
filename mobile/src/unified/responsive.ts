/** Layout policy in logical pixels, shared by browser and Android screens. */
export function isDesktopLayout(width: number, height: number, mode: "auto" | "phone" | "pc" = "auto"): boolean {
  if (mode !== "auto") return mode === "pc";
  return width >= 1024 && Math.min(width, height) >= 600;
}
