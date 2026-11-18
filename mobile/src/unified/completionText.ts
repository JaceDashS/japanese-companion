/** Wording of the heads-up message shown after a quiz; kept apart from the view so it can be tested. */

/** A finished quiz: how many were right and when its words come back. */
export interface Completion { id: number; passCount: number; total: number; allPass: boolean; nextReviewDate: string | null }

function dayDiff(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/** "11월 21일 (3일 뒤)" from the account's today; null when every review stage is done. */
export function nextReviewText(date: string | null, today: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [, month, day] = date.split("-").map(Number);
  const diff = dayDiff(today, date);
  const relative = diff <= 0 ? "오늘" : diff === 1 ? "내일" : `${diff}일 뒤`;
  return `${month}월 ${day}일 (${relative})`;
}

/** The lines of the heads-up message, so the wording is the same wherever it is shown. */
export function completionLines(completion: Completion, today: string) {
  const next = nextReviewText(completion.nextReviewDate, today);
  const failed = completion.total - completion.passCount;
  return {
    title: completion.allPass ? `${completion.total}개 모두 정답` : `${completion.total}개 중 ${completion.passCount}개 정답`,
    detail: completion.allPass ? (next ? null : "모든 복습 단계를 마쳤어요") : `틀린 ${failed}개는 다음 복습 때 다시 나와요`,
    next: next ? `다음 복습 · ${next}` : null,
  };
}
