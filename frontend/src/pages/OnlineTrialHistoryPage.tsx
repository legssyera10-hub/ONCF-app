import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { OnlineTrialDossierCard } from "../components/OnlineTrialDossierCard";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { preloadRoute } from "../routes/lazyRoutes";
import type { OnlineTrial } from "../types";
import { getApiTimestamp, parseApiDate } from "../utils/format";
import { getOnlineTrialStatusFilterOptions } from "../utils/onlineTrialStatus";

function toLocalDateInput(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function isSameLocalDate(value?: string | null, targetDate?: string) {
  if (!value || !targetDate) {
    return false;
  }
  const parsed = parseApiDate(value);
  if (!parsed) {
    return false;
  }
  return toLocalDateInput(parsed) === targetDate;
}

function getScope(pathname: string) {
  if (pathname.startsWith("/projet/")) {
    return { base: "/projet/essais", label: "Projet" };
  }
  return { base: "/essais", label: "Technicentre" };
}

export function OnlineTrialHistoryPage() {
  const { token } = useAuth();
  const location = useLocation();
  const scope = getScope(location.pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [error, setError] = useState("");

  const selectedDate = searchParams.get("date") ?? "";
  const search = searchParams.get("q") ?? "";
  const selectedStatus = searchParams.get("status") ?? "ALL";

  async function load() {
    if (!token) {
      return;
    }
    try {
      setError("");
      const result = await api.onlineTrials(token, "?mine=true");
      setTrials(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement de l'historique");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const filteredTrials = useMemo(
    () =>
      trials
        .filter((item) => (selectedStatus !== "ALL" ? item.status === selectedStatus : true))
        .filter((item) => (selectedDate ? isSameLocalDate(item.created_at, selectedDate) : true))
        .filter((item) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return [
            item.id,
            item.dossier_label,
            item.material_ref,
            item.station.name,
            item.departure_station?.name,
            item.arrival_station?.name,
            item.created_by.full_name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        })
        .sort((a, b) => getApiTimestamp(b.updated_at ?? b.created_at) - getApiTimestamp(a.updated_at ?? a.created_at)),
    [trials, selectedStatus, selectedDate, search]
  );

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{scope.label} - Historique essais</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dossiers des demandes d'essai</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`${scope.base}/new`}
              onMouseEnter={() => preloadRoute(`${scope.base}/new`)}
              onFocus={() => preloadRoute(`${scope.base}/new`)}
              className="btn-primary"
            >
              Nouvelle demande
            </Link>
          </div>
        </div>

        <DossierFiltersBar
          dateValue={selectedDate}
          onDateClear={() =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("date");
              return next;
            })
          }
          onDateEnable={() =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("date", selectedDate || toLocalDateInput(new Date()));
              return next;
            })
          }
          onDateChange={(value) =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value) {
                next.set("date", value);
              } else {
                next.delete("date");
              }
              return next;
            })
          }
          searchLabel="Recherche"
          searchValue={search}
          onSearchChange={(value) =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value.trim()) {
                next.set("q", value);
              } else {
                next.delete("q");
              }
              return next;
            })
          }
          searchPlaceholder="ID dossier, materiel, site ou createur"
          statusValue={selectedStatus}
          statusOptions={getOnlineTrialStatusFilterOptions()}
          onStatusChange={(value) =>
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value === "ALL") {
                next.delete("status");
              } else {
                next.set("status", value);
              }
              return next;
            })
          }
          metrics={[{ label: "Resultats", value: filteredTrials.length }]}
        />
      </section>

      {filteredTrials.length > 0 ? (
        <div className="space-y-4">
          {filteredTrials.map((trial) => (
            <OnlineTrialDossierCard key={trial.id} trial={trial} to={`${scope.base}/${trial.id}`} />
          ))}
        </div>
      ) : (
        <div className="panel p-6 text-sm text-slate-500">Aucun dossier d'essai pour les filtres actifs.</div>
      )}
    </div>
  );
}
