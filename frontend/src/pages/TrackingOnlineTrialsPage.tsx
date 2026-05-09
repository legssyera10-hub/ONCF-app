import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { AdminAlertFormConfig, OnlineTrial, Severity, Station } from "../types";
import { parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { formatDateOnly, formatDateTime, formatDelayMinutes, getApiTimestamp, parseApiDate } from "../utils/format";
import { parseOnlineTrialProgress, type OnlineTrialProgressEntry } from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";
import { getOnlineTrialCreatorLabel } from "../utils/onlineTrialCreator";

type Option = {
  value: string;
  label: string;
};

type TrialMaterialRow = {
  id: string;
  materialIndex: number;
  materialType: string;
  materialSerie: string;
  materialConcerned: string;
  delayMinutes: number | null;
  cancelOrModifyReason: string;
  resultCode: "CONCLUANT" | "NON_CONCLUANT" | "NON_RENSEIGNE";
  resultLabel: string;
  observation: string;
  trial: OnlineTrial;
};

const ALL = "ALL";

const DEFAULT_SPEED_OPTIONS = [
  "160",
  "150",
  "140",
  "130",
  "120",
  "110",
  "100",
  "90",
  "80",
  "70",
  "60",
  "50",
  "40",
  "30",
  "20",
  "10",
  "5",
];

const DEFAULT_TRIAL_FORM_CONFIG: AdminAlertFormConfig = {
  fields: {
    type_materiel: { required: true, options: ["MM", "MR"] },
    serie: {
      required: true,
      options: [
        "E1100",
        "E1250",
        "E1300",
        "E1350",
        "E1400",
        "E1450",
        "Z2M",
        "ZM",
        "DH350",
        "DH400",
        "WAGON",
        "VOITURE",
        "VOITURE+FG",
        "FG",
        "DI500",
        "DK550",
        "DM600",
        "DF100",
        "AUTRE",
      ],
    },
    mode_acheminement: { required: false, options: ["US", "UM", "-"] },
    etat_maintenance: { required: true, options: ["PFL", "PV"] },
    gravite: { required: true, options: ["NIVEAU_1", "NIVEAU_2"] },
    vitesse: { required: true, options: DEFAULT_SPEED_OPTIONS },
    materiel_concerne: { required: false, options: [] },
  },
};

function splitJoinedValues(value?: string | null) {
  return (value ?? "")
    .split(" + ")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeCode(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function toOptions(values: string[], fallbackLabel = "Tous"): Option[] {
  const uniques = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
  return [{ value: ALL, label: fallbackLabel }, ...uniques.map((item) => ({ value: item, label: item }))];
}

function getAverageDelayMinutes(trial: OnlineTrial): number | null {
  const progress = parseOnlineTrialProgress(trial.trial_material_progress);
  const delays = Object.values(progress)
    .map((entry) => entry.delay_minutes)
    .filter((value): value is number => typeof value === "number");
  if (delays.length === 0) return null;
  return Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length);
}

function getTrialDepartureStationId(trial: OnlineTrial) {
  return trial.departure_station?.id ?? trial.station.id;
}

function getTrialArrivalStationId(trial: OnlineTrial) {
  return trial.arrival_station?.id ?? trial.station.id;
}

function getTrialDepartureStationName(trial: OnlineTrial) {
  return trial.departure_station?.name ?? trial.station.name;
}

function getTrialArrivalStationName(trial: OnlineTrial) {
  return trial.arrival_station?.name ?? trial.station.name;
}

function getTrialDepartureDate(trial: OnlineTrial) {
  return trial.departure_date ?? trial.request_date ?? trial.created_at;
}

function getTrialDepartureDateKey(trial: OnlineTrial) {
  const parsed = parseApiDate(getTrialDepartureDate(trial));
  return parsed ? toLocalDateKey(parsed) : "";
}

function getSeverityLabel(value: string) {
  if (value === "NIVEAU_1") return "Sans";
  if (value === "NIVEAU_2") return "Avec";
  return value;
}

function getParcoursLabel(trial: OnlineTrial) {
  const aller = trial.parcours_aller !== false;
  const retour = trial.parcours_retour !== false;
  if (aller && retour) return "Aller / Retour";
  if (aller) return "Aller";
  if (retour) return "Retour";
  return "-";
}

function inferTrialResult(entry?: OnlineTrialProgressEntry): "CONCLUANT" | "NON_CONCLUANT" {
  if (entry?.result === "CONCLUANT" || entry?.result === "NON_CONCLUANT") {
    return entry.result;
  }
  return (entry?.remarks ?? "").trim().length > 0 ? "NON_CONCLUANT" : "CONCLUANT";
}

function getTrialResultPayload(entry?: OnlineTrialProgressEntry): {
  resultCode: "CONCLUANT" | "NON_CONCLUANT" | "NON_RENSEIGNE";
  resultLabel: string;
  observation: string;
} {
  if (!entry?.performed) {
    return {
      resultCode: "NON_RENSEIGNE",
      resultLabel: "-",
      observation: "-",
    };
  }

  const inferred = inferTrialResult(entry);
  return {
    resultCode: inferred,
    resultLabel: inferred === "NON_CONCLUANT" ? "Non Concluant" : "Concluant",
    observation: inferred === "NON_CONCLUANT" ? (entry.remarks ?? "").trim() || "-" : "-",
  };
}

function getGlobalCancelOrModifyReason(trial: OnlineTrial): string {
  const historyReason =
    [...trial.history]
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
      .find((item) => (item.status === "ANNULEE" || item.status === "A_MODIFIER") && (item.note || "").trim())
      ?.note?.trim() ?? "";
  return historyReason || trial.permanent_decision?.comment?.trim() || "";
}

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExcludedDossier(trial: OnlineTrial) {
  if (trial.dossier_number === 3 || trial.id === 3) return true;
  const label = (trial.dossier_label ?? "").replace(/^#/, "").trim();
  if (!label) return false;
  return /^3(?:\s*\(\d+\))?$/.test(label);
}

function getDossierSortNumber(trial: OnlineTrial) {
  if (typeof trial.dossier_number === "number" && Number.isFinite(trial.dossier_number)) {
    return trial.dossier_number;
  }
  const label = (trial.dossier_label ?? "").replace(/^#/, "").trim();
  const numericPart = label.match(/^(\d+)/);
  if (numericPart) {
    return Number(numericPart[1]);
  }
  return trial.id;
}

function toCsvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
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

function buildTrialMaterialRows(trial: OnlineTrial): TrialMaterialRow[] {
  const materialTypes = splitJoinedValues(trial.material_type);
  const materialSeries = splitJoinedValues(trial.material_ref);
  const concernedMaterials = splitJoinedValues(trial.material_concerned);
  const progressByMaterial = parseOnlineTrialProgress(trial.trial_material_progress);
  const ppmDecisions = parsePpmMaterialDecisions(trial.permanent_decision?.material_decisions);
  const globalCancelOrModifyReason = getGlobalCancelOrModifyReason(trial);
  const defaultDelay = getAverageDelayMinutes(trial);
  const count = Math.max(materialTypes.length, materialSeries.length, concernedMaterials.length, 1);

  return Array.from({ length: count }, (_, index) => {
    const rowProgress = progressByMaterial[index];
    const perMaterialDelay = rowProgress?.delay_minutes;
    const rowResult = getTrialResultPayload(rowProgress);
    const cancelOrModifyReason =
      (ppmDecisions[index]?.ppm_reason || "").trim() ||
      (trial.status === "ANNULEE" || trial.status === "A_MODIFIER" || trial.status === "MODIFIEE"
        ? globalCancelOrModifyReason
        : "") ||
      "-";
    return {
      id: `${trial.id}-${index}`,
      materialIndex: index,
      materialType: materialTypes[index] || materialTypes[0] || "-",
      materialSerie: materialSeries[index] || materialSeries[0] || "-",
      materialConcerned: concernedMaterials[index] || "-",
      delayMinutes: typeof perMaterialDelay === "number" ? perMaterialDelay : defaultDelay,
      cancelOrModifyReason,
      resultCode: rowResult.resultCode,
      resultLabel: rowResult.resultLabel,
      observation: rowResult.observation,
      trial,
    };
  });
}

export function TrackingOnlineTrialsPage() {
  const { token } = useAuth();
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [trialFormConfig, setTrialFormConfig] = useState<AdminAlertFormConfig>(DEFAULT_TRIAL_FORM_CONFIG);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [parcoursFilter, setParcoursFilter] = useState(ALL);
  const [departureStationFilter, setDepartureStationFilter] = useState(ALL);
  const [arrivalStationFilter, setArrivalStationFilter] = useState(ALL);
  const [departureDateFilter, setDepartureDateFilter] = useState("");
  const [departureDateFromFilter, setDepartureDateFromFilter] = useState("");
  const [departureDateToFilter, setDepartureDateToFilter] = useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = useState(ALL);
  const [serieFilter, setSerieFilter] = useState(ALL);
  const [materialConcernedFilter, setMaterialConcernedFilter] = useState("");
  const [modeFilter, setModeFilter] = useState(ALL);
  const [maintenanceFilter, setMaintenanceFilter] = useState(ALL);
  const [severityFilter, setSeverityFilter] = useState(ALL);
  const [speedFilter, setSpeedFilter] = useState(ALL);
  const [resultFilter, setResultFilter] = useState(ALL);

  async function load() {
    if (!token) return;
    try {
      setError("");
      const [trialsResult, stationsResult, configResult] = await Promise.all([
        api.onlineTrials(token),
        api.stations(token),
        api.onlineTrialFormConfig(token),
      ]);
      setTrials(trialsResult);
      setStations(stationsResult);
      setTrialFormConfig(configResult);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des essais");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const stationOptions = useMemo<Option[]>(
    () => [{ value: ALL, label: "Toutes" }, ...stations.map((item) => ({ value: String(item.id), label: item.name }))],
    [stations]
  );

  const materialTypeOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.type_materiel?.options ?? [];
    const fromData = trials.flatMap((item) => splitJoinedValues(item.material_type));
    return toOptions([...fromConfig, ...fromData], "Tous");
  }, [trialFormConfig, trials]);

  const serieOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.serie?.options ?? [];
    const fromData = trials.flatMap((item) => splitJoinedValues(item.material_ref));
    return toOptions([...fromConfig, ...fromData], "Toutes");
  }, [trialFormConfig, trials]);

  const modeOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.mode_acheminement?.options ?? [];
    const fromData = trials.map((item) => normalizeCode(item.transport_mode));
    return toOptions([...fromConfig, ...fromData], "Tous");
  }, [trialFormConfig, trials]);

  const maintenanceOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.etat_maintenance?.options ?? [];
    const fromData = trials.map((item) => normalizeCode(item.maintenance_state));
    return toOptions([...fromConfig, ...fromData], "Tous");
  }, [trialFormConfig, trials]);

  const severityOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.gravite?.options ?? [];
    const fromData = trials.map((item) => normalizeCode(item.severity));
    const uniques = Array.from(new Set([...fromConfig, ...fromData].filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
    return [{ value: ALL, label: "Tous" }, ...uniques.map((value) => ({ value, label: getSeverityLabel(value) }))];
  }, [trialFormConfig, trials]);

  const speedOptions = useMemo(() => {
    const fromConfig = trialFormConfig.fields?.vitesse?.options ?? [];
    const fromData = trials
      .map((item) => (typeof item.speed_kmh === "number" ? String(item.speed_kmh) : ""))
      .filter(Boolean);
    return toOptions([...fromConfig, ...fromData, ...DEFAULT_SPEED_OPTIONS], "Toutes");
  }, [trialFormConfig, trials]);

  const resultOptions = useMemo<Option[]>(
    () => [
      { value: ALL, label: "Tous" },
      { value: "CONCLUANT", label: "Concluant" },
      { value: "NON_CONCLUANT", label: "Non Concluant" },
      { value: "NON_RENSEIGNE", label: "Non renseigne" },
    ],
    []
  );

  const filteredRows = useMemo(
    () =>
      trials
        .flatMap((trial) => buildTrialMaterialRows(trial))
        .filter((row) => !isExcludedDossier(row.trial))
        .filter((row) => {
          const trial = row.trial;
          if (parcoursFilter !== ALL) {
            const aller = trial.parcours_aller !== false;
            const retour = trial.parcours_retour !== false;
            if (parcoursFilter === "ALLER" && !aller) return false;
            if (parcoursFilter === "RETOUR" && !retour) return false;
            if (parcoursFilter === "ALLER_RETOUR" && !(aller && retour)) return false;
          }
          if (departureStationFilter !== ALL && String(getTrialDepartureStationId(trial)) !== departureStationFilter) return false;
          if (arrivalStationFilter !== ALL && String(getTrialArrivalStationId(trial)) !== arrivalStationFilter) return false;
          const departureDateKey = getTrialDepartureDateKey(trial);
          if (departureDateFilter && departureDateKey !== departureDateFilter) return false;
          if (departureDateFromFilter && (!departureDateKey || departureDateKey < departureDateFromFilter)) return false;
          if (departureDateToFilter && (!departureDateKey || departureDateKey > departureDateToFilter)) return false;
          if (materialTypeFilter !== ALL && normalizeCode(row.materialType) !== normalizeCode(materialTypeFilter)) return false;
          if (serieFilter !== ALL && normalizeCode(row.materialSerie) !== normalizeCode(serieFilter)) return false;
          if (modeFilter !== ALL && normalizeCode(trial.transport_mode) !== modeFilter) return false;
          if (maintenanceFilter !== ALL && normalizeCode(trial.maintenance_state) !== maintenanceFilter) return false;
          if (severityFilter !== ALL && normalizeCode(trial.severity as Severity) !== severityFilter) return false;
          if (speedFilter !== ALL && String(trial.speed_kmh ?? "") !== speedFilter) return false;
          if (resultFilter !== ALL && row.resultCode !== resultFilter) return false;
          if (
            materialConcernedFilter.trim() &&
            !normalize(row.materialConcerned).includes(normalize(materialConcernedFilter.trim()))
          ) {
            return false;
          }
          const normalizedQuery = normalize(query.trim());
          if (!normalizedQuery) return true;
          const searchIndex = [
            trial.id,
            trial.dossier_label,
            trial.dossier_number,
            getOnlineTrialCreatorLabel(trial),
            getTrialDepartureStationName(trial),
            getTrialArrivalStationName(trial),
            row.materialType,
            row.materialSerie,
            row.materialConcerned,
            trial.problem_description,
            trial.transport_conditions_initial,
          ]
            .join(" ")
            .toLowerCase();
          return normalize(searchIndex).includes(normalizedQuery);
        })
        .sort((a, b) => {
          const dossierDiff = getDossierSortNumber(b.trial) - getDossierSortNumber(a.trial);
          if (dossierDiff !== 0) return dossierDiff;

          const diff =
            getApiTimestamp(b.trial.updated_at ?? b.trial.created_at) -
            getApiTimestamp(a.trial.updated_at ?? a.trial.created_at);
          if (diff !== 0) return diff;
          return a.materialIndex - b.materialIndex;
        }),
    [
      trials,
      parcoursFilter,
      departureStationFilter,
      arrivalStationFilter,
      departureDateFilter,
      departureDateFromFilter,
      departureDateToFilter,
      materialTypeFilter,
      serieFilter,
      modeFilter,
      maintenanceFilter,
      severityFilter,
      speedFilter,
      resultFilter,
      materialConcernedFilter,
      query,
    ]
  );

  const totalRequests = filteredRows.length;
  const totalDossiers = useMemo(
    () =>
      new Set(
        filteredRows.map((item) => item.trial.dossier_label ?? String(item.trial.dossier_number ?? item.trial.id))
      ).size,
    [filteredRows]
  );

  const pendingCount = useMemo(
    () => filteredRows.filter((item) => item.trial.status === "EN_COURS_DE_TRAITEMENT").length,
    [filteredRows]
  );
  const accepteeCount = useMemo(
    () =>
      filteredRows.filter(
        (item) => item.trial.status === "TRAITEE_PAR_PM" || item.trial.status === "RECEPTION_PARTIELLE"
      ).length,
    [filteredRows]
  );
  const annulationsCount = useMemo(
    () => filteredRows.filter((item) => item.trial.status === "ANNULEE").length,
    [filteredRows]
  );
  const aModifierCount = useMemo(
    () => filteredRows.filter((item) => item.trial.status === "A_MODIFIER").length,
    [filteredRows]
  );
  const modifieeCount = useMemo(
    () => filteredRows.filter((item) => item.trial.status === "MODIFIEE").length,
    [filteredRows]
  );
  const essaisRealisesCount = useMemo(
    () => filteredRows.filter((item) => item.trial.status === "RECEPTION_COMPLETE").length,
    [filteredRows]
  );

  const activeFiltersCount = useMemo(() => {
    const values = [
      query.trim().length > 0,
      parcoursFilter !== ALL,
      departureStationFilter !== ALL,
      arrivalStationFilter !== ALL,
      departureDateFilter.length > 0,
      departureDateFromFilter.length > 0,
      departureDateToFilter.length > 0,
      materialTypeFilter !== ALL,
      serieFilter !== ALL,
      materialConcernedFilter.trim().length > 0,
      modeFilter !== ALL,
      maintenanceFilter !== ALL,
      severityFilter !== ALL,
      speedFilter !== ALL,
      resultFilter !== ALL,
    ];
    return values.filter(Boolean).length;
  }, [
    query,
    parcoursFilter,
    departureStationFilter,
    arrivalStationFilter,
    departureDateFilter,
    departureDateFromFilter,
    departureDateToFilter,
    materialTypeFilter,
    serieFilter,
    materialConcernedFilter,
    modeFilter,
    maintenanceFilter,
    severityFilter,
    speedFilter,
    resultFilter,
  ]);

  const exportSuffix = useMemo(() => {
    if (activeFiltersCount === 0) {
      return "sans_filtres";
    }
    return `filtres_${activeFiltersCount}`;
  }, [activeFiltersCount]);

  function exportFilteredRowsAsCsv(rows: TrialMaterialRow[]) {
    const header = [
      "Dossier",
      "Date demande",
      "Createur",
      "Parcours",
      "De",
      "Vers",
      "Type materiel",
      "Serie",
      "Materiel concerne",
      "Motif",
      "Autres conditions",
      "Exploitant",
      "Statut",
      "Decision PPM",
      "Motif d'annulation/ modification",
      "Resultat",
      "Observation",
      "Retard moyen",
    ];

    const lines = rows.map((row) => {
      const trial = row.trial;
      const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
      return [
        `#${dossierLabel}`,
        formatDateTime(trial.request_date ?? trial.created_at),
        getOnlineTrialCreatorLabel(trial),
        getParcoursLabel(trial),
        getTrialDepartureStationName(trial),
        getTrialArrivalStationName(trial),
        row.materialType,
        row.materialSerie,
        row.materialConcerned,
        trial.problem_description || "-",
        trial.transport_conditions_initial || "-",
        trial.maintenance_state,
        getOnlineTrialStatusLabel(trial.status),
        trial.permanent_decision?.decision ?? "-",
        row.cancelOrModifyReason,
        row.resultLabel,
        row.observation,
        row.delayMinutes != null ? formatDelayMinutes(row.delayMinutes) : "-",
      ]
        .map((cell) => toCsvCell(cell))
        .join(";");
    });

    const csv = [header.map((cell) => toCsvCell(cell)).join(";"), ...lines].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `demandes_essai_en_ligne_filtrees_${sanitizeFilenameToken(exportSuffix)}_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const statusBars = useMemo(() => {
    const preferredOrder = [
      "EN_COURS_DE_TRAITEMENT",
      "TRAITEE_PAR_PM",
      "A_MODIFIER",
      "MODIFIEE",
      "ANNULEE",
      "RECEPTION_COMPLETE",
    ];
    const counts = new Map<string, number>();
    for (const row of filteredRows) {
      counts.set(row.trial.status, (counts.get(row.trial.status) ?? 0) + 1);
    }
    return preferredOrder
      .filter((status) => counts.has(status))
      .map((status) => ({
        label: getOnlineTrialStatusLabel(status as OnlineTrial["status"]),
        value: counts.get(status) ?? 0,
      }));
  }, [filteredRows]);

  const operatorComparison = useMemo(() => {
    const seed = {
      PV: { key: "PV", total: 0, completed: 0, delayCount: 0, delaySum: 0 },
      PFL: { key: "PFL", total: 0, completed: 0, delayCount: 0, delaySum: 0 },
    };

    for (const row of filteredRows) {
      const normalizedOperator = normalize(row.trial.maintenance_state).toUpperCase();
      const bucketKey = normalizedOperator.includes("PV")
        ? "PV"
        : normalizedOperator.includes("PFL")
          ? "PFL"
          : null;
      if (!bucketKey) continue;
      if (
        row.trial.status === "ANNULEE" ||
        row.trial.status === "A_MODIFIER" ||
        row.trial.status === "MODIFIEE"
      ) {
        continue;
      }

      const bucket = seed[bucketKey];
      bucket.total += 1;
      if (row.trial.status === "RECEPTION_COMPLETE") {
        bucket.completed += 1;
      }
      if (row.delayMinutes != null && row.delayMinutes > 0) {
        bucket.delayCount += 1;
        bucket.delaySum += row.delayMinutes;
      }
    }

    return [seed.PV, seed.PFL].map((item) => ({
      ...item,
      avgDelay: item.delayCount > 0 ? Math.round(item.delaySum / item.delayCount) : null,
      completionRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0,
    }));
  }, [filteredRows]);

  const maxModeValue = Math.max(1, ...operatorComparison.map((item) => Math.max(item.total, item.completed)));

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
    }> = [];

    for (let offset = 0; offset <= 6; offset += 1) {
      const day = new Date(end);
      day.setDate(end.getDate() - offset);
      const key = toLocalDateKey(day);
      const label = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(day);
      days.push({ key, label, total: 0, completed: 0, pending: 0, cancelled: 0 });
    }

    const byDay = new Map(days.map((day) => [day.key, day]));
    for (const row of filteredRows) {
      const parsed = parseApiDate(row.trial.request_date ?? row.trial.created_at);
      if (!parsed) continue;
      const key = toLocalDateKey(parsed);
      const target = byDay.get(key);
      if (!target) continue;

      if (row.trial.status === "MODIFIEE") {
        continue;
      }

      target.total += 1;
      if (row.trial.status === "ANNULEE") {
        target.cancelled += 1;
      } else if (row.trial.status === "RECEPTION_COMPLETE") {
        target.completed += 1;
      } else {
        target.pending += 1;
      }
    }

    return days;
  }, [filteredRows]);

  const maxDailyMaterials = Math.max(1, ...materialsLast7Days.map((day) => day.total));

  function resetFilters() {
    setQuery("");
    setParcoursFilter(ALL);
    setDepartureStationFilter(ALL);
    setArrivalStationFilter(ALL);
    setDepartureDateFilter("");
    setDepartureDateFromFilter("");
    setDepartureDateToFilter("");
    setMaterialTypeFilter(ALL);
    setSerieFilter(ALL);
    setMaterialConcernedFilter("");
    setModeFilter(ALL);
    setMaintenanceFilter(ALL);
    setSeverityFilter(ALL);
    setSpeedFilter(ALL);
    setResultFilter(ALL);
  }

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel border border-slate-200 bg-[radial-gradient(circle_at_20%_0%,rgba(14,116,144,0.14),transparent_48%),radial-gradient(circle_at_82%_0%,rgba(30,64,175,0.12),transparent_42%),linear-gradient(180deg,#ffffff,#f8fafc)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Suivi - Essais en ligne</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard des demandes d'essai en ligne</h2>
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

          <div className="rounded-[1.4rem] border border-sky-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Section d'essai en ligne</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-1">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-700">En cours de traitement</p>
                <p className="mt-2 text-2xl font-semibold text-sky-800">{pendingCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-fuchsia-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Section essai en ligne</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Acceptee</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{accepteeCount}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Annulations</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{annulationsCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">A modifier</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{aModifierCount}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-700">Modifiee</p>
                <p className="mt-2 text-2xl font-semibold text-fuchsia-800">{modifieeCount}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Essais realises</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{essaisRealisesCount}</p>
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
                  onClick={() => exportFilteredRowsAsCsv(filteredRows)}
                  disabled={filteredRows.length === 0}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                    filteredRows.length === 0 ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
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
                Parcours:{" "}
                {parcoursFilter === ALL
                  ? "Tous"
                  : parcoursFilter === "ALLER"
                    ? "Aller"
                    : parcoursFilter === "RETOUR"
                      ? "Retour"
                      : "Aller / Retour"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Date:{" "}
                {departureDateFilter ||
                (departureDateFromFilter || departureDateToFilter
                  ? `${departureDateFromFilter || "..."} -> ${departureDateToFilter || "..."}`
                  : "Toutes")}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                De:{" "}
                {departureStationFilter === ALL
                  ? "Toutes"
                  : (stations.find((item) => String(item.id) === departureStationFilter)?.name ?? "-")}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Vers:{" "}
                {arrivalStationFilter === ALL
                  ? "Toutes"
                  : (stations.find((item) => String(item.id) === arrivalStationFilter)?.name ?? "-")}
              </span>
            </div>
          ) : null}
        </div>

        <div
          className={`grid transition-all duration-500 ease-out ${filtersOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-slate-100 bg-white p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recherche dossier</span>
                  <input
                    className="input"
                    placeholder="Dossier, createur, station, materiel..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parcours</span>
                  <select className="input" value={parcoursFilter} onChange={(e) => setParcoursFilter(e.target.value)}>
                    <option value={ALL}>Tous parcours</option>
                    <option value="ALLER">Aller</option>
                    <option value="RETOUR">Retour</option>
                    <option value="ALLER_RETOUR">Aller / Retour</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">De</span>
                  <select
                    className="input"
                    value={departureStationFilter}
                    onChange={(e) => setDepartureStationFilter(e.target.value)}
                  >
                    {stationOptions.map((option) => (
                      <option key={`departure-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vers</span>
                  <select className="input" value={arrivalStationFilter} onChange={(e) => setArrivalStationFilter(e.target.value)}>
                    {stationOptions.map((option) => (
                      <option key={`arrival-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date de depart prevu</span>
                  <input
                    className="input"
                    type="date"
                    value={departureDateFilter}
                    onChange={(e) => {
                      setDepartureDateFilter(e.target.value);
                      setDepartureDateFromFilter("");
                      setDepartureDateToFilter("");
                    }}
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Periode (du / au)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      type="date"
                      value={departureDateFromFilter}
                      onChange={(e) => {
                        setDepartureDateFromFilter(e.target.value);
                        setDepartureDateFilter("");
                      }}
                    />
                    <input
                      className="input"
                      type="date"
                      value={departureDateToFilter}
                      onChange={(e) => {
                        setDepartureDateToFilter(e.target.value);
                        setDepartureDateFilter("");
                      }}
                    />
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Type de materiel</span>
                  <select className="input" value={materialTypeFilter} onChange={(e) => setMaterialTypeFilter(e.target.value)}>
                    {materialTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Serie</span>
                  <select className="input" value={serieFilter} onChange={(e) => setSerieFilter(e.target.value)}>
                    {serieOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Materiel concerne</span>
                  <input
                    className="input"
                    value={materialConcernedFilter}
                    onChange={(e) => setMaterialConcernedFilter(e.target.value)}
                    placeholder="Materiel concerne"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode d'essai</span>
                  <select className="input" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                    {modeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Exploitant (PV/PFL)</span>
                  <select className="input" value={maintenanceFilter} onChange={(e) => setMaintenanceFilter(e.target.value)}>
                    {maintenanceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Accompagnement</span>
                  <select className="input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                    {severityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vitesse (km/h)</span>
                  <select className="input" value={speedFilter} onChange={(e) => setSpeedFilter(e.target.value)}>
                    {speedOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resultat</span>
                  <select className="input" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
                    {resultOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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
              <p className="text-sm font-semibold text-slate-900">Demandes vs essais realises (par exploitant)</p>
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
              Essais realises
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
                Annulees
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          {totalRequests} demande(s) d'essai en ligne affichee(s)
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[2400px] border-collapse text-sm text-slate-700">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="border border-slate-200 px-3 py-3 text-left">Dossier</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Date demande</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Createur</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Parcours</th>
                <th className="border border-slate-200 px-3 py-3 text-left">De</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Vers</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Type materiel</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Serie</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Materiel concerne</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Motif</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Autres conditions</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Exploitant</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Statut</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Decision PPM</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Motif d'annulation/ modification</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Resultat</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Observation</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Retard moyen</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const trial = row.trial;
                const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
                const rowClass =
                  trial.status === "ANNULEE"
                    ? "bg-rose-50/80 text-rose-900"
                    : trial.status === "A_MODIFIER"
                      ? "bg-orange-50/80 text-orange-900"
                      : trial.status === "MODIFIEE"
                        ? "bg-fuchsia-50/80 text-fuchsia-900"
                        : trial.status === "RECEPTION_COMPLETE"
                          ? "bg-emerald-50/80 text-emerald-900"
                          : "odd:bg-white even:bg-slate-50/70";
                return (
                  <tr key={row.id} className={rowClass}>
                    <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-900">#{dossierLabel}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      <div>{formatDateOnly(trial.request_date ?? trial.created_at)}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(trial.request_date ?? trial.created_at)}</div>
                    </td>
                    <td className="border border-slate-200 px-3 py-3">{getOnlineTrialCreatorLabel(trial)}</td>
                    <td className="border border-slate-200 px-3 py-3">{getParcoursLabel(trial)}</td>
                    <td className="border border-slate-200 px-3 py-3">{getTrialDepartureStationName(trial)}</td>
                    <td className="border border-slate-200 px-3 py-3">{getTrialArrivalStationName(trial)}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.materialType}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.materialSerie}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.materialConcerned}</td>
                    <td className="border border-slate-200 px-3 py-3">{trial.problem_description || "-"}</td>
                    <td className="border border-slate-200 px-3 py-3">{trial.transport_conditions_initial || "-"}</td>
                    <td className="border border-slate-200 px-3 py-3">{trial.maintenance_state}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      <StatusBadge status={trial.status} labelOverride={getOnlineTrialStatusLabel(trial.status)} />
                    </td>
                    <td className="border border-slate-200 px-3 py-3">{trial.permanent_decision?.decision ?? "-"}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.cancelOrModifyReason}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.resultLabel}</td>
                    <td className="border border-slate-200 px-3 py-3">{row.observation}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      {row.delayMinutes != null ? formatDelayMinutes(row.delayMinutes) : "-"}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Aucune demande d'essai ne correspond aux filtres.
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
