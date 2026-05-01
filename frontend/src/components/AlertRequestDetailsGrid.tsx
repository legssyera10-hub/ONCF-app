import type { Alert } from "../types";
import {
  buildAlertMaterialRows,
  parseConfirmedMaterialIndexes,
  parseMaterialConfirmations,
  parsePpmMaterialDecisions,
} from "../utils/alertMaterials";
import { getPermanentDecisionReason } from "../utils/alertHistory";
import { formatDateTime, formatDelayMinutes, parseApiDate } from "../utils/format";
import { getSeverityLabel } from "./StatusBadge";

type AlertField = {
  label: string;
  value: string;
};

function displayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

export function getRequesterLabel(alert: Alert) {
  const fullName = alert.created_by.full_name?.trim() ?? "";
  if (!fullName) {
    return "";
  }

  return fullName.replace(/^Technicentre\s+/i, "").trim() || fullName;
}

export function getRequestedDestinationLabel(alert: Alert) {
  return alert.requested_destination_establishment?.code || alert.requested_destination_establishment?.name || "";
}

export function getRetainedDestinationLabel(alert: Alert) {
  return alert.permanent_decision?.destination_establishment.code || alert.permanent_decision?.destination_establishment.name || "";
}

export function getDestinationLabel(alert: Alert) {
  return getRetainedDestinationLabel(alert) || getRequestedDestinationLabel(alert);
}

export function hasDestinationOverride(alert: Alert) {
  const requested = getRequestedDestinationLabel(alert).trim().toLowerCase();
  const retained = getRetainedDestinationLabel(alert).trim().toLowerCase();
  return Boolean(requested && retained && requested !== retained);
}

export function DossierRouteText({ alert }: { alert: Alert }) {
  const requester = getRequesterLabel(alert);
  const requested = getRequestedDestinationLabel(alert);
  const retained = getRetainedDestinationLabel(alert);
  const destination = retained || requested;

  if (!requester && !destination) {
    return <></>;
  }

  if (!destination) {
    return <>{requester}</>;
  }

  if (hasDestinationOverride(alert)) {
    return (
      <>
        {requester} → <span className="line-through text-slate-500">{requested}</span> {retained}
      </>
    );
  }

  return <>{requester} → {destination}</>;
}

export function buildAlertDetailFields(alert: Alert): AlertField[] {
  const requestedDestination = getRequestedDestinationLabel(alert);
  const decidedDestination = getRetainedDestinationLabel(alert);
  const permanentDecisionReason = getPermanentDecisionReason(alert);

  const displayedSpeed =
    alert.transport_mode === "VOYAGEUR"
      ? "Normal voyageur"
      : alert.speed_kmh != null
        ? String(alert.speed_kmh)
        : "Normal fret";

  const baseFields: AlertField[] = [
    { label: "Date de la demande", value: formatDateTime(alert.request_date ?? alert.created_at) },
    { label: "Date de creation", value: formatDateTime(alert.created_at) },
    { label: "Demandeur", value: getRequesterLabel(alert) },
    { label: "Site de depart", value: alert.station.name },
    { label: "Destinataire demande", value: requestedDestination },
    { label: "Mode d'acheminement", value: displayValue(alert.transport_mode) },
    { label: "Type d'acheminement", value: displayValue(alert.transport_type) },
    { label: "Exploitant (PV/PFL)", value: displayValue(alert.maintenance_state) },
    { label: "Accompagnement", value: getSeverityLabel(alert.severity) },
    { label: "Vitesse (km/h)", value: displayedSpeed },
    { label: "Motif", value: displayValue(alert.problem_description) },
    { label: "Autres conditions", value: displayValue(alert.transport_conditions_initial) },
    { label: "Destinataire retenu", value: decidedDestination },
  ];

  if (alert.status === "A_MODIFIER" || alert.status === "MODIFIEE" || alert.status === "ANNULEE") {
    baseFields.push({
      label: "Motif de changement (PPM)",
      value: permanentDecisionReason ?? "",
    });
  }

  return baseFields;
}

function getFieldTone(label: string) {
  if (label === "Destinataire retenu") {
    return "border-violet-300 bg-violet-100/90 shadow-[0_10px_30px_-24px_rgba(139,92,246,0.55)]";
  }

  if (label === "Confirmation de reception" || label === "Date de confirmation reception") {
    return "border-sky-300 bg-sky-100/90 shadow-[0_10px_30px_-24px_rgba(14,165,233,0.5)]";
  }

  if (label === "Retard" || label === "Retard actuel") {
    return "border-rose-300 bg-rose-100/90 shadow-[0_10px_30px_-24px_rgba(244,63,94,0.5)]";
  }

  if (label === "Motif de changement (PPM)") {
    return "border-amber-300 bg-amber-100/90 shadow-[0_10px_30px_-24px_rgba(245,158,11,0.5)]";
  }

  return "border-slate-200 bg-slate-50/90";
}

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

function MaterialConcernedTable({ alert }: { alert: Alert }) {
  const rows = buildAlertMaterialRows(alert);
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]">
      <p className="text-xs uppercase tracking-wide text-slate-500">Matériels déclarés</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm text-slate-700">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Type matériel</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Série</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Matériel concerné</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Etat de la demande (PPM)</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Motif PPM (modification / annulation)</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Confirmation de réception</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Date de réception</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Observation</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Retard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowConfirmation = materialConfirmations[row.index];
              const isConfirmed = Boolean(rowConfirmation?.confirmed) || confirmedIndexes.includes(row.index);
              const rawPpmStatus = pmMaterialDecisions[row.index]?.ppm_status ?? globalPpmStatus;
              const ppmStatus =
                rawPpmStatus === "ACCEPTEE"
                  ? "acceptée"
                  : rawPpmStatus === "A_MODIFIER"
                    ? "à modifier"
                    : rawPpmStatus === "ANNULEE"
                      ? "annulée"
                      : rawPpmStatus === "MODIFIEE"
                        ? "modifiée"
                        : "";
              const ppmStatusClassName =
                ppmStatus === "annulée"
                  ? "font-semibold text-rose-700"
                  : ppmStatus === "à modifier"
                    ? "font-semibold text-amber-700"
                    : ppmStatus === "modifiée"
                      ? "font-semibold text-fuchsia-700"
                      : "";
              const ppmReason =
                pmMaterialDecisions[row.index]?.ppm_reason ??
                (rawPpmStatus === "A_MODIFIER" || rawPpmStatus === "ANNULEE" || rawPpmStatus === "MODIFIEE" ? globalPpmReason : "");
              const receptionStatus =
                rowConfirmation?.reception_status === "VALIDEE"
                  ? "validée"
                  : rowConfirmation?.reception_status === "EN_INSTANCE"
                      ? "en instance"
                      : isConfirmed
                        ? "validée"
                        : ppmStatus === "annulée"
                          ? ""
                          : "";
              const hasFinalReceptionValidation = rowConfirmation?.reception_status === "VALIDEE" || isConfirmed;
              const rowReceptionDate = hasFinalReceptionValidation ? rowConfirmation?.reception_date : null;
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
              const hasPmAccepted = rawPpmStatus === "ACCEPTEE";
              const rowPmReferenceDate = parseApiDate(pmMaterialDecisions[row.index]?.updated_at) ?? pmFallbackReferenceDate;
              const rowConfirmedAt = hasFinalReceptionValidation
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
                  : hasFinalReceptionValidation && rowConfirmedAt && rowPmReferenceDate
                    ? Math.floor((rowConfirmedAt.getTime() - rowPmReferenceDate.getTime()) / 60000)
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
              const rowClassName =
                rowConfirmation?.reception_status === "VALIDEE"
                  ? "bg-emerald-100/90"
                  : rowConfirmation?.reception_status === "EN_INSTANCE"
                      ? "bg-amber-100/90"
                      : isConfirmed
                        ? "bg-emerald-100/90"
                        : "";
              const accentCellClassName =
                rowConfirmation?.reception_status === "VALIDEE"
                  ? "border-l-4 border-l-emerald-500"
                  : rowConfirmation?.reception_status === "EN_INSTANCE"
                      ? "border-l-4 border-l-amber-500"
                      : "";
              const statusClassName =
                rowConfirmation?.reception_status === "VALIDEE"
                  ? "font-semibold text-emerald-900"
                  : rowConfirmation?.reception_status === "EN_INSTANCE"
                      ? "font-semibold text-amber-900"
                      : "";

              return (
              <tr key={row.id} className={rowClassName}>
                <td className={`border border-slate-300 px-3 py-2 ${accentCellClassName}`}>{row.type || "-"}</td>
                <td className="border border-slate-300 px-3 py-2">{row.serie || "-"}</td>
                <td className="border border-slate-300 px-3 py-2">{row.concerned || "-"}</td>
                <td className={`border border-slate-300 px-3 py-2 ${ppmStatusClassName}`}>{ppmStatus}</td>
                <td className="border border-slate-300 px-3 py-2">{ppmReason}</td>
                <td className={`border border-slate-300 px-3 py-2 ${statusClassName}`}>{receptionStatus}</td>
                <td className="border border-slate-300 px-3 py-2">{rowReceptionDate ? formatDateTime(rowReceptionDate) : ""}</td>
                <td className="border border-slate-300 px-3 py-2">{rowRemarks}</td>
                <td className="border border-slate-300 px-3 py-2">{rowDelayLabel}</td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AlertRequestDetailsGrid({
  alert,
  title = "Details de la demande",
}: {
  alert: Alert;
  title?: string;
}) {
  const fields = buildAlertDetailFields(alert);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <MaterialConcernedTable alert={alert} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label} className={`rounded-2xl border p-4 ${getFieldTone(field.label)}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{field.label}</p>
            <p className="mt-2 min-h-[1.5rem] text-sm leading-7 text-slate-700">{field.value || ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}





