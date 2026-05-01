import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { TechnicentreDossierRow } from "../components/TechnicentreDossierRow";
import { PageBreadcrumbs } from "../components/PageBreadcrumbs";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { preloadRoute } from "../routes/lazyRoutes";
import type { Alert, Establishment } from "../types";
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

export function TechnicentreRequestHistoryPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const selectedDate = searchParams.get("date") ?? "";
  const search = searchParams.get("q") ?? "";
  const selectedStatus = searchParams.get("status") ?? "ALL";

  async function load() {
    if (!token) {
      return;
    }

    const [alertsResult, establishmentsResult] = await Promise.all([
      api.alerts(token, "?mine=true"),
      api.establishments(token),
    ]);
    setAlerts(alertsResult);
    setEstablishments(establishmentsResult);
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const requesterLabel =
    establishments.find((item) => item.id === user?.establishment_id)?.code ??
    establishments.find((item) => item.id === user?.establishment_id)?.name ??
    user?.full_name ??
    "";

  const filteredAlerts = useMemo(
    () =>
      alerts
        .filter((item) => (selectedStatus !== "ALL" ? item.status === selectedStatus : true))
        .filter((item) => (selectedDate ? isSameLocalDate(item.created_at, selectedDate) : true))
        .filter((item) => {
          const query = search.trim().toLowerCase();
          if (!query) {
            return true;
          }

          const haystack = [
            item.dossier_label ?? item.dossier_number ?? item.id,
            item.requested_destination_establishment?.name ?? "",
            item.created_by.full_name,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        })
        .sort((a, b) => getApiTimestamp(b.created_at) - getApiTimestamp(a.created_at)),
    [alerts, search, selectedDate, selectedStatus]
  );

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <PageBreadcrumbs
              items={[
                { label: "Technicentre", to: "/technicentre" },
                { label: "Demande", to: "/technicentre/demande" },
                { label: "Historique" },
              ]}
            />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Historique demande</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dossiers des demandes</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/technicentre/demande"
              onMouseEnter={() => preloadRoute("/technicentre/demande")}
              onFocus={() => preloadRoute("/technicentre/demande")}
              className="btn-secondary"
            >
              Retour
            </Link>
            <Link
              to="/technicentre/demande/create"
              onMouseEnter={() => preloadRoute("/technicentre/demande/create")}
              onFocus={() => preloadRoute("/technicentre/demande/create")}
              className="btn-primary"
            >
              Créer une demande
            </Link>
          </div>
        </div>

        <DossierFiltersBar
          dateValue={selectedDate}
          onDateClear={() => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("date");
              return next;
            });
          }}
          onDateEnable={() => {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.set("date", selectedDate || toLocalDateInput(new Date()));
              return next;
            });
          }}
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
          metrics={[{ label: "Résultats", value: filteredAlerts.length }]}
        />
      </section>

      {filteredAlerts.length > 0 ? (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <TechnicentreDossierRow
              key={alert.id}
              alert={alert}
              requesterLabel={requesterLabel}
              eventCount={alert.history.length}
              actionLabel="Ouvrir la demande"
              latestNote={alert.history.slice().reverse().find((item) => item.note?.trim())?.note}
              to={`/technicentre/demande/history/${alert.id}`}
              state={{
                returnTo: `/technicentre/demande/history${selectedDate || search || selectedStatus !== "ALL" ? `?${new URLSearchParams(
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
          {selectedDate ? "Aucune demande trouvée pour la date sélectionnée." : "Aucune demande trouvée dans l'historique."}
        </div>
      )}
    </div>
  );
}
