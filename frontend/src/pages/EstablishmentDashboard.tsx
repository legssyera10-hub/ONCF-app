import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AlertTimeline } from "../components/AlertTimeline";
import { ConfirmationForm } from "../components/ConfirmationForm";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../utils/api";
import { formatDateTime, formatDelayMinutes } from "../utils/format";
import type { Notification } from "../types";

export function EstablishmentDashboard() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  async function load() {
    if (!token) {
      return;
    }
    const data = (await api.notifications(token)).filter(
      (item) =>
        item.alert.status === "TRAITEE_PAR_PM" ||
        item.alert.status === "RECEPTION_PARTIELLE"
    );
    setNotifications(data);
    setSelected((current) => current ?? data[0]?.alert.id ?? null);
  }

  useEffect(() => {
    load();
  }, [token]);

  const current = notifications.find((item) => item.alert.id === selected) ?? notifications[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
      <section className="space-y-4">
        <div className="panel p-4">
          <h2 className="text-lg font-semibold">Receptions du technicentre</h2>
          <p className="text-sm text-slate-500">{notifications.length} acheminement(s) a receptionner</p>
        </div>
        {notifications.map((notification) => (
          <button
            type="button"
            key={notification.id}
            onClick={() => setSelected(notification.alert.id)}
            className={`panel w-full p-4 text-left ${notification.alert.id === current?.alert.id ? "ring-2 ring-brand-500" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{notification.alert.material_ref}</p>
                <p className="text-xs text-slate-500">{formatDateTime(notification.sent_at)}</p>
              </div>
              <StatusBadge
                status={notification.alert.status}
                materialConfirmations={notification.alert.establishment_confirmation?.material_confirmations}
              />
            </div>
            <p className="mt-3 text-sm text-slate-600">{notification.alert.problem_description}</p>
          </button>
        ))}
      </section>
      <section className="panel p-6">
        {current ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{current.alert.material_ref}</h2>
                <p className="text-sm text-slate-500">{current.alert.station.name}</p>
              </div>
              <StatusBadge
                status={current.alert.status}
                materialConfirmations={current.alert.establishment_confirmation?.material_confirmations}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Retard</p>
                <p className="mt-2 text-sm text-slate-700">
                  {formatDelayMinutes(current.alert.establishment_confirmation?.delay_minutes)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">EXP</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">EXP {current.alert.maintenance_state}</p>
              </div>
            </div>
            {current.alert.attachments.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pieces jointes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.alert.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-700"
                      href={`${API_BASE_URL}${attachment.stored_path}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {attachment.filename}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <div>
                <h3 className="mb-4 text-lg font-semibold">Timeline</h3>
                <AlertTimeline history={current.alert.history} />
              </div>
              <div>
                <h3 className="mb-4 text-lg font-semibold">Reception</h3>
                {current.alert.establishment_confirmation && ["RECEPTION_COMPLETE", "ANNULEE", "MODIFIEE"].includes(current.alert.status) ? (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><strong>Confirme par:</strong> {current.alert.establishment_confirmation.establishment_user.full_name}</p>
                    <p><strong>Date reception:</strong> {formatDateTime(current.alert.establishment_confirmation.reception_date)}</p>
                    <p><strong>Retard:</strong> {formatDelayMinutes(current.alert.establishment_confirmation.delay_minutes)}</p>
                    <p><strong>Remarques:</strong> {current.alert.establishment_confirmation.remarks ?? "-"}</p>
                  </div>
                ) : (
                  <ConfirmationForm
                    alert={current.alert}
                    onSubmit={async (payload) => {
                      if (!token) {
                        return;
                      }
                      await api.confirmReception(token, current.alert.id, payload);
                      await load();
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune notification.</p>
        )}
      </section>
    </div>
  );
}
