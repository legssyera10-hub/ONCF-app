export function parseApiDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) || value.includes("GMT")
      ? value
      : `${value.replace(" ", "T")}Z`;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getApiTimestamp(value?: string | null) {
  return parseApiDate(value)?.getTime() ?? Number.NaN;
}

export function formatDateTime(value?: string | null) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export function formatDateOnly(value?: string | null) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  }).format(parsed);
}

export function formatTimeOnly(value?: string | null) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return "-";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function toLocalInputDateTime(value?: string | null) {
  const date = parseApiDate(value);
  if (!date) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatDelayMinutes(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (value === 0) {
    return "A l'heure";
  }

  const totalMinutes = Math.abs(value);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}j`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}min`);
  }

  return `${parts.join(" ")} ${value > 0 ? "de retard" : "d'avance"}`;
}

export function getProgressBarColorClass(progress?: number | null, isLate = false) {
  if (progress === null || progress === undefined) {
    return "bg-slate-300";
  }

  if (isLate) {
    return "bg-rose-600";
  }

  if (progress <= 25) {
    return "bg-orange-500";
  }

  if (progress <= 50) {
    return "bg-amber-500";
  }

  if (progress <= 75) {
    return "bg-emerald-600";
  }

  return "bg-sky-500";
}
