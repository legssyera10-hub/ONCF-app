import { Link } from "react-router-dom";
import { preloadRoute } from "../routes/lazyRoutes";
import type { Alert } from "../types";
import { DossierRouteText } from "./AlertRequestDetailsGrid";
import { getPermanentDecisionReason } from "../utils/alertHistory";
import { parseConfirmedMaterialIndexes, parseMaterialConfirmations, parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { formatDateOnly, formatDateTime, formatDelayMinutes, formatTimeOnly, parseApiDate } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

type TransportDossierRowProps = {
  actionLabel?: string;
  alert: Alert;
  requesterLabel?: string;
  eventCount?: number;
  latestNote?: string | null;
  onSelect?: (id: number) => void;
  selected?: boolean;
  state?: unknown;
  to?: string;
};

type RowCell = {
  label: string;
  value: string;
};

type MaterialRow = {
  id: string;
  type: string;
  serie: string;
  concerned: string;
};

function toDisplayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function normalizeModeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isMixedNormalMode(value: string) {
  const mode = normalizeModeToken(value);
  return (
    mode.includes("NORMAL") &&
    mode.includes("FRET") &&
    (mode.includes("VOYAGEUR") || mode.includes("VOY") || mode.includes("FRET OU V"))
  );
}

function speedLabel(mode?: string | null, speed?: number | null) {
  if (speed != null) {
    return `${speed} km/h`;
  }

  const modeValue = mode ?? "";
  const normalizedMode = normalizeModeToken(modeValue);
  if (isMixedNormalMode(modeValue)) {
    return "Normal";
  }
  if (normalizedMode.includes("VOYAGEUR") || normalizedMode.includes("VOY")) {
    return "Normal voyageur";
  }
  return "Normal fret";
}

function splitJoinedValues(value?: string | null) {
  return (value ?? "")
    .split(" + ")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function deriveRequesterLabel(alert: Alert, requesterLabel?: string) {
  if (requesterLabel?.trim()) {
    return requesterLabel.trim();
  }

  const fullName = alert.created_by.full_name?.trim() ?? "";
  if (fullName) {
    const normalized = fullName.replace(/^Technicentre\s+/i, "").trim();
    return normalized || fullName;
  }

  return alert.station.name;
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

function buildMaterialRows(alert: Alert): MaterialRow[] {
  const types = splitJoinedValues(alert.material_type).map((item) => getMaterialTypeLabel(item));
  const series = splitJoinedValues(alert.material_ref);
  const concerned = splitJoinedValues(alert.material_concerned);
  const count = Math.max(types.length, series.length, concerned.length, 1);

  return Array.from({ length: count }, (_, index) => ({
    id: `${alert.id}-${index}`,
    type: types[index] || types[0] || "-",
    serie: series[index] || series[0] || "-",
    concerned: concerned[index] || "-",
  }));
}

function getPermanentDecisionLabel(alert: Alert) {
  if (alert.status === "A_MODIFIER") {
    return "Modification demandée";
  }
  if (alert.status === "MODIFIEE") {
    return "Modifiée";
  }

  if (alert.permanent_decision?.decision === "CONFIRMER") {
    return "Confirmée";
  }

  if (alert.permanent_decision?.decision === "ANNULER" || alert.status === "ANNULEE") {
    return "Annulée";
  }

  return "";
}

function buildCells(alert: Alert, latestNote?: string | null, requesterLabel?: string): RowCell[] {
  const requester = deriveRequesterLabel(alert, requesterLabel);
  const ppmNote = getPermanentDecisionReason(alert) ?? "";

  const destination =
    alert.requested_destination_establishment?.code ||
    alert.permanent_decision?.destination_establishment.code ||
    alert.requested_destination_establishment?.name ||
    alert.permanent_decision?.destination_establishment.name ||
    "-";

  return [
    { label: "Date de la demande", value: formatDateOnly(alert.request_date ?? alert.created_at) },
    { label: "Horaire", value: formatTimeOnly(alert.created_at) },
    { label: "Demandeur", value: toDisplayValue(requester) },
    { label: "Mode", value: toDisplayValue(alert.transport_mode) },
    { label: "Type", value: toDisplayValue(alert.transport_type) },
    { label: "Exploitant", value: toDisplayValue(alert.maintenance_state) },
    { label: "Motif", value: toDisplayValue(alert.problem_description) },
    {
      label: "Vitesse",
      value: speedLabel(alert.transport_mode, alert.speed_kmh),
    },
    { label: "Autres", value: toDisplayValue(alert.transport_conditions_initial) },
    { label: "Destinataire", value: destination },
    { label: "Decision", value: getPermanentDecisionLabel(alert) },
    { label: "Motif PPM", value: ppmNote },
  ];
}

function MaterialTable({ alert }: { alert: Alert }) {
  const rows = buildMaterialRows(alert);
  const materialConfirmations = parseMaterialConfirmations(alert.establishment_confirmation?.material_confirmations);
  const confirmedIndexes = parseConfirmedMaterialIndexes(alert.establishment_confirmation?.confirmed_material_indexes);
  const pmMaterialDecisions = parsePpmMaterialDecisions(alert.permanent_decision?.material_decisions);
  const pmFallbackReferenceDate = parseApiDate(alert.permanent_decision?.created_at);
  const nowTimestamp = Date.now();
  const globalPpmReason = getPermanentDecisionReason(alert) ?? "";
  const globalPpmStatus =
    alert.status === "A_MODIFIER"
      ? "A_MODIFIER"
      : alert.status === "MODIFIEE"
        ? "MODIFIEE"
        : alert.status === "ANNULEE"
          ? "ANNULEE"
          : null;

  function formatInstanceDuration(minutes: number) {
    if (minutes <= 0) {
      return "0min";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours <= 0) {
      return `${remainingMinutes}min`;
    }
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}min`;
  }

  function formatInstancePeriodLabel(
    totalMinutes: number,
    endedAtIso?: string | null,
    startedAtIso?: string | null
  ) {
    const endedAt = endedAtIso ? parseApiDate(endedAtIso) : null;
    const startedAt = startedAtIso ? parseApiDate(startedAtIso) : null;
    if (!endedAt || totalMinutes < 0) {
      return "";
    }

    const effectiveStartedAt = startedAt ?? new Date(endedAt.getTime() - totalMinutes * 60_000);
    return `etait en instance durant la periode du ${formatDateTime(effectiveStartedAt.toISOString())} au ${formatDateTime(
      endedAt.toISOString()
    )} (${formatInstanceDuration(totalMinutes)})`;
  }

  function formatInstanceStartedLabel(startedAtIso?: string | null) {
    const startedAt = startedAtIso ? parseApiDate(startedAtIso) : null;
    if (!startedAt) {
      return "";
    }
    return `mis en instance le ${formatDateTime(startedAt.toISOString())}`;
  }

  return (
    <div className="mx-3 mt-1 overflow-x-auto rounded-[0.75rem] border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-left text-[0.82rem] text-slate-700">
        <thead>
          <tr className="bg-slate-50">
            <th className="border border-slate-200 px-2 py-1 font-semibold">Type materiel</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Serie</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Materiel concerne</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Etat demande (PPM)</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Motif PPM (modification / annulation)</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Confirmation reception</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Observation</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Retard</th>
            <th className="border border-slate-200 px-2 py-1 font-semibold">Date confirmation reception</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowConfirmation = materialConfirmations[rowIndex];
            const isConfirmed = Boolean(rowConfirmation?.confirmed) || confirmedIndexes.includes(rowIndex);
            const rawPmStatus = pmMaterialDecisions[rowIndex]?.ppm_status ?? globalPpmStatus;
            const pmStatus =
              rawPmStatus === "ACCEPTEE"
                ? "acceptee"
                : rawPmStatus === "A_MODIFIER"
                  ? "a modifier"
                  : rawPmStatus === "ANNULEE"
                    ? "annulee"
                    : rawPmStatus === "MODIFIEE"
                      ? "modifiee"
                      : "";
            const pmStatusClassName =
              pmStatus === "annulee"
                ? "font-semibold text-rose-700"
                : pmStatus === "a modifier"
                  ? "font-semibold text-amber-700"
                  : pmStatus === "modifiee"
                    ? "font-semibold text-fuchsia-700"
                    : "";
            const pmReason =
              pmMaterialDecisions[rowIndex]?.ppm_reason ??
              (rawPmStatus === "A_MODIFIER" || rawPmStatus === "ANNULEE" || rawPmStatus === "MODIFIEE" ? globalPpmReason : "");
            const receptionStatus =
              rowConfirmation?.reception_status === "VALIDEE"
                ? "validee"
                : rowConfirmation?.reception_status === "EN_INSTANCE"
                    ? "en instance"
                    : isConfirmed
                      ? "validee"
                      : "";
            const baseRemarks = rowConfirmation?.remarks ?? (isConfirmed ? alert.establishment_confirmation?.remarks ?? "" : "");
            const instanceDurationMinutes = rowConfirmation?.en_instance_total_minutes;
            const hasActiveInstance =
              rowConfirmation?.reception_status === "EN_INSTANCE" && rowConfirmation?.instance_used_once === true;
            const hadInstanceDuration =
              typeof instanceDurationMinutes === "number" &&
              instanceDurationMinutes >= 0 &&
              rowConfirmation?.instance_used_once === true &&
              rowConfirmation?.reception_status !== "EN_INSTANCE";
            const instanceSuffix = hasActiveInstance
              ? formatInstanceStartedLabel(
                  rowConfirmation?.last_instance_started_at ??
                    rowConfirmation?.en_instance_started_at ??
                    rowConfirmation?.confirmed_at
                )
              : hadInstanceDuration
                ? formatInstancePeriodLabel(
                    instanceDurationMinutes,
                    rowConfirmation?.instance_ended_at ?? rowConfirmation?.reception_date ?? rowConfirmation?.confirmed_at,
                    rowConfirmation?.last_instance_started_at
                  )
                : "";
            const rowRemarks = [baseRemarks, instanceSuffix]
              .filter((value) => value && value.trim().length > 0)
              .join(" ");
            const hasFinalReceptionValidation = rowConfirmation?.reception_status === "VALIDEE" || isConfirmed;
            const hasPmAccepted = rawPmStatus === "ACCEPTEE";
            const rowPmReferenceDate = parseApiDate(pmMaterialDecisions[rowIndex]?.updated_at) ?? pmFallbackReferenceDate;
            const rowConfirmedAtDate = hasFinalReceptionValidation
              ? parseApiDate(
                  rowConfirmation?.reception_date ??
                    rowConfirmation?.confirmed_at ??
                    (isConfirmed ? alert.establishment_confirmation?.confirmed_at ?? null : null)
                )
              : null;
            const rowDelay =
              hasFinalReceptionValidation &&
              rowConfirmation?.delay_minutes !== null &&
              rowConfirmation?.delay_minutes !== undefined
                ? rowConfirmation.delay_minutes
                : hasFinalReceptionValidation && rowConfirmedAtDate && rowPmReferenceDate
                  ? Math.floor((rowConfirmedAtDate.getTime() - rowPmReferenceDate.getTime()) / 60000)
                  : null;
            const ongoingDelayMinutes =
              hasPmAccepted && !hasFinalReceptionValidation && rowPmReferenceDate
                ? Math.floor((nowTimestamp - rowPmReferenceDate.getTime()) / 60000)
                : null;
            const rowDelayLabel =
              rowDelay !== null && rowDelay !== undefined
                ? formatDelayMinutes(rowDelay)
                : ongoingDelayMinutes !== null
                  ? `${formatDelayMinutes(ongoingDelayMinutes)} (en cours)`
                  : "";
            const rowConfirmedAt = hasFinalReceptionValidation
              ? rowConfirmation?.reception_date ?? rowConfirmation?.confirmed_at ?? (isConfirmed ? alert.establishment_confirmation?.confirmed_at : null)
              : null;

            return (
            <tr key={row.id} className={isConfirmed ? "bg-emerald-50" : ""}>
              <td className="border border-slate-200 px-2 py-1">{row.type}</td>
              <td className="border border-slate-200 px-2 py-1">{row.serie}</td>
              <td className="border border-slate-200 px-2 py-1">{row.concerned}</td>
              <td className={`border border-slate-200 px-2 py-1 ${pmStatusClassName}`}>{pmStatus}</td>
              <td className="border border-slate-200 px-2 py-1">{pmReason}</td>
              <td className="border border-slate-200 px-2 py-1">{receptionStatus}</td>
              <td className="border border-slate-200 px-2 py-1">{rowRemarks}</td>
              <td className="border border-slate-200 px-2 py-1">{rowDelayLabel}</td>
              <td className="border border-slate-200 px-2 py-1">{rowConfirmedAt ? formatDateTime(rowConfirmedAt) : ""}</td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
}

function RowBody({
  actionLabel,
  alert,
  requesterLabel,
  latestNote,
  selected,
}: Omit<TransportDossierRowProps, "onSelect" | "state" | "to" | "eventCount">) {
  const cells = buildCells(alert, latestNote, requesterLabel).filter((cell) => cell.value && cell.value !== "-");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 px-3 py-1.5">
        <div className="text-center sm:text-left">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Dossier d'acheminement</p>
          <h3 className="mt-0.5 text-[0.9rem] font-semibold tracking-tight text-slate-950">
            Dossier #{alert.dossier_label ?? String(alert.id)} · <DossierRouteText alert={alert} />
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StatusBadge
            status={alert.status}
            materialConfirmations={alert.establishment_confirmation?.material_confirmations}
          />
          {actionLabel ? <span className="text-sm font-semibold text-brand-700">{actionLabel}</span> : null}
          {selected ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Selectionnee</span> : null}
        </div>
      </div>

      <MaterialTable alert={alert} />

      <div className="mx-auto grid w-full max-w-[1480px] grid-cols-2 gap-[1px] px-3 py-1.5 md:grid-cols-4 xl:grid-cols-6">
        {cells.map((cell) => (
          <div key={`${cell.label}-${cell.value}`} className="rounded-[0.45rem] border border-slate-200 bg-slate-50/80 px-2 py-0.5 text-center xl:text-left">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{cell.label}</p>
            <p className="mt-0.5 text-[0.88rem] font-semibold leading-4 text-slate-800">{cell.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function TransportDossierRow(props: TransportDossierRowProps) {
  const shellClass = `group panel block w-full overflow-hidden rounded-[1.25rem] border border-slate-200 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.24)] ${
    props.selected ? "ring-2 ring-brand-500 shadow-[0_28px_70px_-34px_rgba(249,115,22,0.28)]" : ""
  }`;

  if (props.to) {
    return (
      <Link
        to={props.to}
        state={props.state}
        onMouseEnter={() => preloadRoute(props.to as string)}
        onFocus={() => preloadRoute(props.to as string)}
        className={shellClass}
      >
        <RowBody {...props} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => props.onSelect?.(props.alert.id)} className={shellClass}>
      <RowBody {...props} />
    </button>
  );
}



