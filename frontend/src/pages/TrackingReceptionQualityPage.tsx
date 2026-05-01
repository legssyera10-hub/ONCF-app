import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  getRequestedDestinationLabel,
  getRetainedDestinationLabel,
} from "../components/AlertRequestDetailsGrid";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Alert } from "../types";
import {
  buildAlertMaterialRows,
  parseConfirmedMaterialIndexes,
  parseMaterialConfirmations,
} from "../utils/alertMaterials";
import { formatDateTime, parseApiDate } from "../utils/format";

const ALL = "ALL";
const LAG_THRESHOLD_MINUTES = 5;
const TECHNICENTRE_CODES = [
  "TMF",
  "TMIC",
  "TMIJ",
  "TMIM",
  "TMIO",
  "TMIS",
  "TMK",
  "TMLC",
  "TMM",
  "TMN",
  "TMRC",
  "TMT",
  "TMVC",
] as const;

type LagRow = {
  id: string;
  dossier: string;
  technicentre: string;
  receptionDate: string;
  receptionSystemDate: string;
  lagMinutes: number;
};

function toTechnicentreCode(value: string) {
  const cleaned = value.replace(/^technicentre\s+/i, "").trim().toUpperCase();
  return TECHNICENTRE_CODES.includes(cleaned as (typeof TECHNICENTRE_CODES)[number]) ? cleaned : "";
}

function computeLagMinutes(receptionDateIso: string, receptionSystemDateIso: string) {
  const receptionDate = parseApiDate(receptionDateIso);
  const receptionSystemDate = parseApiDate(receptionSystemDateIso);
  if (!receptionDate || !receptionSystemDate) {
    return null;
  }
  return Math.round((receptionSystemDate.getTime() - receptionDate.getTime()) / 60000);
}

export function TrackingReceptionQualityPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [technicentreFilter, setTechnicentreFilter] = useState(ALL);

  async function load() {
    if (!token) {
      return;
    }
    try {
      setError("");
      const result = await api.alerts(token);
      setAlerts(result);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des demandes");
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useLiveAlerts(Boolean(token), load, () => undefined);

  const lagRows = useMemo<LagRow[]>(() => {
    return alerts.flatMap((alert) => {
      const materialRows = buildAlertMaterialRows(alert);
      const confirmations = parseMaterialConfirmations(alert.establishment_confirmation?.material_confirmations);
      const confirmedIndexes = parseConfirmedMaterialIndexes(
        alert.establishment_confirmation?.confirmed_material_indexes
      );
      const destinationRequested = getRequestedDestinationLabel(alert);
      const destinationRetained = getRetainedDestinationLabel(alert);
      const technicentre =
        toTechnicentreCode(destinationRetained || destinationRequested || "") || "-";

      return materialRows.flatMap((materialRow) => {
        const confirmation = confirmations[materialRow.index];
        const isConfirmed = Boolean(confirmation?.confirmed) || confirmedIndexes.includes(materialRow.index);
        const hasFinalReceptionValidation =
          confirmation?.reception_status === "VALIDEE" || isConfirmed;

        if (!hasFinalReceptionValidation) {
          return [];
        }

        const receptionDate = confirmation?.reception_date ?? "";
        const receptionSystemDate =
          confirmation?.confirmed_at ??
          (isConfirmed ? alert.establishment_confirmation?.confirmed_at ?? "" : "");

        const lagMinutes =
          receptionDate && receptionSystemDate
            ? computeLagMinutes(receptionDate, receptionSystemDate)
            : null;

        if (lagMinutes === null || !Number.isFinite(lagMinutes)) {
          return [];
        }

        return [
          {
            id: `${alert.id}-${materialRow.id}`,
            dossier: alert.dossier_label ?? String(alert.id),
            technicentre,
            receptionDate,
            receptionSystemDate,
            lagMinutes,
          },
        ];
      });
    });
  }, [alerts]);

  const technicentreOptions = useMemo(
    () => [{ value: ALL, label: "Tous" }, ...TECHNICENTRE_CODES.map((code) => ({ value: code, label: code }))],
    []
  );

  const filteredLagRows = useMemo(
    () =>
      lagRows.filter((row) =>
        technicentreFilter === ALL ? true : row.technicentre === technicentreFilter
      ),
    [lagRows, technicentreFilter]
  );

  const lagKpis = useMemo(() => {
    const total = filteredLagRows.length;
    if (total === 0) {
      return {
        total,
        onTime: 0,
        late: 0,
        avgLag: 0,
        maxLag: 0,
        qualityScore: 0,
      };
    }

    const onTime = filteredLagRows.filter((row) => row.lagMinutes <= LAG_THRESHOLD_MINUTES).length;
    const late = total - onTime;
    const avgLag = Math.round(
      filteredLagRows.reduce((sum, row) => sum + row.lagMinutes, 0) / total
    );
    const maxLag = Math.max(...filteredLagRows.map((row) => row.lagMinutes));
    const qualityScore = Math.max(
      0,
      Math.min(100, Math.round((onTime / total) * 100 - Math.max(0, avgLag - LAG_THRESHOLD_MINUTES) * 0.6))
    );

    return {
      total,
      onTime,
      late,
      avgLag,
      maxLag,
      qualityScore,
    };
  }, [filteredLagRows]);

  const lagByTechnicentre = useMemo(() => {
    const bucket = new Map<string, { total: number; onTime: number; avgLag: number; maxLag: number }>();
    for (const row of lagRows) {
      const current = bucket.get(row.technicentre) ?? { total: 0, onTime: 0, avgLag: 0, maxLag: 0 };
      const nextTotal = current.total + 1;
      bucket.set(row.technicentre, {
        total: nextTotal,
        onTime: current.onTime + (row.lagMinutes <= LAG_THRESHOLD_MINUTES ? 1 : 0),
        avgLag: (current.avgLag * current.total + row.lagMinutes) / nextTotal,
        maxLag: Math.max(current.maxLag, row.lagMinutes),
      });
    }

    return Array.from(bucket.entries())
      .map(([code, stats]) => ({
        code,
        total: stats.total,
        onTimeRate: Math.round((stats.onTime / stats.total) * 100),
        avgLag: Math.round(stats.avgLag),
        maxLag: stats.maxLag,
        score: Math.max(
          0,
          Math.min(100, Math.round((stats.onTime / stats.total) * 100 - Math.max(0, stats.avgLag - LAG_THRESHOLD_MINUTES) * 0.8))
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 13);
  }, [lagRows]);

  const lagDistribution = useMemo(() => {
    const buckets = [
      { label: "<= 5 min", min: Number.NEGATIVE_INFINITY, max: 5, count: 0 },
      { label: "6-15 min", min: 6, max: 15, count: 0 },
      { label: "16-30 min", min: 16, max: 30, count: 0 },
      { label: "31-60 min", min: 31, max: 60, count: 0 },
      { label: "> 60 min", min: 61, max: Number.POSITIVE_INFINITY, count: 0 },
    ];

    for (const row of filteredLagRows) {
      const target = buckets.find((bucket) => row.lagMinutes >= bucket.min && row.lagMinutes <= bucket.max);
      if (target) {
        target.count += 1;
      }
    }

    const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return { buckets, max };
  }, [filteredLagRows]);

  const topLateRows = useMemo(
    () => [...filteredLagRows].sort((a, b) => b.lagMinutes - a.lagMinutes).slice(0, 12),
    [filteredLagRows]
  );

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}

      <section className="panel border border-slate-200 bg-[linear-gradient(160deg,#ffffff,#f8fafc)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Qualite de saisie reception</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Performance de saisie par technicentre</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ecart entre date de reception saisie et date systeme reelle de validation (seuil a l'heure: {LAG_THRESHOLD_MINUTES} min).
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lastUpdatedAt ? `Mise a jour: ${formatDateTime(lastUpdatedAt)}` : ""}
            </p>
          </div>

          <div className="w-full max-w-xs space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Technicentre</span>
            <select
              className="input"
              value={technicentreFilter}
              onChange={(e) => setTechnicentreFilter(e.target.value)}
            >
              {technicentreOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-violet-700">Score qualite</p>
            <p className="mt-1 text-2xl font-semibold text-violet-900">{lagKpis.qualityScore}/100</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Lignes evaluables</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{lagKpis.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">A l'heure</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">{lagKpis.onTime}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-rose-700">Retard de saisie</p>
            <p className="mt-1 text-2xl font-semibold text-rose-800">{lagKpis.late}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Decalage moyen</p>
            <p className="mt-1 text-2xl font-semibold text-amber-800">{lagKpis.avgLag} min</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-indigo-700">Decalage max</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-800">{lagKpis.maxLag} min</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Classement technicentres (global)</p>
          <div className="mt-3 space-y-3">
            {lagByTechnicentre.length === 0 ? <p className="text-sm text-slate-500">Aucune donnee exploitable.</p> : null}
            {lagByTechnicentre.map((item) => (
              <div key={item.code} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{item.code}</span>
                  <span>
                    score {item.score} | a l'heure {item.onTimeRate}% | moy {item.avgLag} min | max {item.maxLag} min
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className={`h-2.5 rounded-full ${
                      item.score >= 80 ? "bg-emerald-500" : item.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.max(4, item.score)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Distribution des ecarts (filtre courant)</p>
          <div className="mt-3 space-y-2">
            {lagDistribution.buckets.map((bucket) => (
              <div key={bucket.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{bucket.label}</span>
                  <span className="font-semibold text-slate-800">{bucket.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div
                    className={`h-2.5 rounded-full ${
                      bucket.label === "<= 5 min"
                        ? "bg-emerald-500"
                        : bucket.label === "6-15 min"
                          ? "bg-sky-500"
                          : bucket.label === "16-30 min"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.max(3, Math.round((bucket.count / lagDistribution.max) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          Top lignes avec plus grand decalage ({topLateRows.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] border-collapse text-sm text-slate-700">
            <thead>
              <tr className="bg-white">
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Dossier</th>
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Technicentre</th>
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Date de reception</th>
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Date systeme de reception</th>
                <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Decalage</th>
              </tr>
            </thead>
            <tbody>
              {topLateRows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50/70">
                  <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">#{row.dossier}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.technicentre}</td>
                  <td className="border border-slate-200 px-3 py-2">{formatDateTime(row.receptionDate)}</td>
                  <td className="border border-slate-200 px-3 py-2">{formatDateTime(row.receptionSystemDate)}</td>
                  <td className="border border-slate-200 px-3 py-2">{row.lagMinutes} min</td>
                </tr>
              ))}
              {topLateRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Aucune donnee de decalage disponible pour ce filtre.
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
