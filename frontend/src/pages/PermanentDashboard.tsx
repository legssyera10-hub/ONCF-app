import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AlertCard } from "../components/AlertCard";
import { DossierFiltersBar } from "../components/DossierFiltersBar";
import { useAuth } from "../hooks/useAuth";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import type { Alert } from "../types";
import { buildAlertMaterialRows, parsePpmMaterialDecisions } from "../utils/alertMaterials";
import {
  getAlertStatusFilterOptions,
  isCancelledStatus,
  isModificationStatus,
  isProcessingStatus,
  isReceivedStatus,
  isValidatedStatus,
} from "../utils/status";
import { parseApiDate } from "../utils/format";

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

function hasPendingPpmMaterial(alert: Alert) {
  const materialRows = buildAlertMaterialRows(alert);
  const decisions = parsePpmMaterialDecisions(alert.permanent_decision?.material_decisions);
  return materialRows.some((row) => !decisions[row.index]?.ppm_status);
}

function isPermanentProcessingAlert(alert: Alert) {
  if (alert.status === "MODIFIEE" || alert.status === "ANNULEE") {
    return false;
  }
  return isProcessingStatus(alert.status) || hasPendingPpmMaterial(alert);
}

export function PermanentDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("EN_COURS_DE_TRAITEMENT");

  async function load() {
    if (!token) return;
    setAlerts(await api.alerts(token));
  }

  useEffect(() => {
    void load();
  }, [token]);

  useLiveAlerts(Boolean(token), load);

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((item) => {
        if (selectedStatus === "ALL") {
          return true;
        }
        if (selectedStatus === "EN_COURS_DE_TRAITEMENT") {
          return isPermanentProcessingAlert(item);
        }
        return item.status === selectedStatus;
      })
      .filter((item) => (selectedDate ? isSameLocalDate(item.created_at, selectedDate) : true))
      .filter((item) => {
        const query = search.trim().toLowerCase();
        if (!query) {
          return true;
        }

        const haystack = [
          item.dossier_label ?? item.dossier_number ?? item.id,
          item.created_by.full_name,
          item.requested_destination_establishment?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
  }, [alerts, selectedStatus, selectedDate, search]);

  const processingCount = alerts.filter(isPermanentProcessingAlert).length;
  const acceptedCount = alerts.filter(
    (item) => isValidatedStatus(item.status) || item.status === "RECEPTION_PARTIELLE" || isReceivedStatus(item.status)
  ).length;
  const cancellationCount = alerts.filter((item) => isCancelledStatus(item.status)).length;
  const aModifierCount = alerts.filter((item) => isModificationStatus(item.status)).length;
  const modifieeCount = alerts.filter((item) => item.status === "MODIFIEE").length;

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Permanent PPM</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Liste des demandes d'acheminements</h2>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
          <div className={processingCount > 0 ? "metric-card permanent-alert-card" : "metric-card"}>
            <p className={processingCount > 0 ? "text-xs uppercase tracking-[0.22em] text-rose-700" : "text-xs uppercase tracking-[0.22em] text-slate-400"}>
              En cours de traitement
            </p>
            <p className={processingCount > 0 ? "mt-3 text-3xl font-semibold text-rose-700" : "mt-3 text-3xl font-semibold text-slate-900"}>
              {processingCount}
            </p>
            <p className={processingCount > 0 ? "mt-2 text-sm text-rose-600" : "mt-2 text-sm text-slate-500"}>
              Demandes en attente d'instruction
            </p>
          </div>

          <div className="rounded-[1.2rem] bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Acceptee</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{acceptedCount}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Annulations</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{cancellationCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">A modifier</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{aModifierCount}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-700">Modifiee</p>
                <p className="mt-2 text-2xl font-semibold text-fuchsia-800">{modifieeCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DossierFiltersBar
        dateValue={selectedDate}
        onDateClear={() => setSelectedDate("")}
        onDateEnable={() => setSelectedDate((current) => current || toLocalDateInput(new Date()))}
        onDateChange={setSelectedDate}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Dossier, demandeur ou destinataire"
        statusValue={selectedStatus}
        statusOptions={getAlertStatusFilterOptions()}
        onStatusChange={setSelectedStatus}
        metrics={[{ label: "Dossiers trouvés", value: filteredAlerts.length }]}
      />

      <section className="space-y-4">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onSelect={() => navigate(`/permanent/dashboard/${alert.id}`)} />
          ))
        ) : (
          <div className="panel p-6 text-sm text-slate-500">Aucune demande pour le filtre courant.</div>
        )}
      </section>
    </div>
  );
}
