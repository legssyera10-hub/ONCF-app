import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { OnlineTrialDossierCard } from "../components/OnlineTrialDossierCard";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
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

export function PermanentOnlineTrialDashboardPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [error, setError] = useState("");

  const selectedDate = searchParams.get("date") ?? "";
  const search = searchParams.get("q") ?? "";
  const selectedStatus = searchParams.get("status") ?? "EN_COURS_DE_TRAITEMENT";

  async function load() {
    if (!token) return;
    try {
      setError("");
      const result = await api.onlineTrials(token);
      setTrials(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des demandes d'essai");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const trialsFilteredWithoutStatus = useMemo(
    () =>
      trials
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
    [trials, selectedDate, search]
  );

  const filteredTrials = useMemo(
    () =>
      trialsFilteredWithoutStatus.filter((item) =>
        selectedStatus !== "ALL" ? item.status === selectedStatus : true
      ),
    [trialsFilteredWithoutStatus, selectedStatus]
  );

  const pendingCount = trialsFilteredWithoutStatus.filter((item) => item.status === "EN_COURS_DE_TRAITEMENT").length;
  const acceptedCount = trialsFilteredWithoutStatus.filter((item) => item.status === "TRAITEE_PAR_PM").length;
  const modificationCount = trialsFilteredWithoutStatus.filter((item) => item.status === "A_MODIFIER").length;
  const cancelledCount = trialsFilteredWithoutStatus.filter((item) => item.status === "ANNULEE").length;
  const modifieeCount = trialsFilteredWithoutStatus.filter((item) => item.status === "MODIFIEE").length;
  const completedCount = trialsFilteredWithoutStatus.filter((item) => item.status === "RECEPTION_COMPLETE").length;

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Permanent PPM - Essais en ligne</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pilotage des demandes d'essai</h2>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <div className={pendingCount > 0 ? "metric-card permanent-alert-card" : "metric-card"}>
            <p className={pendingCount > 0 ? "text-xs uppercase tracking-[0.22em] text-rose-700" : "text-xs uppercase tracking-[0.22em] text-slate-400"}>
              En cours de traitement
            </p>
            <p className={pendingCount > 0 ? "mt-3 text-3xl font-semibold text-rose-700" : "mt-3 text-3xl font-semibold text-slate-900"}>
              {pendingCount}
            </p>
            <p className={pendingCount > 0 ? "mt-2 text-sm text-rose-600" : "mt-2 text-sm text-slate-500"}>
              Demandes en attente d'instruction
            </p>
          </div>

          <div className="rounded-[1.2rem] bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Acceptee</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{acceptedCount}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Annulations</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{cancelledCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">A modifier</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{modificationCount}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-700">Modifiee</p>
                <p className="mt-2 text-2xl font-semibold text-fuchsia-800">{modifieeCount}</p>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-teal-700">Essais realises</p>
                <p className="mt-2 text-2xl font-semibold text-teal-800">{completedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
            if (value) next.set("date", value);
            else next.delete("date");
            return next;
          })
        }
        searchValue={search}
        onSearchChange={(value) =>
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (value.trim()) next.set("q", value);
            else next.delete("q");
            return next;
          })
        }
        searchPlaceholder="Dossier, demandeur ou destinataire"
        statusValue={selectedStatus}
        statusOptions={getOnlineTrialStatusFilterOptions()}
        onStatusChange={(value) =>
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (value === "ALL") next.delete("status");
            else next.set("status", value);
            return next;
          })
        }
        metrics={[{ label: "Dossiers trouves", value: filteredTrials.length }]}
      />

      <section className="space-y-4">
        {filteredTrials.length > 0 ? (
          filteredTrials.map((trial) => (
            <OnlineTrialDossierCard key={trial.id} trial={trial} to={`/permanent/essais/${trial.id}`} />
          ))
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Aucune demande d'essai pour le filtre actif.</div>
        )}
      </section>
    </div>
  );
}
