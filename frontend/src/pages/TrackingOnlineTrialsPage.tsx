import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { OnlineTrial } from "../types";
import { formatDateOnly, formatDateTime, formatDelayMinutes, getApiTimestamp, parseApiDate } from "../utils/format";
import { parseOnlineTrialProgress } from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusFilterOptions, getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";

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

function getAverageDelayMinutes(trial: OnlineTrial): number | null {
  const progress = parseOnlineTrialProgress(trial.trial_material_progress);
  const delays = Object.values(progress)
    .map((entry) => entry.delay_minutes)
    .filter((value): value is number => typeof value === "number");
  if (delays.length === 0) return null;
  return Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length);
}

export function TrackingOnlineTrialsPage() {
  const { token } = useAuth();
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  async function load() {
    if (!token) return;
    try {
      setError("");
      const result = await api.onlineTrials(token);
      setTrials(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des essais");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const filtered = useMemo(
    () =>
      trials
        .filter((item) => (selectedStatus !== "ALL" ? item.status === selectedStatus : true))
        .filter((item) => (selectedDate ? isSameLocalDate(item.created_at, selectedDate) : true))
        .filter((item) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return [item.id, item.dossier_label, item.created_by.full_name, item.station.name, item.material_ref, item.problem_description]
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

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Suivi · Essais en ligne</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Vision globale des demandes d'essai</h2>
      </section>

      <DossierFiltersBar
        dateValue={selectedDate}
        onDateClear={() => setSelectedDate("")}
        onDateEnable={() => setSelectedDate((current) => current || toLocalDateInput(new Date()))}
        onDateChange={setSelectedDate}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Dossier, createur, site, materiel ou motif"
        statusValue={selectedStatus}
        statusOptions={getOnlineTrialStatusFilterOptions()}
        onStatusChange={setSelectedStatus}
        metrics={[{ label: "Demandes", value: filtered.length }]}
      />

      <section className="panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] border-collapse text-sm text-slate-700">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="border border-slate-200 px-3 py-3 text-left">Dossier</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Date demande</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Createur</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Site</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Materiel</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Exploitant</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Statut</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Decision PPM</th>
                <th className="border border-slate-200 px-3 py-3 text-left">Retard moyen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trial) => {
                const averageDelay = getAverageDelayMinutes(trial);
                const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
                return (
                  <tr key={trial.id} className="odd:bg-white even:bg-slate-50/70">
                    <td className="border border-slate-200 px-3 py-3 font-semibold text-slate-900">#{dossierLabel}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      <div>{formatDateOnly(trial.request_date ?? trial.created_at)}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(trial.request_date ?? trial.created_at)}</div>
                    </td>
                    <td className="border border-slate-200 px-3 py-3">{trial.created_by.full_name}</td>
                    <td className="border border-slate-200 px-3 py-3">{trial.station.name}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      <div>{trial.material_type}</div>
                      <div className="text-xs text-slate-500">{trial.material_ref}</div>
                    </td>
                    <td className="border border-slate-200 px-3 py-3">{trial.maintenance_state}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      <StatusBadge status={trial.status} labelOverride={getOnlineTrialStatusLabel(trial.status)} />
                    </td>
                    <td className="border border-slate-200 px-3 py-3">{trial.permanent_decision?.decision ?? "-"}</td>
                    <td className="border border-slate-200 px-3 py-3">
                      {averageDelay != null ? formatDelayMinutes(averageDelay) : "-"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
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
