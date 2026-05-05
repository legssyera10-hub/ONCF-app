import type { OnlineTrial } from "../types";

export type OnlineTrialMaterialRow = {
  id: string;
  index: number;
  type: string;
  serie: string;
  concerned: string;
};

export type OnlineTrialProgressEntry = {
  performed?: boolean;
  realization_date?: string | null;
  departure_date?: string | null;
  return_date?: string | null;
  delay_minutes?: number | null;
  remarks?: string | null;
  updated_at?: string | null;
};

function splitJoinedValues(value?: string | null) {
  return (value ?? "")
    .split(" + ")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function buildOnlineTrialMaterialRows(trial: OnlineTrial): OnlineTrialMaterialRow[] {
  const types = splitJoinedValues(trial.material_type);
  const series = splitJoinedValues(trial.material_ref);
  const concerned = splitJoinedValues(trial.material_concerned);
  const count = Math.max(types.length, series.length, concerned.length, 1);

  return Array.from({ length: count }, (_, index) => ({
    id: `${trial.id}-${index}`,
    index,
    type: types[index] || types[0] || "-",
    serie: series[index] || series[0] || "-",
    concerned: concerned[index] || "-",
  }));
}

export function parseOnlineTrialProgress(value?: string | null): Record<number, OnlineTrialProgressEntry> {
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

  const parsed: Record<number, OnlineTrialProgressEntry> = {};
  for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || !item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const typed = item as Record<string, unknown>;
    const realizationDate =
      typeof typed.realization_date === "string"
        ? typed.realization_date
        : typeof typed.return_date === "string"
          ? typed.return_date
          : typeof typed.departure_date === "string"
            ? typed.departure_date
            : null;
    parsed[index] = {
      performed: typeof typed.performed === "boolean" ? typed.performed : false,
      realization_date: realizationDate,
      departure_date: typeof typed.departure_date === "string" ? typed.departure_date : null,
      return_date: typeof typed.return_date === "string" ? typed.return_date : null,
      delay_minutes: typeof typed.delay_minutes === "number" ? typed.delay_minutes : null,
      remarks: typeof typed.remarks === "string" ? typed.remarks : null,
      updated_at: typeof typed.updated_at === "string" ? typed.updated_at : null,
    };
  }

  return parsed;
}
