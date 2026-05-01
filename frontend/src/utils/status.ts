import type { AlertStatus } from "../types";

export const ALERT_STATUS_ORDER: AlertStatus[] = [
  "EN_COURS_DE_TRAITEMENT",
  "TRAITEE_PAR_PM",
  "A_MODIFIER",
  "MODIFIEE",
  "ANNULEE",
  "RECEPTION_PARTIELLE",
  "RECEPTION_COMPLETE",
];

export type BusinessStatusTone =
  | "processing"
  | "validated"
  | "modify"
  | "cancelled"
  | "issue"
  | "partial"
  | "received";

const PROCESSING_STATUSES: AlertStatus[] = ["EN_COURS_DE_TRAITEMENT"];
const VALIDATED_STATUSES: AlertStatus[] = ["TRAITEE_PAR_PM"];
const MODIFY_STATUSES: AlertStatus[] = ["A_MODIFIER"];
const MODIFIED_STATUSES: AlertStatus[] = ["MODIFIEE"];
const CANCELLED_STATUSES: AlertStatus[] = ["ANNULEE"];
const PARTIAL_STATUSES: AlertStatus[] = ["RECEPTION_PARTIELLE"];
const ISSUE_STATUSES: AlertStatus[] = [];
const CANCELLED_RECEPTION_STATUSES: AlertStatus[] = [];
const RECEIVED_STATUSES: AlertStatus[] = ["RECEPTION_COMPLETE"];

export function getBusinessStatusTone(status: AlertStatus): BusinessStatusTone {
  if (VALIDATED_STATUSES.includes(status)) return "validated";
  if (MODIFY_STATUSES.includes(status)) return "modify";
  if (MODIFIED_STATUSES.includes(status)) return "issue";
  if (CANCELLED_STATUSES.includes(status)) return "cancelled";
  if (CANCELLED_RECEPTION_STATUSES.includes(status)) return "cancelled";
  if (PARTIAL_STATUSES.includes(status)) return "partial";
  if (ISSUE_STATUSES.includes(status)) return "issue";
  if (RECEIVED_STATUSES.includes(status)) return "received";
  return "processing";
}

export function getBusinessStatusLabel(status: AlertStatus) {
  switch (status) {
    case "TRAITEE_PAR_PM":
      return "Traitée par PPM";
    case "A_MODIFIER":
      return "À modifier";
    case "MODIFIEE":
      return "Modifiée";
    case "ANNULEE":
      return "Annulée";
    case "RECEPTION_PARTIELLE":
      return "Réception partielle";
    case "RECEPTION_COMPLETE":
      return "Réception complète";
    default:
      return "En cours de traitement";
  }
}

export function isProcessingStatus(status: AlertStatus) {
  return PROCESSING_STATUSES.includes(status);
}

export function isValidatedStatus(status: AlertStatus) {
  return VALIDATED_STATUSES.includes(status);
}

export function isModificationStatus(status: AlertStatus) {
  return MODIFY_STATUSES.includes(status);
}

export function isCancelledStatus(status: AlertStatus) {
  return CANCELLED_STATUSES.includes(status);
}

export function isPartialReceptionStatus(status: AlertStatus) {
  return PARTIAL_STATUSES.includes(status);
}

export function isIssueStatus(status: AlertStatus) {
  return ISSUE_STATUSES.includes(status);
}

export function isReceivedStatus(status: AlertStatus) {
  return RECEIVED_STATUSES.includes(status);
}

export function getAlertStatusFilterOptions(includeAll = true) {
  const statusOptions = ALERT_STATUS_ORDER.map((status) => ({
    value: status,
    label: getBusinessStatusLabel(status),
  }));

  if (!includeAll) {
    return statusOptions;
  }

  return [{ value: "ALL", label: "Tous statuts" }, ...statusOptions];
}
