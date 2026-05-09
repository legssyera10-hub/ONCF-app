import type { OnlineTrial } from "../types";

const TECHNICENTRE_CODES = new Set([
  "TMF",
  "TMIC",
  "TMIJ",
  "TMIM",
  "TMIO",
  "TMIS",
  "TMK",
  "TMLC",
  "TMM",
  "TMN",
  "TMRC",
  "TMT",
  "TMVC",
]);

function toTechnicentreCode(value?: string | null): string {
  const cleaned = (value ?? "").trim().toUpperCase();
  if (!cleaned) return "";

  const strippedPrefix = cleaned.replace(/^TECHNICENTRE\s+/, "").trim();
  if (TECHNICENTRE_CODES.has(strippedPrefix)) return strippedPrefix;
  if (TECHNICENTRE_CODES.has(cleaned)) return cleaned;

  const tokens = strippedPrefix.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    if (TECHNICENTRE_CODES.has(token)) return token;
  }
  return "";
}

export function getOnlineTrialCreatorLabel(trial: OnlineTrial): string {
  const fromFullName = toTechnicentreCode(trial.created_by?.full_name);
  if (fromFullName) return fromFullName;
  const fromUsername = toTechnicentreCode(trial.created_by?.username);
  if (fromUsername) return fromUsername;

  return "-";
}
