import type { AlertStatus, Severity } from "../types";
import { hasInstanceReceptionMaterial } from "../utils/alertMaterials";
import { getBusinessStatusLabel } from "../utils/status";

const statusMap: Record<AlertStatus, string> = {
  EN_COURS_DE_TRAITEMENT: "border border-slate-300 bg-slate-100 text-slate-700",
  A_MODIFIER: "border border-orange-300 bg-orange-100 text-orange-800",
  MODIFIEE: "border border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800",
  TRAITEE_PAR_PM: "border border-blue-200 bg-blue-100 text-blue-800",
  ANNULEE: "border border-rose-200 bg-rose-100 text-rose-800",
  RECEPTION_PARTIELLE: "border border-teal-200 bg-teal-100 text-teal-800",
  RECEPTION_COMPLETE: "border border-emerald-200 bg-emerald-100 text-emerald-800",
};

const severityMap: Record<Severity, string> = {
  NIVEAU_1: "border border-emerald-200 bg-emerald-100 text-emerald-800",
  NIVEAU_2: "border border-lime-200 bg-lime-100 text-lime-800",
  NIVEAU_3: "border border-amber-200 bg-amber-100 text-amber-800",
  NIVEAU_4: "border border-orange-200 bg-orange-100 text-orange-800",
  NIVEAU_5: "border border-rose-200 bg-rose-100 text-rose-800",
};

const severityLabelMap: Record<Severity, string> = {
  NIVEAU_1: "Sans",
  NIVEAU_2: "Avec",
  NIVEAU_3: "Avec",
  NIVEAU_4: "Avec",
  NIVEAU_5: "Avec",
};

const statusToneLabelMap: Partial<Record<AlertStatus, string>> = {
  EN_COURS_DE_TRAITEMENT: "En attente",
  TRAITEE_PAR_PM: "Traitée PPM",
  A_MODIFIER: "Action requise",
  MODIFIEE: "Version clôturée",
  ANNULEE: "Bloquée",
  RECEPTION_PARTIELLE: "Partielle",
  RECEPTION_COMPLETE: "Traitée",
};

export function getStatusLabel(status: AlertStatus) {
  return getBusinessStatusLabel(status);
}

export function getSeverityLabel(severity: Severity) {
  return severityLabelMap[severity];
}

export function StatusBadge({
  status,
  subStatus,
  materialConfirmations,
  labelOverride,
}: {
  status: AlertStatus;
  subStatus?: string | null;
  materialConfirmations?: string | null;
  labelOverride?: string;
}) {
  const resolvedSubStatus =
    subStatus ??
    (hasInstanceReceptionMaterial(materialConfirmations) ? "(en instance)" : null);

  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMap[status]}`}>
        {labelOverride ?? getStatusLabel(status)}
      </span>
      {resolvedSubStatus ? <span className="mt-1 text-[10px] font-semibold text-slate-500">{resolvedSubStatus}</span> : null}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${severityMap[severity]}`}>
      {getSeverityLabel(severity)}
    </span>
  );
}

export function StatusHint({ status }: { status: AlertStatus }) {
  const label = statusToneLabelMap[status];
  if (!label) {
    return null;
  }

  return <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>;
}

