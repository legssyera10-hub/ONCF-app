import type { AlertStatus } from "../types";

const ONLINE_TRIAL_STATUS_ORDER: AlertStatus[] = [
  "EN_COURS_DE_TRAITEMENT",
  "TRAITEE_PAR_PM",
  "A_MODIFIER",
  "MODIFIEE",
  "ANNULEE",
  "RECEPTION_COMPLETE",
];

export function getOnlineTrialStatusLabel(status: AlertStatus) {
  switch (status) {
    case "EN_COURS_DE_TRAITEMENT":
      return "En cours de traitement";
    case "TRAITEE_PAR_PM":
      return "Traitee par PPM";
    case "A_MODIFIER":
      return "A modifier";
    case "MODIFIEE":
      return "Modifiee";
    case "ANNULEE":
      return "Annulee";
    case "RECEPTION_COMPLETE":
      return "Essai realise";
    case "RECEPTION_PARTIELLE":
      return "Traitee par PPM";
    default:
      return "En cours de traitement";
  }
}

export function getOnlineTrialStatusFilterOptions(includeAll = true) {
  const options = ONLINE_TRIAL_STATUS_ORDER.map((status) => ({
    value: status,
    label: getOnlineTrialStatusLabel(status),
  }));
  if (!includeAll) {
    return options;
  }
  return [{ value: "ALL", label: "Tous statuts" }, ...options];
}
