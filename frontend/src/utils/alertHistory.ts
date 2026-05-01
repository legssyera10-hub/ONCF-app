import type { Alert, AlertHistoryItem } from "../types";

const DECISION_STATUSES = new Set(["A_MODIFIER", "ANNULEE"]);
const SYSTEM_MODIFICATION_CLOSED_PREFIX = "demande modifiee et cloturee";

function hasDecisionNote(item: AlertHistoryItem) {
  if (!DECISION_STATUSES.has(item.status)) {
    return false;
  }
  return Boolean(item.note?.trim());
}

function isPermanentDecisionAuthor(item: AlertHistoryItem) {
  return item.changed_by?.role === "PERMANENT" || item.changed_by?.role === "ADMIN";
}

function isSystemCloseNote(item: AlertHistoryItem) {
  const note = item.note?.trim().toLowerCase() ?? "";
  return note.startsWith(SYSTEM_MODIFICATION_CLOSED_PREFIX);
}

export function getPermanentDecisionReason(alert: Pick<Alert, "history">): string | undefined {
  const decisionEntries = alert.history.slice().reverse().filter(hasDecisionNote);

  const permanentAuthored = decisionEntries.find(isPermanentDecisionAuthor);
  if (permanentAuthored?.note?.trim()) {
    return permanentAuthored.note.trim();
  }

  const nonSystemEntry = decisionEntries.find((item) => !isSystemCloseNote(item));
  if (nonSystemEntry?.note?.trim()) {
    return nonSystemEntry.note.trim();
  }

  const fallbackEntry = decisionEntries[0];
  return fallbackEntry?.note?.trim() || undefined;
}
