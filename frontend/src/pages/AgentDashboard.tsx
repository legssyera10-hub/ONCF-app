import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { AlertCard } from "../components/AlertCard";
import { AlertTimeline } from "../components/AlertTimeline";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { Alert } from "../types";
import { API_BASE_URL } from "../utils/api";
import { getPermanentDecisionReason } from "../utils/alertHistory";
import { parseApiDate } from "../utils/format";
import { getAlertStatusFilterOptions, isProcessingStatus, isReceivedStatus } from "../utils/status";

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

export function AgentDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const alertsContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedAlertRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    api.alerts(token, "?mine=true").then((result) => {
      setAlerts(result);
    });
  }, [token]);

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((item) => (selectedStatus !== "ALL" ? item.status === selectedStatus : true))
      .filter((item) => (selectedDate ? isSameLocalDate(item.created_at, selectedDate) : true))
      .filter((item) => {
        const query = search.trim().toLowerCase();
        if (!query) {
          return true;
        }

        const haystack = [
          item.material_ref,
          item.problem_description,
          item.station.name,
          item.created_by.full_name,
          item.requested_destination_establishment?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
  }, [alerts, selectedStatus, selectedDate, search]);

  useEffect(() => {
    const requestedAlertId = Number(searchParams.get("alert"));
    const requestedAlertExists = filteredAlerts.some((item) => item.id === requestedAlertId);
    const currentStillExists = filteredAlerts.some((item) => item.id === selected);

    if (requestedAlertExists) {
      setSelected(requestedAlertId);
      return;
    }

    if (!currentStillExists) {
      setSelected(filteredAlerts[0]?.id ?? null);
    }
  }, [filteredAlerts, searchParams, selected]);

  const current = filteredAlerts.find((item) => item.id === selected) ?? filteredAlerts[0];
  const permanentDecisionReason = current ? getPermanentDecisionReason(current) : undefined;
  const confirmedCount = alerts.filter((item) => isReceivedStatus(item.status)).length;
  const analysisCount = alerts.filter((item) => isProcessingStatus(item.status)).length;

  useEffect(() => {
    if (!selectedAlertRef.current || !alertsContainerRef.current) {
      return;
    }

    selectedAlertRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [current?.id]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Mes demandes d'acheminement</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{alerts.length}</p>
          <p className="mt-2 text-sm text-slate-500">Historique complet de mes signalements.</p>
        </div>
        <div className="metric-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">En cours de traitement</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{analysisCount}</p>
          <p className="mt-2 text-sm text-slate-500">Demandes en cours de traitement par le permanent.</p>
        </div>
        <div className="metric-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Réceptions confirmées</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{confirmedCount}</p>
          <p className="mt-2 text-sm text-slate-500">Acheminements aboutis côté destination.</p>
        </div>
      </section>

      <DossierFiltersBar
        dateValue={selectedDate}
        onDateClear={() => setSelectedDate("")}
        onDateEnable={() => setSelectedDate((current) => current || toLocalDateInput(new Date()))}
        onDateChange={setSelectedDate}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Référence, motif, site, destination ou créateur"
        statusValue={selectedStatus}
        statusOptions={getAlertStatusFilterOptions()}
        onStatusChange={setSelectedStatus}
        metrics={[{ label: "Dossiers trouvés", value: filteredAlerts.length }]}
      />

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="panel flex min-h-0 flex-col overflow-hidden self-start lg:sticky lg:top-6 lg:h-[calc(100vh-4rem)]">
          <div className="border-b border-slate-200 p-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Mes demandes d'acheminement</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredAlerts.length} demande(s) dans la vue courante</p>
            </div>
          </div>

          <div ref={alertsContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
            {filteredAlerts.length > 0 ? (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} ref={alert.id === current?.id ? selectedAlertRef : null}>
                    <AlertCard alert={alert} onSelect={setSelected} selected={alert.id === current?.id} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel p-6 text-sm text-slate-500">
                {selectedDate ? "Aucune demande créée à la date sélectionnée." : "Aucune demande disponible."}
              </div>
            )}
          </div>
        </section>

        <section className="panel p-6">
          {current ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Demande sélectionnée</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">{current.material_ref}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {current.station.name} - {current.material_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={current.status} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="metric-card">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Création</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{parseApiDate(current.created_at)?.toLocaleString() ?? "-"}</p>
                </div>
                <div className="metric-card">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">État maintenance</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">EXP {current.maintenance_state}</p>
                </div>
                <div className="metric-card">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Décision demandeur</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{current.agent_decision}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Diagnostic</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{current.problem_description}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Conditions initiales</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{current.transport_conditions_initial}</p>
                </div>
              </div>

              {current.status === "A_MODIFIER" || current.status === "MODIFIEE" || current.status === "ANNULEE" ? (
                <div
                  className={`rounded-[1.5rem] border p-5 ${
                    current.status === "ANNULEE"
                      ? "border-rose-200 bg-rose-50/90"
                      : current.status === "MODIFIEE"
                        ? "border-fuchsia-200 bg-fuchsia-50/90"
                        : "border-amber-200 bg-amber-50/90"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {current.status === "ANNULEE"
                      ? "Motif d'annulation"
                      : current.status === "MODIFIEE"
                        ? "Demande modifiée"
                        : "Demande de modification"}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{permanentDecisionReason ?? "-"}</p>
                  {current.status === "A_MODIFIER" ? (
                    <button
                      type="button"
                      className="btn-primary mt-4"
                      onClick={() => navigate(`/technicentre/alerts/${current.id}/edit`)}
                    >
                      Modifier la demande
                    </button>
                  ) : null}
                </div>
              ) : null}

              {current.revisions.length > 0 ? (
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Versions precedentes</p>
                  <div className="mt-4 space-y-3">
                    {current.revisions.map((revision) => (
                      <div key={revision.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">Version {revision.revision_number}</p>
                          <p className="text-xs text-slate-500">
                            {parseApiDate(revision.archived_at)?.toLocaleString() ?? revision.archived_at}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{revision.problem_description}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {revision.station.name} · {revision.material_ref} · {revision.requested_destination_establishment?.name ?? "-"}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">{revision.transport_conditions_initial}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {current.attachments.length > 0 ? (
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pièces jointes</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {current.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        className="btn-secondary"
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

              <div>
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Timeline</h3>
                <AlertTimeline history={current.history} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {selectedDate ? "Sélectionnez une date contenant au moins une demande." : "Aucune demande disponible."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
