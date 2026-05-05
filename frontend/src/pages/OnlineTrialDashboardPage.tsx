import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { OnlineTrialDossierCard } from "../components/OnlineTrialDossierCard";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { preloadRoute } from "../routes/lazyRoutes";
import type { OnlineTrial } from "../types";

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

  const metrics = useMemo(() => {
    const total = trials.length;
    const pending = trials.filter((item) => item.status === "EN_COURS_DE_TRAITEMENT").length;
    const toUpdate = trials.filter((item) => item.status === "A_MODIFIER").length;
    const completed = trials.filter((item) => item.status === "RECEPTION_COMPLETE").length;
    return { total, pending, toUpdate, completed };
  }, [trials]);

  const actionableTrials = useMemo(
    () =>
      trials
        .filter((item) => item.status === "A_MODIFIER" || item.status === "TRAITEE_PAR_PM")
        .sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime())
        .slice(0, 6),
    [trials]
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-700">En attente PPM</p>
            <p className="mt-2 text-3xl font-semibold text-sky-900">{metrics.pending}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">A modifier</p>
            <p className="mt-2 text-3xl font-semibold text-amber-900">{metrics.toUpdate}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Essais realises</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">{metrics.completed}</p>
          </div>
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
        <h3 className="text-lg font-semibold text-slate-900">Dossiers prioritaires</h3>
        {actionableTrials.length > 0 ? (
          actionableTrials.map((trial) => (
            <OnlineTrialDossierCard key={trial.id} trial={trial} to={`${scope.base}/${trial.id}`} />
          ))
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Aucun dossier prioritaire pour le moment.</div>
        )}
      </section>
    </div>
  );
}
