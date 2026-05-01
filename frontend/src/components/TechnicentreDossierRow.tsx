import { Link } from "react-router-dom";
import { preloadRoute } from "../routes/lazyRoutes";
import type { Alert, AlertStatus } from "../types";
import { formatDateOnly, formatTimeOnly } from "../utils/format";
import { StatusBadge } from "./StatusBadge";
import { TransportDossierRow } from "./TransportDossierRow";

type SharedProps = {
  actionLabel: string;
  eventCount: number;
  latestNote?: string | null;
  requesterLabel?: string;
  state?: { returnTo: string };
  to: string;
};

type AlertProps = SharedProps & {
  alert: Alert;
};

type LegacyProps = SharedProps & {
  date: string;
  motif: string;
  status: AlertStatus;
  subtitle: string;
  title: string;
};

type TechnicentreDossierRowProps = AlertProps | LegacyProps;

function isAlertProps(props: TechnicentreDossierRowProps): props is AlertProps {
  return "alert" in props;
}

function splitSubtitle(value: string) {
  const parts = value.split("→");
  if (parts.length === 2) {
    return { from: parts[0].trim(), to: parts[1].trim() };
  }
  return { from: value.trim(), to: "-" };
}

export function TechnicentreDossierRow(props: TechnicentreDossierRowProps) {
  if (isAlertProps(props)) {
    return (
      <TransportDossierRow
        actionLabel={props.actionLabel}
        alert={props.alert}
        requesterLabel={props.requesterLabel}
        eventCount={props.eventCount}
        latestNote={props.latestNote}
        state={props.state}
        to={props.to}
      />
    );
  }

  const subtitle = splitSubtitle(props.subtitle);
  const cells = [
    { label: "Date de la demande", value: formatDateOnly(props.date) },
    { label: "Horaire", value: formatTimeOnly(props.date) },
    { label: "Demandeur", value: subtitle.from },
    { label: "Mode", value: "-" },
    { label: "Type", value: "-" },
    { label: "Exploitant", value: "-" },
    { label: "Motif", value: props.motif || "-" },
    { label: "Accompagnement", value: "-" },
    { label: "Vitesse", value: "-" },
    { label: "Autres", value: "-" },
    { label: "Destinataire", value: subtitle.to },
    {
      label: "Motif PPM",
      value:
        props.status === "A_MODIFIER" || props.status === "MODIFIEE" || props.status === "ANNULEE"
          ? props.latestNote?.trim() || ""
          : "",
    },
  ].filter((cell) => cell.value && cell.value !== "-");

  return (
    <Link
      to={props.to}
      state={props.state}
      onMouseEnter={() => preloadRoute(props.to)}
      onFocus={() => preloadRoute(props.to)}
      className="group panel block w-full overflow-hidden rounded-[1.8rem] border border-slate-200 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.24)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 px-4 py-2.5">
        <div className="text-center sm:text-left">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Dossier d'acheminement</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
            {subtitle.to && subtitle.to !== "-" ? `${subtitle.from} → ${subtitle.to}` : subtitle.from}
          </h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <StatusBadge status={props.status} />
          <span className="text-sm font-semibold text-brand-700">{props.actionLabel}</span>
        </div>
      </div>

      <div className="mx-3 mt-3 overflow-x-auto rounded-[1rem] border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm text-slate-700">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-3 py-2 font-semibold">Type matériel</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">Série</th>
              <th className="border border-slate-200 px-3 py-2 font-semibold">Matériel concerné</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 px-3 py-2">{props.title || "-"}</td>
              <td className="border border-slate-200 px-3 py-2">{props.title.replace("Dossier #", "#") || "-"}</td>
              <td className="border border-slate-200 px-3 py-2">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mx-auto grid w-full max-w-[1480px] grid-cols-2 gap-2.5 px-3 py-3 md:grid-cols-3 xl:grid-cols-5">
        {cells.map((cell) => (
          <div key={`legacy-value-${cell.label}`} className="rounded-[1.15rem] border border-slate-200 bg-slate-50/80 px-3 py-2 text-center xl:text-left">
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{cell.label}</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{cell.value}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
