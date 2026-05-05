import { Link } from "react-router-dom";
import type { OnlineTrial } from "../types";
import { getOnlineTrialDirectionTitleSuffix } from "../utils/onlineTrialDirection";
import { formatDateTime } from "../utils/format";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";
import { StatusBadge } from "./StatusBadge";

type OnlineTrialDossierCardProps = {
  trial: OnlineTrial;
  to: string;
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

export function OnlineTrialDossierCard({ trial, to, onMouseEnter, onFocus }: OnlineTrialDossierCardProps) {
  const routeFrom = trial.departure_station?.name ?? trial.station.name ?? "-";
  const routeTo = trial.arrival_station?.name ?? "-";
  const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
  const directionSuffix = getOnlineTrialDirectionTitleSuffix(trial);

  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className="panel flex flex-wrap items-center justify-between gap-4 p-5 transition hover:-translate-y-0.5 hover:border-slate-300"
    >
      <div className="min-w-0">
        <p className="text-lg font-semibold text-slate-900">
          Dossier essai #{dossierLabel} {routeFrom} {"->"} {routeTo} {directionSuffix}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {trial.created_by.full_name} - {trial.material_ref} - Cree le {formatDateTime(trial.created_at)}
        </p>
      </div>
      <StatusBadge status={trial.status} labelOverride={getOnlineTrialStatusLabel(trial.status)} />
    </Link>
  );
}
