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
import { getApiTimestamp } from "../utils/format";

export function TechnicentreDemandPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const search = searchParams.get("q") ?? "";

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

  const latestIterationByRoot = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of alerts) {
      const rootId = item.dossier_parent_id ?? item.id;
      const iteration = item.dossier_iteration ?? 0;
      const currentMax = map.get(rootId);
      if (currentMax === undefined || iteration > currentMax) {
        map.set(rootId, iteration);
      }
    }
    return map;
  }, [alerts]);

  const demandes = useMemo(
    () =>
      alerts
        .filter((item) => {
          if (item.status !== "A_MODIFIER") {
            return false;
          }
          const rootId = item.dossier_parent_id ?? item.id;
          const latestIteration = latestIterationByRoot.get(rootId) ?? 0;
          return (item.dossier_iteration ?? 0) >= latestIteration;
        })
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
    [alerts, latestIterationByRoot, search]
  );

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <PageBreadcrumbs items={[{ label: "Technicentre", to: "/technicentre" }, { label: "Demande" }]} />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Demande</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dossiers de demande</h2>
          <div className="mt-5 max-w-xs">
            <div className={demandes.length > 0 ? "metric-card permanent-alert-card" : "metric-card"}>
              <p className={demandes.length > 0 ? "text-xs uppercase tracking-[0.22em] text-rose-700" : "text-xs uppercase tracking-[0.22em] text-slate-400"}>
                Demandes à modifier
              </p>
              <p className={demandes.length > 0 ? "mt-3 text-3xl font-semibold text-rose-700" : "mt-3 text-3xl font-semibold text-slate-900"}>
                {demandes.length}
              </p>
              <p className={demandes.length > 0 ? "mt-2 text-sm text-rose-600" : "mt-2 text-sm text-slate-500"}>
                Demandes retournées par le permanent
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/technicentre/demande/history"
            onMouseEnter={() => preloadRoute("/technicentre/demande/history")}
            onFocus={() => preloadRoute("/technicentre/demande/history")}
            className="btn-secondary"
          >
            Historique
          </Link>
          <Link to="/technicentre/demande/create" className="btn-primary">
            Créer une demande
          </Link>
        </div>
      </section>

      <DossierFiltersBar
        searchValue={search}
        onSearchChange={(value) =>
          setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (value.trim()) {
              next.set("q", value);
            } else {
              next.delete("q");
            }
            return next;
          })
        }
        searchPlaceholder="Dossier, demandeur ou destinataire"
        metrics={[{ label: "Dossiers trouvés", value: demandes.length }]}
      />

      {demandes.length > 0 ? (
        <div className="space-y-4">
          {demandes.map((alert) => (
            <TechnicentreDossierRow
              key={alert.id}
              alert={alert}
              requesterLabel={requesterLabel}
              eventCount={alert.history.length}
              actionLabel="Ouvrir la demande"
              latestNote={alert.history.slice().reverse().find((item) => item.note?.trim())?.note}
              to={`/technicentre/alerts/${alert.id}`}
              state={{
                returnTo: `/technicentre/demande${search ? `?${new URLSearchParams({ q: search }).toString()}` : ""}`,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="panel p-8 text-sm text-slate-500">Aucune demande à modifier pour ce technicentre.</div>
      )}
    </div>
  );
}
