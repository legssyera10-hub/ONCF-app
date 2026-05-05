import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  getRequesterLabel,
  getRequestedDestinationLabel,
  getRetainedDestinationLabel,
} from "../components/AlertRequestDetailsGrid";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Alert, AlertStatus, TransportMode, TransportType } from "../types";
import { parseConfirmedMaterialIndexes, parseMaterialConfirmations, parsePpmMaterialDecisions, buildAlertMaterialRows } from "../utils/alertMaterials";
import { formatDateOnly, formatDateTime, formatDelayMinutes, parseApiDate } from "../utils/format";
import { getPermanentDecisionReason } from "../utils/alertHistory";
import { getBusinessStatusLabel } from "../utils/status";

type RequestRow = {
  id: string;
  alertId: number;
  dossier: string;
  requestDate: string;
  requestDateKey: string;
  requester: string;
  stationDeDepart: string;
  destinationRequested: string;
  destinationRetained: string;
  destinationDisplayed: string;
  maintenanceState: string;
  mode: TransportMode;
  transportType: TransportType;
  ppmState: string;
  ppmReason: string;
  status: AlertStatus;
  receptionConfirmation: string;
  receptionDate: string;
  receptionSystemDate: string;
  materialType: string;
  serie: string;
  materialConcerned: string;
  problem: string;
  autresConditions: string;
  remarks: string;
  delayLabel: string;
  receptionLagMinutes: number | null;
  isCancelled: boolean;
};

type Option = { value: string; label: string };
type SortDirection = "asc" | "desc";
type SortKey =
  | "dossier"
  | "requestDate"
  | "requester"
  | "stationDeDepart"
  | "destinationDisplayed"
  | "maintenanceState"
  | "mode"
  | "transportType"
  | "ppmState"
  | "ppmReason"
  | "status"
  | "receptionConfirmation"
  | "receptionDate"
  | "receptionSystemDate"
  | "materialType"
  | "serie"
  | "materialConcerned"
  | "problem"
  | "autresConditions"
  | "remarks"
  | "delayLabel";

const ALL = "ALL";
const TECHNICENTRE_CODES = [
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
] as const;

function toTechnicentreCode(value: string) {
  const cleaned = value.replace(/^technicentre\s+/i, "").trim().toUpperCase();
  return TECHNICENTRE_CODES.includes(cleaned as (typeof TECHNICENTRE_CODES)[number]) ? cleaned : "";
}

function toCsvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeFilenameToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function delayLabelToMinutes(value: string) {
  const text = value.toLowerCase();
  if (!text || text.includes("a l'heure")) return 0;
  let total = 0;
  const dayMatch = text.match(/(\d+)\s*j/);
  const hourMatch = text.match(/(\d+)\s*h/);
  const minuteMatch = text.match(/(\d+)\s*min/);

  if (dayMatch) total += Number(dayMatch[1]) * 24 * 60;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minuteMatch) total += Number(minuteMatch[1]);

  if (total > 0) return total;
  const numeric = Number(text.replace(/[^\d]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return text.includes("d'avance") ? -numeric : numeric;
}

function exportFilteredRowsAsCsv(rows: RequestRow[], filenameSuffix: string) {
  const header = [
    "Dossier",
    "Date demande",
    "Demandeur",
    "Site de depart",
    "Destinataire",
    "Exploitant",
    "Mode acheminement",
    "Type acheminement",
    "Etat demande (PPM)",
    "Motif PPM (modification / annulation)",
    "Statut",
    "Confirmation reception",
    "Date de reception",
    "Date systeme de reception",
    "Type materiel",
    "Serie",
    "Materiel concerne",
    "Motif",
    "Autre conditions",
    "Observation",
    "Retard",
  ];

  const lines = rows.map((row) =>
    [
      `#${row.dossier}`,
      formatDateTime(row.requestDate),
      row.requester || "-",
      row.stationDeDepart || "-",
      row.destinationDisplayed,
      row.maintenanceState,
      row.mode,
      row.transportType,
      row.ppmState,
      row.ppmReason,
      getBusinessStatusLabel(row.status),
      row.receptionConfirmation,
      row.receptionDate ? formatDateTime(row.receptionDate) : "",
      row.receptionSystemDate ? formatDateTime(row.receptionSystemDate) : "",
      row.materialType,
      row.serie,
      row.materialConcerned,
      row.problem,
      row.autresConditions || "-",
      row.remarks || "",
      row.delayLabel,
    ]
      .map((cell) => toCsvCell(cell))
      .join(";")
  );

  const csv = [header.map((cell) => toCsvCell(cell)).join(";"), ...lines].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeSuffix = sanitizeFilenameToken(filenameSuffix);
  link.download = `demandes_acheminement_filtrees_${safeSuffix || "sans_filtres"}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function compareValues(a: string | number, b: string | number, direction: SortDirection) {
  if (typeof a === "number" && typeof b === "number") {
    return direction === "asc" ? a - b : b - a;
  }
  const compared = String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? compared : -compared;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toOptions(values: string[]): Option[] {
  const uniques = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return [{ value: ALL, label: "Tous" }, ...uniques.map((item) => ({ value: item, label: item }))];
}

function getReceptionConfirmationLabel(value: string) {
  if (value === "VALIDEE") return "Validée";
  if (value === "EN_INSTANCE") return "En instance";
  return "Non confirmée";
}

function getPpmStateLabel(value: string) {
  if (value === "ACCEPTEE") return "Acceptée";
  if (value === "A_MODIFIER") return "À modifier";
  if (value === "ANNULEE") return "Annulée";
  if (value === "MODIFIEE") return "Modifiée";
  return "En attente";
}

function computeLagMinutes(receptionDateIso: string, receptionSystemDateIso: string) {
  const receptionDate = parseApiDate(receptionDateIso);
  const receptionSystemDate = parseApiDate(receptionSystemDateIso);
  if (!receptionDate || !receptionSystemDate) {
    return null;
  }
  return Math.round((receptionSystemDate.getTime() - receptionDate.getTime()) / 60000);
}

function formatInstanceDuration(minutes: number) {
  if (minutes <= 0) return "0min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

function buildInstanceObservation(
  confirmation: ReturnType<typeof parseMaterialConfirmations>[number]
) {
  if (!confirmation) return "";

  const hasActiveInstance =
    confirmation.reception_status === "EN_INSTANCE" && confirmation.instance_used_once === true;
  const instanceDurationMinutes = confirmation.en_instance_total_minutes;
  const hadInstanceDuration =
    typeof instanceDurationMinutes === "number" &&
    instanceDurationMinutes >= 0 &&
    confirmation.instance_used_once === true &&
    confirmation.reception_status !== "EN_INSTANCE";

  if (hasActiveInstance) {
    const startedAt =
      parseApiDate(confirmation.last_instance_started_at) ??
      parseApiDate(confirmation.en_instance_started_at) ??
      parseApiDate(confirmation.confirmed_at);
    return startedAt ? `mis en instance le ${formatDateTime(startedAt.toISOString())}` : "";
  }

  if (hadInstanceDuration) {
    const endedAt =
      parseApiDate(confirmation.instance_ended_at) ??
      parseApiDate(confirmation.reception_date) ??
      parseApiDate(confirmation.confirmed_at);
    if (!endedAt) return "";

    const startedAt =
      parseApiDate(confirmation.last_instance_started_at) ??
      new Date(endedAt.getTime() - instanceDurationMinutes * 60_000);

    return `etait en instance durant la periode du ${formatDateTime(startedAt.toISOString())} au ${formatDateTime(
      endedAt.toISOString()
    )} (${formatInstanceDuration(instanceDurationMinutes)})`;
  }

  return "";
}

function HorizontalBars({
  title,
  accentClass,
  items,
  highlightedTotal,
}: {
  title: string;
  accentClass: string;
  items: Array<{ label: string; value: number }>;
  highlightedTotal?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {highlightedTotal ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
            {highlightedTotal}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate-500">Aucune donnee.</p> : null}
        {items.map((item) => {
          const width = Math.max(3, Math.round((item.value / max) * 100));
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <span className="truncate">{item.label}</span>
                <span className="font-semibold text-slate-800">{item.value}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100">
                <div className={`h-2.5 rounded-full ${accentClass}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrackingRequestsVisionPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [requestDate, setRequestDate] = useState("");
  const [requestDateFrom, setRequestDateFrom] = useState("");
  const [requestDateTo, setRequestDateTo] = useState("");
  const [requesterFilter, setRequesterFilter] = useState(ALL);
  const [destinationFilter, setDestinationFilter] = useState(ALL);
  const [maintenanceFilter, setMaintenanceFilter] = useState(ALL);
  const [modeFilter, setModeFilter] = useState(ALL);
  const [transportTypeFilter, setTransportTypeFilter] = useState(ALL);
  const [ppmStateFilter, setPpmStateFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [receptionFilter, setReceptionFilter] = useState(ALL);
  const [materialTypeFilter, setMaterialTypeFilter] = useState(ALL);
  const [serieFilter, setSerieFilter] = useState(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("requestDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  async function load() {
    if (!token) {
      return;
    }
    try {
      setError("");
      const result = await api.alerts(token);
      setAlerts(result);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des demandes");
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useLiveAlerts(Boolean(token), load, () => undefined);

  const rows = useMemo<RequestRow[]>(() => {
    return alerts.flatMap((alert) => {
      const materialRows = buildAlertMaterialRows(alert);
      const confirmations = parseMaterialConfirmations(alert.establishment_confirmation?.material_confirmations);
      const confirmedIndexes = parseConfirmedMaterialIndexes(alert.establishment_confirmation?.confirmed_material_indexes);
      const ppmDecisions = parsePpmMaterialDecisions(alert.permanent_decision?.material_decisions);
      const globalPpmReason = getPermanentDecisionReason(alert) ?? "";
      const globalPpmStatus =
        alert.status === "A_MODIFIER"
          ? "A_MODIFIER"
          : alert.status === "MODIFIEE"
            ? "MODIFIEE"
            : alert.status === "ANNULEE"
              ? "ANNULEE"
              : null;

      return materialRows.map((materialRow) => {
        const confirmation = confirmations[materialRow.index];
        const isConfirmed = Boolean(confirmation?.confirmed) || confirmedIndexes.includes(materialRow.index);
        const receptionState =
          confirmation?.reception_status === "VALIDEE"
            ? "VALIDEE"
            : confirmation?.reception_status === "EN_INSTANCE"
              ? "EN_INSTANCE"
              : isConfirmed
                ? "VALIDEE"
                : "NOT_CONFIRMED";

        const rawPpmState = ppmDecisions[materialRow.index]?.ppm_status ?? globalPpmStatus ?? "PENDING";
        const isCancelled = rawPpmState === "ANNULEE";
        const isInInstance = receptionState === "EN_INSTANCE";
        const isAcceptedAndNotConfirmed = rawPpmState === "ACCEPTEE" && receptionState === "NOT_CONFIRMED";
        const isPpmPending = rawPpmState === "PENDING";
        const ppmState = getPpmStateLabel(rawPpmState);
        const ppmReason =
          ppmDecisions[materialRow.index]?.ppm_reason ??
          (rawPpmState === "A_MODIFIER" || rawPpmState === "ANNULEE" || rawPpmState === "MODIFIEE" ? globalPpmReason : "");
        const destinationRequested = getRequestedDestinationLabel(alert);
        const destinationRetained = getRetainedDestinationLabel(alert);
        const requestIso = alert.request_date ?? alert.created_at;
        const parsedRequestDate = parseApiDate(requestIso);
        const requestDateKey = parsedRequestDate ? toLocalDateKey(parsedRequestDate) : "";
        const hasFinalReceptionValidation = confirmation?.reception_status === "VALIDEE" || isConfirmed;
        const rowReceptionDate = hasFinalReceptionValidation ? confirmation?.reception_date ?? "" : "";
        const rowReceptionSystemDate = hasFinalReceptionValidation
          ? confirmation?.confirmed_at ?? (isConfirmed ? alert.establishment_confirmation?.confirmed_at ?? "" : "")
          : "";
        const receptionLagMinutes =
          rowReceptionDate && rowReceptionSystemDate ? computeLagMinutes(rowReceptionDate, rowReceptionSystemDate) : null;

        const delayValue =
          hasFinalReceptionValidation && confirmation?.delay_minutes != null
            ? confirmation.delay_minutes
            : isConfirmed
              ? alert.establishment_confirmation?.delay_minutes
              : null;
        const rowPmReferenceDate =
          parseApiDate(ppmDecisions[materialRow.index]?.updated_at) ?? parseApiDate(alert.permanent_decision?.created_at);
        const ongoingDelayMinutes =
          rawPpmState === "ACCEPTEE" && !hasFinalReceptionValidation && rowPmReferenceDate
            ? Math.floor((Date.now() - rowPmReferenceDate.getTime()) / 60000)
            : null;
        const instanceObservation = buildInstanceObservation(confirmation);
        const baseObservation =
          confirmation?.remarks ?? (isConfirmed ? alert.establishment_confirmation?.remarks ?? "" : "");
        const observation = [baseObservation, instanceObservation]
          .filter((value) => value && value.trim().length > 0)
          .join(" ");

        return {
          id: materialRow.id,
          alertId: alert.id,
          dossier: alert.dossier_label ?? String(alert.id),
          requestDate: requestIso,
          requestDateKey,
          requester: toTechnicentreCode(getRequesterLabel(alert)),
          stationDeDepart: alert.station?.name || "-",
          destinationRequested,
          destinationRetained,
          destinationDisplayed: toTechnicentreCode(destinationRetained || destinationRequested || "") || "-",
          maintenanceState: alert.maintenance_state,
          mode: alert.transport_mode,
          transportType: alert.transport_type,
          ppmState,
          ppmReason,
          status: isCancelled
            ? "ANNULEE"
            : isPpmPending
              ? "EN_COURS_DE_TRAITEMENT"
            : hasFinalReceptionValidation
              ? "RECEPTION_COMPLETE"
              : isInInstance
                ? "TRAITEE_PAR_PM"
              : isAcceptedAndNotConfirmed
                ? "TRAITEE_PAR_PM"
              : alert.status,
          receptionConfirmation: getReceptionConfirmationLabel(receptionState),
          receptionDate: rowReceptionDate,
          receptionSystemDate: rowReceptionSystemDate,
          materialType: materialRow.type,
          serie: materialRow.serie,
          materialConcerned: materialRow.concerned,
          problem: alert.problem_description,
          autresConditions: alert.transport_conditions_initial || "-",
          remarks: observation,
          isCancelled,
          delayLabel:
            delayValue != null
              ? formatDelayMinutes(delayValue)
              : ongoingDelayMinutes != null
                ? `${formatDelayMinutes(ongoingDelayMinutes)} (en cours)`
                : "",
          receptionLagMinutes,
        };
      });
    });
  }, [alerts]);

  const requesterOptions = useMemo(
    () => [{ value: ALL, label: "Tous" }, ...TECHNICENTRE_CODES.map((code) => ({ value: code, label: code }))],
    []
  );
  const destinationOptions = useMemo(
    () => [{ value: ALL, label: "Tous" }, ...TECHNICENTRE_CODES.map((code) => ({ value: code, label: code }))],
    []
  );
  const maintenanceOptions = useMemo(
    () => [
      { value: ALL, label: "Tous" },
      { value: "PV", label: "PV" },
      { value: "PFL", label: "PFL" },
    ],
    []
  );
  const modeOptions = useMemo(() => toOptions(rows.map((row) => row.mode)), [rows]);
  const transportTypeOptions = useMemo(() => toOptions(rows.map((row) => row.transportType)), [rows]);
  const materialTypeOptions = useMemo(
    () => [
      { value: ALL, label: "Tous" },
      { value: "MM", label: "MM" },
      { value: "MR", label: "MR" },
    ],
    []
  );
  const serieOptions = useMemo(() => toOptions(rows.map((row) => row.serie)), [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return rows.filter((row) => {
      if (requestDate && row.requestDateKey !== requestDate) return false;
      if (requestDateFrom && (!row.requestDateKey || row.requestDateKey < requestDateFrom)) return false;
      if (requestDateTo && (!row.requestDateKey || row.requestDateKey > requestDateTo)) return false;
      if (requesterFilter !== ALL && row.requester !== requesterFilter) return false;
      if (destinationFilter !== ALL && row.destinationDisplayed !== destinationFilter) return false;
      if (maintenanceFilter !== ALL && row.maintenanceState !== maintenanceFilter) return false;
      if (modeFilter !== ALL && row.mode !== modeFilter) return false;
      if (transportTypeFilter !== ALL && row.transportType !== transportTypeFilter) return false;
      if (ppmStateFilter !== ALL && row.ppmState !== ppmStateFilter) return false;
      if (statusFilter !== ALL && row.status !== statusFilter) return false;
      if (receptionFilter !== ALL && row.receptionConfirmation !== receptionFilter) return false;
      if (materialTypeFilter !== ALL && row.materialType !== materialTypeFilter) return false;
      if (serieFilter !== ALL && row.serie !== serieFilter) return false;

      if (!normalizedQuery) return true;

      return normalize(row.dossier).includes(normalizedQuery);
    });
  }, [
    rows,
    query,
    requestDate,
    requestDateFrom,
    requestDateTo,
    requesterFilter,
    destinationFilter,
    maintenanceFilter,
    modeFilter,
    transportTypeFilter,
    ppmStateFilter,
    statusFilter,
    receptionFilter,
    materialTypeFilter,
    serieFilter,
  ]);

  const sortedRows = useMemo(() => {
    const getSortValue = (row: RequestRow): string | number => {
      if (sortKey === "requestDate") return new Date(row.requestDate).getTime();
      if (sortKey === "receptionDate") return row.receptionDate ? new Date(row.receptionDate).getTime() : 0;
      if (sortKey === "receptionSystemDate") return row.receptionSystemDate ? new Date(row.receptionSystemDate).getTime() : 0;
      if (sortKey === "dossier") return Number(row.dossier) || row.dossier;
      if (sortKey === "status") return getBusinessStatusLabel(row.status);
      if (sortKey === "delayLabel") return delayLabelToMinutes(row.delayLabel);
      return row[sortKey] ?? "";
    };

    return [...filteredRows].sort((a, b) => compareValues(getSortValue(a), getSortValue(b), sortDirection));
  }, [filteredRows, sortDirection, sortKey]);

  const exportSuffix = useMemo(() => {
    const parts: string[] = [];
    if (requestDate) parts.push(`date-${requestDate}`);
    if (requestDateFrom) parts.push(`de-${requestDateFrom}`);
    if (requestDateTo) parts.push(`a-${requestDateTo}`);
    if (requesterFilter !== ALL) parts.push(`demandeur-${requesterFilter}`);
    if (destinationFilter !== ALL) parts.push(`dest-${destinationFilter}`);
    if (maintenanceFilter !== ALL) parts.push(`expl-${maintenanceFilter}`);
    if (modeFilter !== ALL) parts.push(`mode-${modeFilter}`);
    if (transportTypeFilter !== ALL) parts.push(`type-${transportTypeFilter}`);
    if (ppmStateFilter !== ALL) parts.push(`ppm-${ppmStateFilter}`);
    if (statusFilter !== ALL) parts.push(`statut-${statusFilter}`);
    if (receptionFilter !== ALL) parts.push(`reception-${receptionFilter}`);
    if (materialTypeFilter !== ALL) parts.push(`materiel-${materialTypeFilter}`);
    if (serieFilter !== ALL) parts.push(`serie-${serieFilter}`);
    if (query.trim()) parts.push(`recherche-${query.trim().slice(0, 24)}`);
    parts.push(`tri-${sortKey}-${sortDirection}`);
    return parts.join("_");
  }, [
    destinationFilter,
    maintenanceFilter,
    materialTypeFilter,
    modeFilter,
    ppmStateFilter,
    query,
    receptionFilter,
    requestDate,
    requestDateFrom,
    requestDateTo,
    requesterFilter,
    serieFilter,
    sortDirection,
    sortKey,
    statusFilter,
    transportTypeFilter,
  ]);

  const statusBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredRows) {
      const label = getBusinessStatusLabel(row.status);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredRows]);

  const operatorComparison = useMemo(() => {
    const seed = {
      PV: { key: "PV", total: 0, completed: 0, delayCount: 0, delaySum: 0 },
      PFL: { key: "PFL", total: 0, completed: 0, delayCount: 0, delaySum: 0 },
    };

    for (const row of filteredRows) {
      const normalizedOperator = normalize(row.maintenanceState).toUpperCase();
      const bucketKey = normalizedOperator.includes("PV")
        ? "PV"
        : normalizedOperator.includes("PFL")
          ? "PFL"
          : null;
      if (!bucketKey) continue;
      if (row.status === "ANNULEE" || row.status === "A_MODIFIER" || row.status === "MODIFIEE") continue;

      const bucket = seed[bucketKey];
      if (row.isCancelled) continue;
      bucket.total += 1;
      if (row.receptionConfirmation === "Validée") {
        bucket.completed += 1;
      }

      const delay = delayLabelToMinutes(row.delayLabel);
      if (delay > 0) {
        bucket.delayCount += 1;
        bucket.delaySum += delay;
      }
    }

    return [seed.PV, seed.PFL].map((item) => ({
      ...item,
      avgDelay: item.delayCount > 0 ? Math.round(item.delaySum / item.delayCount) : null,
      completionRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
    }));
  }, [filteredRows]);

  const maxModeValue = Math.max(
    1,
    ...operatorComparison.map((item) => Math.max(item.total, item.completed))
  );
  const materialsLast7Days = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days: Array<{
      key: string;
      label: string;
      total: number;
      completed: number;
      pending: number;
      cancelled: number;
      completionRate: number;
    }> = [];

    for (let offset = 0; offset <= 6; offset += 1) {
      const day = new Date(end);
      day.setDate(end.getDate() - offset);
      const key = toLocalDateKey(day);
      const label = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(day);
      days.push({ key, label, total: 0, completed: 0, pending: 0, cancelled: 0, completionRate: 0 });
    }

    const byDay = new Map(days.map((day) => [day.key, day]));
    for (const row of filteredRows) {
      const normalizedPpmState = normalize(row.ppmState);
      if (normalizedPpmState === "a modifier" || normalizedPpmState === "modifiee") {
        continue;
      }
      const parsed = parseApiDate(row.requestDate);
      if (!parsed) continue;
      const key = toLocalDateKey(parsed);
      const target = byDay.get(key);
      if (!target) continue;
      target.total += 1;
      if (row.isCancelled) {
        target.cancelled += 1;
      } else if (row.receptionConfirmation === "Validée") {
        target.completed += 1;
      } else {
        target.pending += 1;
      }
    }

    for (const day of days) {
      day.completionRate = day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0;
    }

    return days;
  }, [filteredRows]);

  const maxDailyMaterials = Math.max(1, ...materialsLast7Days.map((day) => day.total));

  const totalRequests = sortedRows.length;
  const totalDossiers = new Set(sortedRows.map((item) => item.dossier)).size;
  const receivedCount = sortedRows.filter((item) => item.receptionConfirmation === "Validée").length;
  const instanceCount = sortedRows.filter((item) => item.receptionConfirmation === "En instance").length;
  const cancelledCount = sortedRows.filter((item) => item.isCancelled).length;
  const pendingReceptionCount = sortedRows.filter(
    (item) => item.ppmState === "Acceptée" && item.receptionConfirmation === "Non confirmée"
  ).length;
  const aModifierCount = sortedRows.filter(
    (item) => normalize(item.ppmState) === "a modifier" && item.status === "A_MODIFIER"
  ).length;
  const modifieeCount = sortedRows.filter(
    (item) => normalize(item.ppmState) === "modifiee" && item.status === "MODIFIEE"
  ).length;
  const accepteePpmCount = sortedRows.filter(
    (item) => normalize(item.ppmState) === "acceptee"
  ).length;
  const ppmDecisionPendingCount = sortedRows.filter(
    (item) => normalize(item.ppmState) === "en attente" && item.status === "EN_COURS_DE_TRAITEMENT"
  ).length;
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (query.trim()) count += 1;
    if (requestDate) count += 1;
    if (requestDateFrom) count += 1;
    if (requestDateTo) count += 1;
    if (requesterFilter !== ALL) count += 1;
    if (destinationFilter !== ALL) count += 1;
    if (maintenanceFilter !== ALL) count += 1;
    if (modeFilter !== ALL) count += 1;
    if (transportTypeFilter !== ALL) count += 1;
    if (ppmStateFilter !== ALL) count += 1;
    if (statusFilter !== ALL) count += 1;
    if (receptionFilter !== ALL) count += 1;
    if (materialTypeFilter !== ALL) count += 1;
    if (serieFilter !== ALL) count += 1;
    return count;
  }, [
    query,
    requestDate,
    requestDateFrom,
    requestDateTo,
    requesterFilter,
    destinationFilter,
    maintenanceFilter,
    modeFilter,
    transportTypeFilter,
    ppmStateFilter,
    statusFilter,
    receptionFilter,
    materialTypeFilter,
    serieFilter,
  ]);
  const cellPaddingClass = "px-3 py-2";
  const tableTextClass = "text-sm";

  function resetFilters() {
    setQuery("");
    setRequestDate("");
    setRequestDateFrom("");
    setRequestDateTo("");
    setRequesterFilter(ALL);
    setDestinationFilter(ALL);
    setMaintenanceFilter(ALL);
    setModeFilter(ALL);
    setTransportTypeFilter(ALL);
    setPpmStateFilter(ALL);
    setStatusFilter(ALL);
    setReceptionFilter(ALL);
    setMaterialTypeFilter(ALL);
    setSerieFilter(ALL);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "requestDate" ? "desc" : "asc");
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel border border-slate-200 bg-[radial-gradient(circle_at_20%_0%,rgba(14,116,144,0.14),transparent_48%),radial-gradient(circle_at_82%_0%,rgba(30,64,175,0.12),transparent_42%),linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Visionnement demandes</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard des demandes d'acheminement</h2>
            <p className="mt-1 text-xs text-slate-500">
              {lastUpdatedAt ? `Statistiques reelles, mises a jour: ${formatDateTime(lastUpdatedAt)}` : "Statistiques reelles."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Demandes visibles</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totalRequests}</p>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dossiers couverts</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{totalDossiers}</p>
          </div>

          <div className="rounded-[1.4rem] border border-emerald-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Section recepteur</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Receptions validees</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{receivedCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">En instance</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{instanceCount}</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Receptions en attente</p>
                <p className="mt-2 text-2xl font-semibold text-sky-800">{pendingReceptionCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-fuchsia-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Section permanent PPM</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Acceptee</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{accepteePpmCount}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Annulations</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{cancelledCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">A modifier</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{aModifierCount}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-700">Modifiee</p>
                <p className="mt-2 text-2xl font-semibold text-fuchsia-800">{modifieeCount}</p>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-indigo-700">Decision PPM en attente</p>
                <p className="mt-2 text-2xl font-semibold text-indigo-800">{ppmDecisionPendingCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden border border-slate-200/80 bg-white p-0">
        <div className="relative bg-[radial-gradient(circle_at_12%_12%,rgba(14,165,233,0.18),transparent_38%),radial-gradient(circle_at_88%_0%,rgba(2,132,199,0.14),transparent_42%),linear-gradient(120deg,#f8fafc,#ffffff)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Filtres Avances</p>
              <p className="mt-1 text-sm text-slate-600">
                {activeFiltersCount > 0 ? `${activeFiltersCount} filtre(s) actif(s)` : "Aucun filtre actif"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-label="Export Excel"
                  onClick={() => exportFilteredRowsAsCsv(sortedRows, exportSuffix)}
                  disabled={sortedRows.length === 0}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                    sortedRows.length === 0 ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="#10703e" />
                    <path d="M7 9h10M7 13h6" stroke="#fff" strokeWidth="1.6" />
                  </svg>
                  <span>Export Excel</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Reinitialiser
              </button>
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_34px_-20px_rgba(2,132,199,0.85)] transition hover:-translate-y-0.5 hover:from-sky-700 hover:to-cyan-600"
              >
                {filtersOpen ? "Masquer les filtres" : "Afficher les filtres"}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`h-4 w-4 transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 8 5 5 5-5" />
                </svg>
              </button>
            </div>
          </div>

          {!filtersOpen ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Recherche: {query.trim() ? `"${query.trim()}"` : "Aucune"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Date: {requestDate || (requestDateFrom || requestDateTo ? `${requestDateFrom || "..."} -> ${requestDateTo || "..."}` : "Toutes")}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Destinataire: {destinationFilter === ALL ? "Tous" : destinationFilter}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Statut: {statusFilter === ALL ? "Tous" : statusFilter}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className={`grid transition-all duration-500 ease-out ${filtersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"}`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-slate-100 bg-white p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recherche dossier</span>
                  <input className="input" placeholder="Recherche dossier" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date de la demande</span>
                  <input
                    className="input"
                    type="date"
                    value={requestDate}
                    onChange={(e) => {
                      setRequestDate(e.target.value);
                      setRequestDateFrom("");
                      setRequestDateTo("");
                    }}
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Periode (du / au)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      type="date"
                      value={requestDateFrom}
                      onChange={(e) => {
                        setRequestDateFrom(e.target.value);
                        setRequestDate("");
                      }}
                    />
                    <input
                      className="input"
                      type="date"
                      value={requestDateTo}
                      onChange={(e) => {
                        setRequestDateTo(e.target.value);
                        setRequestDate("");
                      }}
                    />
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Demandeur</span>
                  <select className="input" value={requesterFilter} onChange={(e) => setRequesterFilter(e.target.value)}>
                    {requesterOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destinataire</span>
                  <select className="input" value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}>
                    {destinationOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exploitant</span>
                  <select className="input" value={maintenanceFilter} onChange={(e) => setMaintenanceFilter(e.target.value)}>
                    {maintenanceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode d'acheminement</span>
                  <select className="input" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                    {modeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Type d'acheminement</span>
                  <select className="input" value={transportTypeFilter} onChange={(e) => setTransportTypeFilter(e.target.value)}>
                    {transportTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Etat demande (PPM)</span>
                  <select className="input" value={ppmStateFilter} onChange={(e) => setPpmStateFilter(e.target.value)}>
                    <option value={ALL}>Tous etats demande (PPM)</option>
                    <option value="En attente">En attente</option>
                    <option value="Acceptée">Acceptée</option>
                    <option value="Annulée">Annulée</option>
                    <option value="Modifiée">Modifiée</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statut</span>
                  <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value={ALL}>Tous statuts</option>
                    <option value="EN_COURS_DE_TRAITEMENT">En cours de traitement</option>
                    <option value="TRAITEE_PAR_PM">Traitée par PPM</option>
                    <option value="A_MODIFIER">À modifier</option>
                    <option value="MODIFIEE">Modifiée</option>
                    <option value="ANNULEE">Annulée</option>
                    <option value="RECEPTION_PARTIELLE">Réception partielle</option>
                    <option value="RECEPTION_COMPLETE">Réception complète</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmation reception</span>
                  <select className="input" value={receptionFilter} onChange={(e) => setReceptionFilter(e.target.value)}>
                    <option value={ALL}>Toutes confirmations reception</option>
                    <option value="Non confirmée">Non confirmée</option>
                    <option value="En instance">En instance</option>
                    <option value="Validée">Validée</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Type materiel</span>
                  <select className="input" value={materialTypeFilter} onChange={(e) => setMaterialTypeFilter(e.target.value)}>
                    {materialTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Serie</span>
                  <select className="input" value={serieFilter} onChange={(e) => setSerieFilter(e.target.value)}>
                    {serieOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Demandes vs acheminements realises (par exploitant)</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {operatorComparison.map((operator) => {
              const totalHeight = Math.max(8, Math.round((operator.total / maxModeValue) * 100));
              const completedHeight = Math.max(8, Math.round((operator.completed / maxModeValue) * 100));
              return (
                <div key={operator.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">{operator.key}</span>
                    <span>{operator.completionRate}% realise</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-5">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-28 w-20 items-end rounded-md bg-slate-100/80 p-1">
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-sky-600 to-sky-400"
                          style={{ height: `${totalHeight}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{operator.total}</span>
                      <span className="text-[11px] text-slate-500">Demandes</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-28 w-20 items-end rounded-md bg-slate-100/80 p-1">
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-emerald-600 to-emerald-400"
                          style={{ height: `${completedHeight}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{operator.completed}</span>
                      <span className="text-[11px] text-slate-500">Realisees</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Retard moyen:{" "}
                    <span className="font-semibold text-slate-800">
                      {operator.avgDelay !== null ? formatDelayMinutes(operator.avgDelay) : "Aucun retard"}
                    </span>
                  </div>
                </div>
              );
            })}
            {operatorComparison.every((operator) => operator.total === 0) ? (
              <p className="text-sm text-slate-500">Aucune donnee PV/PFL pour les filtres actifs.</p>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              Demandes
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Acheminements realises (reception validee)
            </span>
          </div>
        </div>

        <HorizontalBars
          title="Repartition par statut"
          accentClass="bg-sky-500"
          items={statusBars}
          highlightedTotal={`${filteredRows.length} demande${filteredRows.length > 1 ? "s" : ""}`}
        />
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Demandes par jour (7 derniers jours)</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex h-44 items-end gap-2">
              {materialsLast7Days.map((day) => {
                const chartHeightPx = 132;
                const totalHeightPx =
                  day.total > 0 ? Math.max(8, Math.round((day.total / maxDailyMaterials) * chartHeightPx)) : 0;
                const completedShare = day.total > 0 ? day.completed / day.total : 0;
                const cancelledShare = day.total > 0 ? day.cancelled / day.total : 0;
                const completedHeightPx =
                  day.completed > 0 ? Math.max(6, Math.round(totalHeightPx * completedShare)) : 0;
                const cancelledHeightPx =
                  day.cancelled > 0 ? Math.max(6, Math.round(totalHeightPx * cancelledShare)) : 0;
                const pendingHeightPx = Math.max(0, totalHeightPx - completedHeightPx - cancelledHeightPx);
                return (
                <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="text-[11px] font-semibold text-slate-700">{day.total}</div>
                    <div className="relative flex h-[132px] w-full max-w-[42px] flex-col justify-end overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-[0_8px_16px_-14px_rgba(15,23,42,0.6)]">
                      <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-slate-200" />
                      {pendingHeightPx > 0 ? (
                        <div className="bg-gradient-to-t from-amber-500 to-amber-300" style={{ height: `${pendingHeightPx}px` }} />
                      ) : null}
                      {completedHeightPx > 0 ? (
                        <div className="bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${completedHeightPx}px` }} />
                      ) : null}
                      {cancelledHeightPx > 0 ? (
                        <div className="bg-gradient-to-t from-rose-700 to-rose-500" style={{ height: `${cancelledHeightPx}px` }} />
                      ) : null}
                      {totalHeightPx === 0 ? <div className="h-[2px] w-full bg-slate-300" /> : null}
                    </div>
                    <div className="text-[10px] text-slate-500">{day.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Realises
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Pas encore
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                Annulées
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          {totalRequests} demande(s) d'acheminement affichee(s)
        </div>

        <div className="overflow-x-auto">
          <table className={`min-w-[2450px] border-collapse text-slate-700 ${tableTextClass}`}>
            <thead>
              <tr className="bg-white">
                <th className={`border border-slate-200 bg-white text-left font-semibold ${cellPaddingClass}`}>
                  <button type="button" className="w-full text-left" onClick={() => toggleSort("dossier")}>Dossier{sortMark("dossier")}</button>
                </th>
                <th className={`border border-slate-200 bg-white text-left font-semibold ${cellPaddingClass}`}>
                  <button type="button" className="w-full text-left" onClick={() => toggleSort("requestDate")}>Date demande{sortMark("requestDate")}</button>
                </th>
                <th className={`border border-slate-200 bg-white text-left font-semibold ${cellPaddingClass}`}>
                  <button type="button" className="w-full text-left" onClick={() => toggleSort("requester")}>Demandeur{sortMark("requester")}</button>
                </th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}>
                  <button type="button" className="w-full text-left" onClick={() => toggleSort("stationDeDepart")}>Site de depart{sortMark("stationDeDepart")}</button>
                </th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("destinationDisplayed")}>Destinataire{sortMark("destinationDisplayed")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("maintenanceState")}>Exploitant{sortMark("maintenanceState")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("mode")}>Mode acheminement{sortMark("mode")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("transportType")}>Type acheminement{sortMark("transportType")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("ppmState")}>Etat demande (PPM){sortMark("ppmState")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("ppmReason")}>Motif PPM (modification / annulation){sortMark("ppmReason")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("status")}>Statut{sortMark("status")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("receptionConfirmation")}>Confirmation reception{sortMark("receptionConfirmation")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("receptionDate")}>Date de reception{sortMark("receptionDate")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("receptionSystemDate")}>Date systeme de reception{sortMark("receptionSystemDate")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("materialType")}>Type materiel{sortMark("materialType")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("serie")}>Serie{sortMark("serie")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("materialConcerned")}>Materiel concerne{sortMark("materialConcerned")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("problem")}>Motif{sortMark("problem")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("autresConditions")}>Autre conditions{sortMark("autresConditions")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("remarks")}>Observation{sortMark("remarks")}</button></th>
                <th className={`border border-slate-200 text-left font-semibold ${cellPaddingClass}`}><button type="button" className="w-full text-left" onClick={() => toggleSort("delayLabel")}>Retard{sortMark("delayLabel")}</button></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const isCompletedRow = row.receptionConfirmation === "Validée" && !row.isCancelled;
                const isInstanceRow = row.receptionConfirmation === "En instance" && !row.isCancelled;
                const isPpmPendingRow =
                  normalize(row.ppmState) === "en attente" && row.status === "EN_COURS_DE_TRAITEMENT";
                const normalizedPpmState = normalize(row.ppmState);
                const isPpmModifiedRow = normalizedPpmState === "modifiee";
                const ppmStateClass =
                  normalizedPpmState === "a modifier"
                    ? "font-semibold text-amber-700"
                    : isPpmModifiedRow
                      ? "font-semibold text-orange-700"
                      : normalizedPpmState === "annulee"
                        ? "font-semibold text-rose-700"
                        : normalizedPpmState === "acceptee"
                          ? "font-semibold text-emerald-700"
                          : "";
                const rowToneClass = row.isCancelled
                  ? "bg-rose-50 text-rose-900"
                  : isPpmModifiedRow
                    ? "bg-orange-50 text-orange-900"
                  : isPpmPendingRow
                    ? "bg-slate-100 text-slate-900"
                  : isInstanceRow
                    ? "bg-amber-50 text-amber-900"
                    : isCompletedRow
                    ? "bg-emerald-50 text-emerald-900"
                    : "";
                const rowBorderClass = row.isCancelled
                  ? "border-rose-200"
                  : isPpmModifiedRow
                    ? "border-orange-200"
                  : isPpmPendingRow
                    ? "border-slate-300"
                  : isInstanceRow
                    ? "border-amber-200"
                  : isCompletedRow
                    ? "border-emerald-200"
                    : "border-slate-200";
                return (
                <tr
                  key={row.id}
                  className={
                    row.isCancelled
                      ? "bg-rose-50/80"
                      : isPpmModifiedRow
                        ? "bg-orange-50/80"
                      : isPpmPendingRow
                        ? "bg-slate-100"
                      : isInstanceRow
                        ? "bg-amber-50/80"
                      : isCompletedRow
                        ? "bg-emerald-50/80"
                        : "odd:bg-white even:bg-slate-50/70"
                  }
                >
                  <td className={`border ${rowBorderClass} ${rowToneClass} font-semibold ${cellPaddingClass}`}>#{row.dossier}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>
                    <div>{formatDateOnly(row.requestDate)}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(row.requestDate)}</div>
                  </td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.requester || "-"}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.stationDeDepart}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>
                    {row.destinationRequested && row.destinationRetained && row.destinationRequested !== row.destinationRetained ? (
                      <div className="space-y-0.5">
                        <div className="line-through text-slate-500">{row.destinationRequested}</div>
                        <div className="font-medium text-slate-900">{row.destinationRetained}</div>
                      </div>
                    ) : (
                      <span className="whitespace-nowrap">{row.destinationDisplayed}</span>
                    )}
                  </td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.maintenanceState}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.mode}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.transportType}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${ppmStateClass} ${cellPaddingClass}`}>{row.ppmState}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.ppmReason}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{getBusinessStatusLabel(row.status)}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.receptionConfirmation}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.receptionDate ? formatDateTime(row.receptionDate) : ""}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.receptionSystemDate ? formatDateTime(row.receptionSystemDate) : ""}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.materialType}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.serie}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.materialConcerned}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.problem}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.autresConditions}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.remarks || ""}</td>
                  <td className={`border ${rowBorderClass} ${rowToneClass} ${cellPaddingClass}`}>{row.delayLabel}</td>
                </tr>
              )})}
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={21} className="border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Aucune demande d'acheminement ne correspond aux filtres.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}







