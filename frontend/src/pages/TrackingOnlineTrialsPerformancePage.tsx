import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { OnlineTrial } from "../types";
import { formatDelayMinutes, parseApiDate } from "../utils/format";
import { parseOnlineTrialProgress } from "../utils/onlineTrialMaterials";

function getAverageDelayMinutes(trial: OnlineTrial): number | null {
  const progress = parseOnlineTrialProgress(trial.trial_material_progress);
  const delays = Object.values(progress)
    .map((entry) => entry.delay_minutes)
    .filter((value): value is number => typeof value === "number");
  if (delays.length === 0) return null;
  return Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length);
}

function toLocalDayKey(value: string) {
  const parsed = parseApiDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TrackingOnlineTrialsPerformancePage() {
  const { token } = useAuth();
  const [trials, setTrials] = useState<OnlineTrial[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      setError("");
      setTrials(await api.onlineTrials(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des performances");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const summary = useMemo(() => {
    const total = trials.length;
    const pending = trials.filter((item) => item.status === "EN_COURS_DE_TRAITEMENT").length;
    const accepted = trials.filter((item) => item.status === "TRAITEE_PAR_PM").length;
    const completed = trials.filter((item) => item.status === "RECEPTION_COMPLETE").length;
    const cancelled = trials.filter((item) => item.status === "ANNULEE").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const delays = trials
      .map((item) => getAverageDelayMinutes(item))
      .filter((value): value is number => typeof value === "number");
    const averageDelay = delays.length > 0 ? Math.round(delays.reduce((sum, value) => sum + value, 0) / delays.length) : null;

    return { total, pending, accepted, completed, cancelled, completionRate, averageDelay };
  }, [trials]);

  const byExploitant = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; cancelled: number }>();
    for (const trial of trials) {
      const key = trial.maintenance_state;
      const current = map.get(key) ?? { total: 0, completed: 0, cancelled: 0 };
      current.total += 1;
      if (trial.status === "RECEPTION_COMPLETE") current.completed += 1;
      if (trial.status === "ANNULEE") current.cancelled += 1;
      map.set(key, current);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [trials]);

  const byCreator = useMemo(() => {
    const map = new Map<string, number>();
    for (const trial of trials) {
      const key = trial.created_by.full_name;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [trials]);

  const last7Days = useMemo(() => {
    const now = new Date();
    const result: Array<{ key: string; label: string; count: number }> = [];
    const counts = new Map<string, number>();
    for (const trial of trials) {
      const key = toLocalDayKey(trial.created_at);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      const key = toLocalDayKey(day.toISOString());
      result.push({
        key,
        label: day.toLocaleDateString("fr-FR", { weekday: "short" }),
        count: counts.get(key) ?? 0,
      });
    }
    return result;
  }, [trials]);

  const maxDaily = Math.max(1, ...last7Days.map((item) => item.count));

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Suivi · Performance essais</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Performance des demandes d'essai en ligne</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total demandes</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Taux realise</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">{summary.completionRate}%</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-700">En attente PPM</p>
            <p className="mt-2 text-3xl font-semibold text-sky-900">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Retard moyen</p>
            <p className="mt-2 text-3xl font-semibold text-rose-900">
              {summary.averageDelay != null ? formatDelayMinutes(summary.averageDelay) : "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-semibold text-slate-900">Demandes par exploitant</p>
          <div className="mt-4 space-y-3">
            {byExploitant.length > 0 ? (
              byExploitant.map((item) => (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{item.key}</span>
                    <span className="text-xs text-slate-500">{item.total} demande(s)</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                      Realisees: {item.completed}
                    </span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">
                      Annulees: {item.cancelled}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Aucune donnee exploitable.</p>
            )}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-semibold text-slate-900">Top createurs</p>
          <div className="mt-4 space-y-2">
            {byCreator.length > 0 ? (
              byCreator.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Aucune donnee.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.4)]">
        <p className="text-sm font-semibold text-slate-900">Volume des demandes (7 derniers jours)</p>
        <div className="mt-4 flex h-44 items-end gap-3">
          {last7Days.map((day) => (
            <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="text-xs font-semibold text-slate-700">{day.count}</div>
              <div className="flex h-32 w-full max-w-[42px] items-end rounded-md bg-slate-100 p-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-sky-600 to-sky-400"
                  style={{ height: `${Math.max(4, Math.round((day.count / maxDaily) * 100))}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">{day.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Acceptees PPM</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.accepted}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Essais realises</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.completed}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Annulees</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.cancelled}</p>
        </div>
      </section>
    </div>
  );
}
