export * from "../../../shared/domain/date.ts";
import { getAccountToday } from "../accountClock";
import { formatDate } from "../../../shared/domain/date.ts";
/** Use the authenticated account calendar before falling back to the local clock. */
export function getTodayString() { return getAccountToday() ?? formatDate(new Date()); }
