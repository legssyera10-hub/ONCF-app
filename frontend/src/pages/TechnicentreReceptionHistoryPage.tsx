import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { PageBreadcrumbs } from "../components/PageBreadcrumbs";
import { TechnicentreDossierRow } from "../components/TechnicentreDossierRow";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Establishment, Notification } from "../types";
import { getApiTimestamp, parseApiDate } from "../utils/format";
import { getAlertStatusFilterOptions } from "../utils/status";

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

export function TechnicentreReceptionHistoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const selectedDate = searchParams.get("date") ?? "";
  const search = searchParams.get("q") ?? "";
  const selectedStatus = searchParams.get("status") ?? "ALL";

  async function load() {
    if (!token) {
      return;
    }

    const [notificationsResult, establishmentsResult] = await Promise.all([
      api.notifications(token),
      api.establishments(token),
    ]);
    setNotifications(notificationsResult);
    setEstablishments(establishmentsResult);
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const receptions = useMemo(
    () =>
      notifications
        .filter((item) => (selectedStatus !== "ALL" ? item.alert.status === selectedStatus : true))
        .filter((item) =>
          [
            "RECEPTION_PARTIELLE",
            "RECEPTION_COMPLETE",
          ].includes(item.alert.status)
        )
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
            item.alert.dossier_label ?? item.alert.dossier_number ?? item.alert.id,
            item.alert.created_by.full_name,
            item.establishment.name,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        })
        .sort(
          (a, b) =>
            getApiTimestamp(b.alert.establishment_confirmation?.confirmed_at ?? b.sent_at) -
            getApiTimestamp(a.alert.establishment_confirmation?.confirmed_at ?? a.sent_at)
        ),
    [notifications, search, selectedDate, selectedStatus]
  );

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-5">
          <div>
            <PageBreadcrumbs
              items={[
                { label: "Technicentre", to: "/technicentre" },
                { label: "Réception", to: "/technicentre/reception" },
                { label: "Historique" },
              ]}
            />
            <button type="button" onClick={() => navigate("/technicentre/reception")} className="btn-secondary">
              Retour
            </button>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Historique réception</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dossiers de réception</h2>
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
          onDateChange={(value) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value) {
                next.set("date", value);
              } else {
                next.delete("date");
              }
              return next;
            });
          }}
          searchLabel="Recherche"
          searchValue={search}
          onSearchChange={(value) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value.trim()) {
                next.set("q", value);
              } else {
                next.delete("q");
              }
              return next;
            });
          }}
          searchPlaceholder="Dossier, demandeur ou destinataire"
          statusValue={selectedStatus}
          statusOptions={getAlertStatusFilterOptions()}
          onStatusChange={(value) => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              if (value === "ALL") {
                next.delete("status");
              } else {
                next.set("status", value);
              }
              return next;
            });
          }}
          metrics={[{ label: "Résultats", value: receptions.length }]}
        />
      </section>

      {receptions.length > 0 ? (
        <div className="space-y-4">
          {receptions.map((notification) => (
            <TechnicentreDossierRow
              key={notification.id}
              alert={notification.alert}
              requesterLabel={
                establishments.find((item) => item.id === notification.alert.created_by.establishment_id)?.code ??
                establishments.find((item) => item.id === notification.alert.created_by.establishment_id)?.name ??
                notification.alert.created_by.full_name
              }
              eventCount={notification.alert.history.length}
              actionLabel="Ouvrir la réception"
              latestNote={notification.alert.history.slice().reverse().find((item) => item.note?.trim())?.note}
              to={`/technicentre/reception/history/${notification.alert.id}`}
              state={{
                returnTo: `/technicentre/reception/history${selectedDate || search || selectedStatus !== "ALL" ? `?${new URLSearchParams(
                  Object.fromEntries(
                    Object.entries({
                      ...(selectedDate ? { date: selectedDate } : {}),
                      ...(search ? { q: search } : {}),
                      ...(selectedStatus !== "ALL" ? { status: selectedStatus } : {}),
                    })
                  )
                ).toString()}` : ""}`,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-sm text-slate-500">
          {selectedDate ? "Aucune réception trouvée pour la date sélectionnée." : "Aucune réception confirmée à afficher."}
        </div>
      )}
    </div>
  );
}
