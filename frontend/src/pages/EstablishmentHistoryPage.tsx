import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AlertTimeline } from "../components/AlertTimeline";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { getAlertStatusFilterOptions } from "../utils/status";
import { formatDateTime, getApiTimestamp, parseApiDate } from "../utils/format";
import type { Notification } from "../types";

function toLocalDateInput(value: Date) {
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function isSameLocalDate(value: string, targetDate: string) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return false;
  }
  return toLocalDateInput(parsed) === targetDate;
}

export function EstablishmentHistoryPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  async function load() {
    if (!token) {
      return;
    }
    const data = await api.notifications(token);
    setNotifications(data);
  }

  useEffect(() => {
    load();
  }, [token]);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((item) => (selectedStatus !== "ALL" ? item.alert.status === selectedStatus : true))
      .filter((item) =>
        selectedDate
          ? isSameLocalDate(item.alert.establishment_confirmation?.confirmed_at ?? item.sent_at, selectedDate)
          : true
      )
      .filter((item) => {
        const query = search.trim().toLowerCase();
        if (!query) {
          return true;
        }

        const haystack = [
          item.alert.material_ref,
          item.alert.problem_description,
          item.alert.station.name,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort(
        (a, b) =>
          getApiTimestamp(b.alert.establishment_confirmation?.confirmed_at ?? b.sent_at) -
          getApiTimestamp(a.alert.establishment_confirmation?.confirmed_at ?? a.sent_at)
      );
  }, [notifications, selectedStatus, selectedDate, search]);

  useEffect(() => {
    const exists = filteredNotifications.some((item) => item.alert.id === selectedAlertId);
    if (!exists) {
      setSelectedAlertId(filteredNotifications[0]?.alert.id ?? null);
    }
  }, [filteredNotifications, selectedAlertId]);

  const current =
    filteredNotifications.find((item) => item.alert.id === selectedAlertId) ??
    filteredNotifications[0] ??
    null;

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="panel flex min-h-0 flex-col overflow-hidden self-start xl:sticky xl:top-6 xl:h-[calc(100vh-4rem)]">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-semibold">Historique des receptions technicentre</h2>

          <div className="mt-4">
            <DossierFiltersBar
              dateValue={selectedDate}
              onDateClear={() => setSelectedDate("")}
              onDateEnable={() => setSelectedDate((current) => current || toLocalDateInput(new Date()))}
              onDateChange={setSelectedDate}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Référence, motif ou site"
              statusValue={selectedStatus}
              statusOptions={getAlertStatusFilterOptions()}
              onStatusChange={setSelectedStatus}
              metrics={[{ label: "Dossiers trouvés", value: filteredNotifications.length }]}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filteredNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => setSelectedAlertId(notification.alert.id)}
                  className={`panel w-full p-4 text-left ${
                    notification.alert.id === current?.alert.id ? "ring-2 ring-brand-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{notification.alert.material_ref}</p>
                      <p className="text-xs text-slate-500">
                        {notification.alert.establishment_confirmation?.confirmed_at
                          ? formatDateTime(notification.alert.establishment_confirmation.confirmed_at)
                          : formatDateTime(notification.sent_at)}
                      </p>
                    </div>
                    <StatusBadge
                      status={notification.alert.status}
                      materialConfirmations={notification.alert.establishment_confirmation?.material_confirmations}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{notification.alert.problem_description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel p-5 text-sm text-slate-500">
              {selectedDate
                ? "Aucune demande reçue pour la date sélectionnée."
                : "Aucune demande trouvée pour ce filtre."}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        {current ? (
          <>
            <div className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">{current.alert.material_ref}</h2>
                  <p className="text-sm text-slate-500">
                    {current.alert.station.name} ·{" "}
                    {current.alert.establishment_confirmation?.confirmed_at
                      ? `confirmée le ${formatDateTime(current.alert.establishment_confirmation.confirmed_at)}`
                      : `reçue le ${formatDateTime(current.sent_at)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge
                    status={current.alert.status}
                    materialConfirmations={current.alert.establishment_confirmation?.material_confirmations}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Motif</p>
                  <p className="mt-2 text-sm text-slate-700">{current.alert.problem_description}</p>
                </div>
              </div>
            </div>

            <div className="panel p-6">
              <h3 className="mb-4 text-lg font-semibold">Timeline de la demande</h3>
              <AlertTimeline history={current.alert.history} />
            </div>
          </>
        ) : (
          <div className="panel p-6 text-sm text-slate-500">
            {selectedDate
              ? "Sélectionnez une demande pour afficher ses détails."
              : "Appliquez un filtre puis sélectionnez une demande."}
          </div>
        )}
      </section>
    </div>
  );
}
