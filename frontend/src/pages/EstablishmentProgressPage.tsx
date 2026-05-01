import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AlertTimeline } from "../components/AlertTimeline";
import { ConfirmationForm } from "../components/ConfirmationForm";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { formatDateTime, getProgressBarColorClass } from "../utils/format";
import { getCurrentDelayLabel, getTransportProgress, isLateOverOneHour, isTransportInProgress } from "../utils/tracking";
import type { Alert } from "../types";

export function EstablishmentProgressPage() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  async function load() {
    if (!token) {
      return;
    }
    const data = await api.alerts(token);
    const inProgress = data
      .filter(isTransportInProgress)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setAlerts(inProgress);
    setSelectedAlertId((current) => current ?? inProgress[0]?.id ?? null);
  }

  useEffect(() => {
    load();
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const current = alerts.find((alert) => alert.id === selectedAlertId) ?? alerts[0] ?? null;

  const cards = useMemo(
    () =>
      alerts.map((alert) => ({
        alert,
        progress: getTransportProgress(alert),
      })),
    [alerts, nowTick]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="panel flex min-h-0 flex-col overflow-hidden self-start xl:sticky xl:top-6 xl:h-[calc(100vh-4rem)]">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-semibold">Dashboard de l'établissement</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {cards.length > 0 ? (
            <div className="space-y-3">
              {cards.map(({ alert, progress }) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setSelectedAlertId(alert.id)}
                  className={`panel w-full p-4 text-left ${alert.id === current?.id ? "ring-2 ring-brand-500" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{alert.material_ref}</p>
                      <p className="text-xs text-slate-500">
                        {alert.station.name} - {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                    <StatusBadge
                      status={alert.status}
                      materialConfirmations={alert.establishment_confirmation?.material_confirmations}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{alert.problem_description}</p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Progression</span>
                      <span>{progress !== null ? `${progress}%` : "-"}</span>
                    </div>
                    {isLateOverOneHour(alert) ? (
                      <p className="mb-2 text-xs font-semibold text-rose-600">
                        Retard actuel: {getCurrentDelayLabel(alert)}
                      </p>
                    ) : null}
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${getProgressBarColorClass(progress, isLateOverOneHour(alert))}`}
                        style={{ width: `${progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel p-5 text-sm text-slate-500">Aucun matériel en cours d'acheminement vers cet établissement.</div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        {current ? (
          <>
            <div className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{current.material_ref}</h2>
                  <p className="text-sm text-slate-500">
                    Départ {current.station.name} - destination {current.permanent_decision?.destination_establishment.name ?? "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge
                    status={current.status}
                    materialConfirmations={current.establishment_confirmation?.material_confirmations}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Determinate Progress Bar</p>
                    <p className="mt-1 text-sm text-slate-600">Progression estimée automatiquement depuis le traitement PM.</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    {getTransportProgress(current) !== null ? `${getTransportProgress(current)}%` : "-"}
                  </p>
                </div>
                {isLateOverOneHour(current) ? (
                  <p className="mt-3 text-sm font-semibold text-rose-600">
                    Acheminement en retard de {getCurrentDelayLabel(current)}.
                  </p>
                ) : null}
                <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${getProgressBarColorClass(
                      getTransportProgress(current),
                      isLateOverOneHour(current)
                    )}`}
                    style={{ width: `${getTransportProgress(current) ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Motif</p>
                  <p className="mt-2 text-sm text-slate-700">{current.problem_description}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">EXP</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">EXP {current.maintenance_state}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
              <div className="panel p-6">
                <h3 className="mb-4 text-lg font-semibold">Timeline de l'acheminement</h3>
                <AlertTimeline history={current.history} />
              </div>

              <div className="panel p-6">
                <h3 className="mb-4 text-lg font-semibold">Confirmation</h3>
                {current.establishment_confirmation && ["RECEPTION_COMPLETE", "ANNULEE", "MODIFIEE"].includes(current.status) ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Confirmé par :</strong> {current.establishment_confirmation.establishment_user.full_name}</p>
                    <p><strong>Date réception :</strong> {formatDateTime(current.establishment_confirmation.reception_date)}</p>
                    <p><strong>Remarques:</strong> {current.establishment_confirmation.remarks ?? "-"}</p>
                  </div>
                ) : (
                  <ConfirmationForm
                    alert={current}
                    onSubmit={async (payload) => {
                      if (!token) {
                        return;
                      }
                      await api.confirmReception(token, current.id, payload);
                      await load();
                    }}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Aucun acheminement en cours à afficher.</div>
        )}
      </section>
    </div>
  );
}
