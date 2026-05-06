import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { OnlineTrialDossierCard } from "../components/OnlineTrialDossierCard";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { preloadRoute } from "../routes/lazyRoutes";
import type { OnlineTrial } from "../types";

type TrialSectionKey =
  | "SCHEDULED"
  | "PENDING_PPM"
  | "TO_UPDATE"
  | "MODIFIED"
  | "COMPLETED"
  | "CANCELLED";

type TrialSectionConfig = {
  key: TrialSectionKey;
  label: string;
  statuses: OnlineTrial["status"][];
  emptyMessage: string;
  cardClassName: string;
  labelClassName: string;
  valueClassName: string;
};

const TRIAL_SECTION_CONFIGS: TrialSectionConfig[] = [
  {
    key: "SCHEDULED",
    label: "Realisations programmees",
    statuses: ["TRAITEE_PAR_PM"],
    emptyMessage: "Aucune realisation programmee pour le moment.",
    cardClassName: "border-amber-200 bg-amber-50",
    labelClassName: "text-amber-700",
    valueClassName: "text-amber-900",
  },
  {
    key: "PENDING_PPM",
    label: "En attente PPM",
    statuses: ["EN_COURS_DE_TRAITEMENT"],
    emptyMessage: "Aucune demande en attente PPM.",
    cardClassName: "border-sky-200 bg-sky-50",
    labelClassName: "text-sky-700",
    valueClassName: "text-sky-900",
  },
  {
    key: "TO_UPDATE",
    label: "A modifier",
    statuses: ["A_MODIFIER"],
    emptyMessage: "Aucune demande a modifier.",
    cardClassName: "border-amber-200 bg-amber-50",
    labelClassName: "text-amber-700",
    valueClassName: "text-amber-900",
  },
  {
    key: "MODIFIED",
    label: "Modifiee",
    statuses: ["MODIFIEE"],
    emptyMessage: "Aucune demande modifiee.",
    cardClassName: "border-violet-200 bg-violet-50",
    labelClassName: "text-violet-700",
    valueClassName: "text-violet-900",
  },
  {
    key: "COMPLETED",
    label: "Essais realises",
    statuses: ["RECEPTION_COMPLETE"],
    emptyMessage: "Aucun essai realise pour le moment.",
    cardClassName: "border-emerald-200 bg-emerald-50",
    labelClassName: "text-emerald-700",
    valueClassName: "text-emerald-900",
  },
  {
    key: "CANCELLED",
    label: "Annulee",
    statuses: ["ANNULEE"],
    emptyMessage: "Aucune demande annulee.",
    cardClassName: "border-rose-200 bg-rose-50",
    labelClassName: "text-rose-700",
    valueClassName: "text-rose-900",
  },
];

function getScope(locationPathname: string) {
  if (locationPathname.startsWith("/projet/")) {
    return {
      base: "/projet/essais",
      label: "Projet",
    };
  }
  return {
    base: "/essais",
    label: "Technicentre",
  };
}

export function OnlineTrialDashboardPage() {
  const { token } = useAuth();
  const location = useLocation();
  const scope = getScope(location.pathname);
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [activeSection, setActiveSection] = useState<TrialSectionKey>("SCHEDULED");
  const [error, setError] = useState("");

  async function load() {
    if (!token) {
      return;
    }
    try {
      setError("");
      const result = await api.onlineTrials(token, "?mine=true");
      setTrials(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des demandes d'essai");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const sectionCounts = useMemo(() => {
    const counts: Record<TrialSectionKey, number> = {
      SCHEDULED: 0,
      PENDING_PPM: 0,
      TO_UPDATE: 0,
      MODIFIED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const trial of trials) {
      if (trial.status === "TRAITEE_PAR_PM") counts.SCHEDULED += 1;
      if (trial.status === "EN_COURS_DE_TRAITEMENT") counts.PENDING_PPM += 1;
      if (trial.status === "A_MODIFIER") counts.TO_UPDATE += 1;
      if (trial.status === "MODIFIEE") counts.MODIFIED += 1;
      if (trial.status === "RECEPTION_COMPLETE") counts.COMPLETED += 1;
      if (trial.status === "ANNULEE") counts.CANCELLED += 1;
    }

    return counts;
  }, [trials]);

  const activeConfig = TRIAL_SECTION_CONFIGS.find((item) => item.key === activeSection) ?? TRIAL_SECTION_CONFIGS[0];

  const filteredTrials = useMemo(
    () =>
      trials
        .filter((item) => activeConfig.statuses.includes(item.status))
        .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()),
    [trials, activeConfig]
  );

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{scope.label} - Essais en ligne</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pilotage des demandes d'essai</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Espace dedie a la creation, au suivi et a la mise a jour des demandes d'essai en ligne.
        </p>

        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-6">
          {TRIAL_SECTION_CONFIGS.map((section) => {
            const count = sectionCounts[section.key];
            const isActive = section.key === activeSection;
            const isScheduledActiveAlert = section.key === "SCHEDULED" && count > 0;
            const isToUpdateActiveAlert = section.key === "TO_UPDATE" && count > 0;
            const isPriorityAlert = isScheduledActiveAlert || isToUpdateActiveAlert;
            const scheduledNeutralClass =
              section.key === "SCHEDULED" && count === 0 ? "border-amber-200 bg-amber-50" : "";
            const scheduledBlinkClass = isScheduledActiveAlert ? "border-rose-300 bg-rose-50/80" : "";
            const toUpdateBlinkClass = isToUpdateActiveAlert ? "border-amber-300 bg-amber-50/90" : "";
            const alertMotionClass = isPriorityAlert ? "animate-pulse shadow-[0_16px_34px_-26px_rgba(15,23,42,0.55)]" : "";
            const alertSizeClass = isPriorityAlert ? "origin-top scale-[1.08] p-6 md:p-7 min-h-[10.75rem]" : "min-h-[9.25rem]";
            const activeRingClass = isActive ? "ring-2 ring-slate-300 ring-offset-1" : "";
            const labelClassName =
              section.key === "SCHEDULED" && count > 0 ? "text-rose-700" : section.labelClassName;
            const valueClassName =
              section.key === "SCHEDULED" && count > 0 ? "text-rose-900" : section.valueClassName;
            const sectionClassName =
              section.key === "SCHEDULED"
                ? `${scheduledNeutralClass} ${scheduledBlinkClass}`.trim()
                : section.key === "TO_UPDATE"
                  ? `${section.cardClassName} ${toUpdateBlinkClass}`.trim()
                  : section.cardClassName;

            return (
              <button
                key={section.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveSection(section.key)}
                className={`rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm ${sectionClassName} ${alertMotionClass} ${alertSizeClass} ${activeRingClass}`}
              >
                <p className={`text-xs uppercase tracking-[0.18em] ${labelClassName}`}>{section.label}</p>
                <p className={`mt-2 text-3xl font-semibold ${valueClassName}`}>{count}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`${scope.base}/history`}
            onMouseEnter={() => preloadRoute(`${scope.base}/history`)}
            onFocus={() => preloadRoute(`${scope.base}/history`)}
            className="btn-secondary"
          >
            Historique
          </Link>
          <Link
            to={`${scope.base}/new`}
            onMouseEnter={() => preloadRoute(`${scope.base}/new`)}
            onFocus={() => preloadRoute(`${scope.base}/new`)}
            className="btn-primary"
          >
            Nouvelle demande d'essai
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">{activeConfig.label}</h3>
        {filteredTrials.length > 0 ? (
          filteredTrials.map((trial) => (
            <OnlineTrialDossierCard key={trial.id} trial={trial} to={`${scope.base}/${trial.id}`} />
          ))
        ) : (
          <div className="panel p-6 text-sm text-slate-500">{activeConfig.emptyMessage}</div>
        )}
      </section>
    </div>
  );
}
