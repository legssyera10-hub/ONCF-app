import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { TechnicentreDossierRow } from "../components/TechnicentreDossierRow";
import { PageBreadcrumbs } from "../components/PageBreadcrumbs";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { preloadRoute } from "../routes/lazyRoutes";
import type { Establishment, Notification } from "../types";
import { hasInstanceReceptionMaterial } from "../utils/alertMaterials";
import { getApiTimestamp } from "../utils/format";

export function TechnicentreReceptionListPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const search = searchParams.get("q") ?? "";

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
        .filter((item) => ["TRAITEE_PAR_PM", "RECEPTION_PARTIELLE"].includes(item.alert.status))
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
        .sort((a, b) => getApiTimestamp(b.sent_at) - getApiTimestamp(a.sent_at)),
    [notifications, search]
  );

  const receptionSummary = useMemo(() => {
    const scoped = notifications
      .filter((item) => ["TRAITEE_PAR_PM", "RECEPTION_PARTIELLE", "RECEPTION_COMPLETE"].includes(item.alert.status))
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
      });

    let validated = 0;
    let inInstance = 0;
    let pending = 0;

    for (const item of scoped) {
      if (item.alert.status === "RECEPTION_COMPLETE") {
        validated += 1;
        continue;
      }

      if (hasInstanceReceptionMaterial(item.alert.establishment_confirmation?.material_confirmations)) {
        inInstance += 1;
        continue;
      }

      pending += 1;
    }

    return { validated, inInstance, pending };
  }, [notifications, search]);

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <PageBreadcrumbs items={[{ label: "Technicentre", to: "/technicentre" }, { label: "Réception" }]} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Réception</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dossiers de réception</h2>
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
            <div className={receptions.length > 0 ? "metric-card permanent-alert-card" : "metric-card"}>
              <p className={receptions.length > 0 ? "text-xs uppercase tracking-[0.22em] text-rose-700" : "text-xs uppercase tracking-[0.22em] text-slate-400"}>
                Réceptions programmées
              </p>
              <p className={receptions.length > 0 ? "mt-3 text-3xl font-semibold text-rose-700" : "mt-3 text-3xl font-semibold text-slate-900"}>
                {receptions.length}
              </p>
              <p className={receptions.length > 0 ? "mt-2 text-sm text-rose-600" : "mt-2 text-sm text-slate-500"}>
                Réceptions en attente de confirmation
              </p>
            </div>
            <div className="rounded-[1.2rem] bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Receptions validees</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-800">{receptionSummary.validated}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-700">En instance</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-800">{receptionSummary.inInstance}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Receptions en attente</p>
                  <p className="mt-2 text-2xl font-semibold text-sky-800">{receptionSummary.pending}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Link
          to="/technicentre/reception/history"
          onMouseEnter={() => preloadRoute("/technicentre/reception/history")}
          onFocus={() => preloadRoute("/technicentre/reception/history")}
          className="btn-secondary"
        >
          Historique
        </Link>
      </section>

      <DossierFiltersBar
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
        metrics={[{ label: "Dossiers trouvés", value: receptions.length }]}
      />

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
              to={`/technicentre/reception/${notification.alert.id}`}
              state={{ returnTo: `/technicentre/reception${search ? `?${new URLSearchParams({ q: search }).toString()}` : ""}` }}
            />
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-sm text-slate-500">Aucune réception programmée pour ce technicentre.</div>
      )}
    </div>
  );
}
