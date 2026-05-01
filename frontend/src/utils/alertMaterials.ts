import type { Alert } from "../types";

export type AlertMaterialRow = {
  id: string;
  index: number;
  type: string;
  serie: string;
  concerned: string;
};

export type MaterialConfirmationEntry = {
  confirmed?: boolean;
  reception_status?: "VALIDEE" | "EN_INSTANCE" | null;
  confirmed_at?: string | null;
  reception_date?: string | null;
  delay_minutes?: number | null;
  remarks?: string | null;
  en_instance_started_at?: string | null;
  en_instance_total_minutes?: number | null;
  last_instance_started_at?: string | null;
  instance_ended_at?: string | null;
  instance_used_once?: boolean;
};

export type PpmMaterialDecisionEntry = {
  ppm_status?: "ACCEPTEE" | "ANNULEE" | "MODIFIEE" | null;
  ppm_reason?: string | null;
  updated_at?: string | null;
};

function splitJoinedValues(value?: string | null) {
  return (value ?? "")
    .split(" + ")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getMaterialTypeLabel(value?: string | null) {
  if (!value) {
    return "";
  }
  if (value === "MM") {
    return "MM";
  }
  if (value === "MR") {
    return "MR";
  }
  return String(value);
}

export function buildAlertMaterialRows(alert: Alert): AlertMaterialRow[] {
  const types = splitJoinedValues(alert.material_type).map((item) => getMaterialTypeLabel(item));
  const series = splitJoinedValues(alert.material_ref);
  const concerned = splitJoinedValues(alert.material_concerned);
  const count = Math.max(types.length, series.length, concerned.length, 1);

  return Array.from({ length: count }, (_, index) => ({
    id: `${alert.id}-${index}`,
    index,
    type: types[index] || types[0] || "-",
    serie: series[index] || series[0] || "-",
    concerned: concerned[index] || "-",
  }));
}

export function parseConfirmedMaterialIndexes(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

export function parseMaterialConfirmations(value?: string | null): Record<number, MaterialConfirmationEntry> {
  if (!value) {
    return {};
  }

  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const parsed: Record<number, MaterialConfirmationEntry> = {};

  for (const [key, item] of entries) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const typed = item as Record<string, unknown>;
    const rawReceptionStatus = typed.reception_status;
    const normalizedReceptionStatus =
      rawReceptionStatus === "VALIDEE"
        ? "VALIDEE"
        : rawReceptionStatus === "EN_INSTANCE" || rawReceptionStatus === "LIMITEE"
          ? "EN_INSTANCE"
          : null;
    parsed[index] = {
      confirmed: typeof typed.confirmed === "boolean" ? typed.confirmed : undefined,
      reception_status: normalizedReceptionStatus,
      confirmed_at: typeof typed.confirmed_at === "string" ? typed.confirmed_at : null,
      reception_date: typeof typed.reception_date === "string" ? typed.reception_date : null,
      delay_minutes: typeof typed.delay_minutes === "number" ? typed.delay_minutes : null,
      remarks: typeof typed.remarks === "string" ? typed.remarks : null,
      en_instance_started_at: typeof typed.en_instance_started_at === "string" ? typed.en_instance_started_at : null,
      en_instance_total_minutes:
        typeof typed.en_instance_total_minutes === "number" ? typed.en_instance_total_minutes : null,
      last_instance_started_at: typeof typed.last_instance_started_at === "string" ? typed.last_instance_started_at : null,
      instance_ended_at: typeof typed.instance_ended_at === "string" ? typed.instance_ended_at : null,
      instance_used_once: typeof typed.instance_used_once === "boolean" ? typed.instance_used_once : undefined,
    };
  }

  return parsed;
}

export function hasInstanceReceptionMaterial(value?: string | null) {
  const confirmations = parseMaterialConfirmations(value);
  return Object.values(confirmations).some((entry) => entry.reception_status === "EN_INSTANCE");
}

export function parsePpmMaterialDecisions(value?: string | null): Record<number, PpmMaterialDecisionEntry> {
  if (!value) {
    return {};
  }

  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const parsed: Record<number, PpmMaterialDecisionEntry> = {};

  for (const [key, item] of entries) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const typed = item as Record<string, unknown>;
    parsed[index] = {
      ppm_status:
        typed.ppm_status === "ACCEPTEE" || typed.ppm_status === "ANNULEE" || typed.ppm_status === "MODIFIEE"
          ? typed.ppm_status
          : null,
      ppm_reason: typeof typed.ppm_reason === "string" ? typed.ppm_reason : null,
      updated_at: typeof typed.updated_at === "string" ? typed.updated_at : null,
    };
  }

  return parsed;
}
