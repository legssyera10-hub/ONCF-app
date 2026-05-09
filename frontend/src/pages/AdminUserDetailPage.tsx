import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { AdminUserDetail, Alert, AlertStatus, Establishment, OnlineTrial, Role } from "../types";
import { formatDateTime } from "../utils/format";
import { getOnlineTrialCreatorLabel } from "../utils/onlineTrialCreator";

const roleOptions: Role[] = ["ADMIN", "PERMANENT", "ETABLISSEMENT", "PROJET", "SUIVI"];

type TransportRoleContext = "CREATED" | "RECEPTION" | "CREATED_AND_RECEPTION";

type HistoryGroup = {
  alertId: number;
  dossierLabel: string;
  lastTimestamp: string;
  lastAction: string;
  entryCount: number;
  status?: AlertStatus;
  origin?: string;
  destination?: string;
  problem?: string;
  roleContext?: TransportRoleContext;
};

type OnlineTrialGroup = {
  trialId: number;
  dossierLabel: string;
  lastTimestamp: string;
  entryCount: number;
  status: AlertStatus;
  creator: string;
  origin?: string;
  destination?: string;
  problem?: string;
};

type AdminModuleFilter = "ACHEMINEMENT" | "ESSAI";
type TransportSubFilter = "ALL" | "CREATED" | "RECEPTION";
type AdminUserDetailRestoreState = {
  path?: string;
  scrollY?: number;
  alertId?: number;
  trialId?: number;
  adminModuleFilter?: AdminModuleFilter;
  transportSubFilter?: TransportSubFilter;
};

function getHistoryTitle(role: Role) {
  if (role === "AGENT") return "Demandes d'acheminement creees";
  if (role === "PERMANENT") return "Demandes d'acheminement traitees";
  if (role === "ETABLISSEMENT") return "Demandes creees et receptions du technicentre";
  if (role === "PROJET") return "Demandes d'essai en ligne creees";
  if (role === "SUIVI") return "Demandes suivies par le compte de visionnement";
  return "Dossiers lies a ce compte";
}

function getRoleLabel(role: Role) {
  if (role === "AGENT") return "Technicentre";
  if (role === "PERMANENT") return "Permanent PPM";
  if (role === "ETABLISSEMENT") return "Technicentre";
  if (role === "PROJET") return "Projet";
  if (role === "SUIVI") return "Visionnement demandes";
  return "Admin";
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function formatExportDate(value?: string | null) {
  if (!value) return "";
  return `${formatDateTime(value)} UTC`;
}

function buildCsvSection(title: string, rows: Array<Array<unknown>>) {
  const header = `${title}\r\n`;
  const content = rows.map((row) => row.map((value) => escapeCsvCell(value)).join(";")).join("\r\n");
  return `${header}${content}`;
}

function downloadCsvDocument(filename: string, sections: Array<{ title: string; rows: Array<Array<unknown>> }>) {
  const csv = sections.map((section) => buildCsvSection(section.title, section.rows)).join("\r\n\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadBlobDocument(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function resolveTransportRoleContext(
  alert: Alert,
  userId: number,
  establishmentId: number | null | undefined,
): TransportRoleContext | undefined {
  const isCreated = alert.created_by.id === userId;
  const isReception =
    establishmentId != null && alert.permanent_decision?.destination_establishment?.id === establishmentId;

  if (isCreated && isReception) return "CREATED_AND_RECEPTION";
  if (isCreated) return "CREATED";
  if (isReception) return "RECEPTION";
  return undefined;
}

export function AdminUserDetailPage() {
  const { id } = useParams();
  const userId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const hasRestoredScroll = useRef(false);
  const hasInitializedExportRange = useRef(false);
  const hasInitializedTransportExportRange = useRef(false);
  const hasInitializedTrialExportRange = useRef(false);
  const restoreKey = "admin-user-detail-restore";
  const { token } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [availableAlerts, setAvailableAlerts] = useState<Alert[]>([]);
  const [availableOnlineTrials, setAvailableOnlineTrials] = useState<OnlineTrial[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [exportStartDate, setExportStartDate] = useState("2025-01-01");
  const [exportEndDate, setExportEndDate] = useState("2026-01-01");
  const [transportExportStartDate, setTransportExportStartDate] = useState("2025-01-01");
  const [transportExportEndDate, setTransportExportEndDate] = useState("2026-01-01");
  const [trialExportStartDate, setTrialExportStartDate] = useState("2025-01-01");
  const [trialExportEndDate, setTrialExportEndDate] = useState("2026-01-01");
  const [adminModuleFilter, setAdminModuleFilter] = useState<AdminModuleFilter>("ACHEMINEMENT");
  const [transportSubFilter, setTransportSubFilter] = useState<TransportSubFilter>("ALL");
  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "ETABLISSEMENT" as Role,
    outlook_email: "",
    establishment_id: "",
    password: "",
  });
  const [editEstablishmentForm, setEditEstablishmentForm] = useState({
    name: "",
    city: "",
    code: "",
    outlook_email: "",
  });

  async function loadDetail() {
    if (!token || Number.isNaN(userId)) return;
    const [result, establishmentList, alerts, onlineTrials] = await Promise.all([
      api.adminUserDetail(token, userId),
      api.establishments(token),
      api.alerts(token),
      api.onlineTrials(token),
    ]);
    setDetail(result);
    setEstablishments(establishmentList);
    setAvailableAlerts(
      [...alerts].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      ),
    );
    setAvailableOnlineTrials(
      [...onlineTrials].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime(),
      ),
    );
    setEditForm({
      full_name: result.user.full_name,
      role: result.user.role,
      outlook_email: result.user.outlook_email ?? "",
      establishment_id: result.user.establishment_id ? String(result.user.establishment_id) : "",
      password: "",
    });
  }

  useEffect(() => {
    loadDetail().catch((err) => setError(err instanceof Error ? err.message : "Erreur detail compte"));
  }, [token, userId]);

  const selectedEstablishment =
    detail?.user.establishment_id != null
      ? establishments.find((item) => item.id === detail.user.establishment_id) ?? null
      : null;

  useEffect(() => {
    if (!selectedEstablishment) return;
    setEditEstablishmentForm({
      name: selectedEstablishment.name,
      city: selectedEstablishment.city,
      code: selectedEstablishment.code,
      outlook_email: selectedEstablishment.outlook_email ?? "",
    });
  }, [selectedEstablishment]);

  const historyGroups = useMemo<HistoryGroup[]>(() => {
    if (!detail) return [];

    const alertById = new Map(availableAlerts.map((alert) => [alert.id, alert]));

    if (detail.user.role === "SUIVI") {
      return availableAlerts.map((alert) => ({
        alertId: alert.id,
        dossierLabel: alert.dossier_label ?? String(alert.id),
        lastTimestamp: alert.updated_at ?? alert.created_at,
        lastAction: alert.status,
        entryCount: alert.history.length,
        status: alert.status,
        origin: alert.station.name,
        destination: alert.permanent_decision?.destination_establishment?.name ?? "Non definie",
        problem: alert.problem_description,
      }));
    }

    const groups = new Map<number, HistoryGroup>();
    for (const item of detail.history) {
      if (!item.alert_id) continue;
      const existing = groups.get(item.alert_id);
      if (!existing) {
        const linkedAlert = alertById.get(item.alert_id);
        if (!linkedAlert) {
          continue;
        }
        groups.set(item.alert_id, {
          alertId: item.alert_id,
          dossierLabel: linkedAlert.dossier_label ?? String(linkedAlert.id),
          lastTimestamp: item.timestamp,
          lastAction: item.action,
          entryCount: 1,
          status: linkedAlert.status,
          origin: linkedAlert.station.name,
          destination: linkedAlert.permanent_decision?.destination_establishment?.name ?? "Non definie",
          problem: linkedAlert.problem_description,
        });
      } else {
        existing.entryCount += 1;
        if (new Date(item.timestamp).getTime() > new Date(existing.lastTimestamp).getTime()) {
          existing.lastTimestamp = item.timestamp;
          existing.lastAction = item.action;
        }
      }
    }
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
    );
  }, [detail, availableAlerts]);

  const transportGroups = useMemo<HistoryGroup[]>(() => {
    if (!detail) return [];
    if (detail.user.role !== "ETABLISSEMENT") return historyGroups;

    const establishmentId = detail.user.establishment_id;
    const relevantAlerts = availableAlerts.filter((alert) => {
      const roleContext = resolveTransportRoleContext(alert, detail.user.id, establishmentId);
      return roleContext !== undefined;
    });

    return relevantAlerts.map((alert) => ({
      alertId: alert.id,
      dossierLabel: alert.dossier_label ?? String(alert.id),
      lastTimestamp: alert.updated_at ?? alert.created_at,
      lastAction: alert.status,
      entryCount: alert.history.length,
      status: alert.status,
      origin: alert.station.name,
      destination: alert.permanent_decision?.destination_establishment?.name ?? "Non definie",
      problem: alert.problem_description,
      roleContext: resolveTransportRoleContext(alert, detail.user.id, establishmentId),
    }));
  }, [detail, availableAlerts, historyGroups]);

  const filteredTransportGroups = useMemo<HistoryGroup[]>(() => {
    if (transportSubFilter === "ALL") return transportGroups;
    if (transportSubFilter === "CREATED") {
      return transportGroups.filter(
        (group) => group.roleContext === "CREATED" || group.roleContext === "CREATED_AND_RECEPTION",
      );
    }
    return transportGroups.filter(
      (group) => group.roleContext === "RECEPTION" || group.roleContext === "CREATED_AND_RECEPTION",
    );
  }, [transportGroups, transportSubFilter]);

  const onlineTrialGroups = useMemo<OnlineTrialGroup[]>(() => {
    if (!detail || detail.user.role !== "ETABLISSEMENT") return [];

    return availableOnlineTrials
      .filter((trial) => trial.created_by.id === detail.user.id)
      .map((trial) => ({
        trialId: trial.id,
        dossierLabel: trial.dossier_label ?? String(trial.id),
        lastTimestamp: trial.updated_at ?? trial.created_at,
        entryCount: trial.history.length,
        status: trial.status,
        creator: getOnlineTrialCreatorLabel(trial),
        origin: trial.departure_station?.name ?? trial.station.name ?? "-",
        destination: trial.arrival_station?.name ?? "-",
        problem: trial.problem_description,
      }));
  }, [detail, availableOnlineTrials]);

  const exportAlerts = useMemo(() => {
    if (!detail) return [] as Alert[];
    if (detail.user.role === "SUIVI") return availableAlerts;

    const relevantAlertIds = new Set(
      (detail.user.role === "ETABLISSEMENT" ? filteredTransportGroups : historyGroups).map((group) => group.alertId),
    );
    return availableAlerts.filter((alert) => relevantAlertIds.has(alert.id));
  }, [detail, availableAlerts, historyGroups, filteredTransportGroups]);

  const exportOnlineTrials = useMemo(() => {
    if (!detail || detail.user.role !== "ETABLISSEMENT") return [] as OnlineTrial[];

    const relevantTrialIds = new Set(onlineTrialGroups.map((group) => group.trialId));
    return availableOnlineTrials.filter((trial) => relevantTrialIds.has(trial.id));
  }, [detail, availableOnlineTrials, onlineTrialGroups]);

  useEffect(() => {
    if (!detail) return;
    if (detail.user.role === "ETABLISSEMENT") return;
    if (hasInitializedExportRange.current) return;
    if (exportAlerts.length === 0) return;

    const sortedByCreation = [...exportAlerts].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const firstDate = sortedByCreation[0].created_at.slice(0, 10);
    const lastDate = sortedByCreation[sortedByCreation.length - 1].created_at.slice(0, 10);

    setExportStartDate(firstDate);
    setExportEndDate(lastDate);
    hasInitializedExportRange.current = true;
  }, [detail, exportAlerts]);

  useEffect(() => {
    if (!detail || detail.user.role !== "ETABLISSEMENT") return;
    if (hasInitializedTransportExportRange.current) return;
    if (exportAlerts.length === 0) return;

    const sortedByCreation = [...exportAlerts].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const firstDate = sortedByCreation[0].created_at.slice(0, 10);
    const lastDate = sortedByCreation[sortedByCreation.length - 1].created_at.slice(0, 10);
    setTransportExportStartDate(firstDate);
    setTransportExportEndDate(lastDate);
    hasInitializedTransportExportRange.current = true;
  }, [detail, exportAlerts]);

  useEffect(() => {
    if (!detail || detail.user.role !== "ETABLISSEMENT") return;
    if (hasInitializedTrialExportRange.current) return;
    if (exportOnlineTrials.length === 0) return;

    const sortedByCreation = [...exportOnlineTrials].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const firstDate = sortedByCreation[0].created_at.slice(0, 10);
    const lastDate = sortedByCreation[sortedByCreation.length - 1].created_at.slice(0, 10);
    setTrialExportStartDate(firstDate);
    setTrialExportEndDate(lastDate);
    hasInitializedTrialExportRange.current = true;
  }, [detail, exportOnlineTrials]);

  useLayoutEffect(() => {
    if (hasRestoredScroll.current) return;
    if (!detail) return;

    const savedState = sessionStorage.getItem(restoreKey);
    if (!savedState) return;

    try {
      const parsed = JSON.parse(savedState) as AdminUserDetailRestoreState;
      if (parsed.path !== location.pathname) return;

      if (parsed.adminModuleFilter) {
        setAdminModuleFilter(parsed.adminModuleFilter);
      }
      if (parsed.transportSubFilter) {
        setTransportSubFilter(parsed.transportSubFilter);
      }

      hasRestoredScroll.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof parsed.alertId === "number") {
            const target = document.getElementById(`admin-alert-row-${parsed.alertId}`);
            if (target) {
              target.scrollIntoView({ block: "center", behavior: "auto" });
            } else if (typeof parsed.scrollY === "number") {
              window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
            }
          } else if (typeof parsed.trialId === "number") {
            const target = document.getElementById(`admin-trial-row-${parsed.trialId}`);
            if (target) {
              target.scrollIntoView({ block: "center", behavior: "auto" });
            } else if (typeof parsed.scrollY === "number") {
              window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
            }
          } else if (typeof parsed.scrollY === "number") {
            window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
          }

          sessionStorage.removeItem(restoreKey);
        });
      });
    } catch {
      sessionStorage.removeItem(restoreKey);
    }
  }, [detail, location.pathname]);

  async function handleGenericExport() {
    if (!token || !detail) return;
    try {
      setError("");
      setMessage("");
      if (detail.user.role === "SUIVI") {
        const startDate = new Date(`${exportStartDate}T00:00:00`);
        const endDate = new Date(`${exportEndDate}T23:59:59`);
        const filteredAlerts = exportAlerts.filter((alert) => {
          const createdAt = new Date(alert.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        });

        const alertRows: Array<Array<unknown>> = [
          [
            "Compte",
            "ID demande",
            "Date creation",
            "Gare",
            "Type materiel",
            "Reference",
            "Probleme",
            "Etat maintenance",
            "Gravite",
            "Decision demandeur",
            "Statut courant",
            "Conditions initiales",
            "Etablissement destinataire",
            "Reception confirmee",
            "Pieces jointes",
          ],
          ...filteredAlerts.map((alert) => [
            detail.user.username,
            alert.id,
            formatExportDate(alert.created_at),
            alert.station.name,
            alert.material_type,
            alert.material_ref,
            alert.problem_description,
            alert.maintenance_state,
            alert.severity,
            alert.agent_decision,
            alert.status,
            alert.transport_conditions_initial,
            alert.permanent_decision?.destination_establishment?.name ?? "",
            formatExportDate(alert.establishment_confirmation?.reception_date),
            alert.attachments.map((attachment) => attachment.filename).join(", "),
          ]),
        ];

        const historyRows: Array<Array<unknown>> = [
          ["ID demande", "Date", "Statut", "Auteur", "Note"],
          ...filteredAlerts.flatMap((alert) =>
            alert.history.map((item) => [
              alert.id,
              formatExportDate(item.changed_at),
              item.status,
              item.changed_by?.full_name ?? "Systeme",
              item.note ?? "",
            ]),
          ),
        ];

        downloadCsvDocument(`${detail.user.username}_${exportStartDate}_au_${exportEndDate}.csv`, [
          { title: "Demandes d'acheminement", rows: alertRows },
          { title: "Historique", rows: historyRows },
        ]);
        setMessage("Fichier Excel genere");
        return;
      }

      const params = new URLSearchParams({ start_date: exportStartDate, end_date: exportEndDate });
      const blob = await api.exportAdminUser(token, userId, `?${params.toString()}`);
      downloadBlobDocument(blob, `${detail.user.username}_${exportStartDate}_au_${exportEndDate}.xlsx`);
      setMessage("Fichier Excel genere");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur export excel");
    }
  }

  async function handleTransportExport() {
    if (!token || !detail) return;
    try {
      setError("");
      setMessage("");
      const params = new URLSearchParams({
        start_date: transportExportStartDate,
        end_date: transportExportEndDate,
      });
      if (transportSubFilter === "CREATED") {
        params.set("transport_scope", "created");
      } else if (transportSubFilter === "RECEPTION") {
        params.set("transport_scope", "reception");
      }
      const blob = await api.exportAdminUser(token, userId, `?${params.toString()}`);
      downloadBlobDocument(
        blob,
        `${detail.user.username}_demandes_acheminement_${transportExportStartDate}_au_${transportExportEndDate}.xlsx`,
      );
      setMessage("Fichier Excel des demandes d'acheminement genere");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur export excel acheminement");
    }
  }

  async function handleOnlineTrialExport() {
    if (!token || !detail) return;
    try {
      setError("");
      setMessage("");
      const params = new URLSearchParams({
        start_date: trialExportStartDate,
        end_date: trialExportEndDate,
      });
      const blob = await api.exportAdminUserOnlineTrials(token, userId, `?${params.toString()}`);
      downloadBlobDocument(
        blob,
        `${detail.user.username}_dossiers_essais_en_ligne_${trialExportStartDate}_au_${trialExportEndDate}.xlsx`,
      );
      setMessage("Fichier Excel des essais en ligne genere");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur export excel essais en ligne");
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    const dashboardRestore = sessionStorage.getItem("admin-dashboard-restore");
    if (dashboardRestore) {
      try {
        const parsed = JSON.parse(dashboardRestore) as { path?: string };
        if (parsed.path) {
          navigate(parsed.path);
          return;
        }
      } catch {
        // ignore and fallback below
      }
    }

    navigate("/admin/accounts");
  }

  if (Number.isNaN(userId)) {
    return <div className="panel p-6 text-sm text-rose-600">Identifiant de compte invalide.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-200 hover:bg-brand-50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
              <path d="M21 12H9" />
            </svg>
            Retour
          </button>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {detail ? detail.user.full_name : "Chargement du compte..."}
          </h2>
          {detail ? (
            <p className="mt-1 text-sm text-slate-500">
              {detail.user.username} - {getRoleLabel(detail.user.role)} - Cree le {formatDateTime(detail.user.created_at)}
            </p>
          ) : null}
        </div>
      </div>

      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}

      {detail ? (
        <>
          <div className="panel p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                className="space-y-3 rounded-2xl bg-slate-50 p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!token) return;
                  try {
                    setError("");
                    setMessage("");
                    await api.updateAdminUser(token, userId, {
                      full_name: editForm.full_name,
                      role: editForm.role,
                      outlook_email: editForm.outlook_email || null,
                      establishment_id: editForm.role === "ETABLISSEMENT" ? Number(editForm.establishment_id) : null,
                    });
                    setMessage("Compte mis a jour");
                    await loadDetail();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur mise a jour");
                  }
                }}
              >
                <h3 className="text-lg font-semibold text-slate-950">Modifier le compte</h3>
                <input className="input" value={editForm.full_name} onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                <input className="input" type="email" placeholder="Adresse email" value={editForm.outlook_email} onChange={(e) => setEditForm((prev) => ({ ...prev, outlook_email: e.target.value }))} />
                <select className="input" value={editForm.role} onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as Role, establishment_id: "" }))}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{getRoleLabel(role)}</option>
                  ))}
                </select>
                {editForm.role === "ETABLISSEMENT" ? (
                  <select className="input" value={editForm.establishment_id} onChange={(e) => setEditForm((prev) => ({ ...prev, establishment_id: e.target.value }))}>
                    <option value="">Choisir un etablissement</option>
                    {establishments.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                ) : null}
                <button className="btn-primary" type="submit">Enregistrer les modifications</button>
              </form>

              <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!token || !editForm.password) return;
                    try {
                      setError("");
                      setMessage("");
                      await api.updateAdminPassword(token, userId, { password: editForm.password });
                      setEditForm((prev) => ({ ...prev, password: "" }));
                      setMessage("Mot de passe mis a jour");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur mot de passe");
                    }
                  }}
                >
                  <h3 className="text-lg font-semibold text-slate-950">Changer le mot de passe</h3>
                  <input className="input" type="password" placeholder="Nouveau mot de passe" value={editForm.password} onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))} />
                  <button className="btn-secondary" type="submit">Mettre a jour le mot de passe</button>
                </form>

                <div className="space-y-3 border-t border-slate-200 pt-4">
                  {detail.user.role !== "ADMIN" && detail.user.role !== "ETABLISSEMENT" ? (
                    <>
                      <h3 className="text-lg font-semibold text-slate-950">Generer un fichier Excel</h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input className="input" type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                        <input className="input" type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                      </div>
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          void handleGenericExport();
                        }}
                      >
                        Generer Excel
                      </button>
                    </>
                  ) : null}
                  <button
                    className="btn bg-rose-600 text-white hover:bg-rose-700"
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      try {
                        setError("");
                        setMessage("");
                        await api.deleteAdminUser(token, userId);
                        navigate("/admin/dashboard");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Erreur suppression");
                      }
                    }}
                  >
                    Supprimer le compte
                  </button>
                </div>
              </div>
            </div>

            {detail.user.role === "ETABLISSEMENT" && selectedEstablishment ? (
              <form
                className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!token) return;
                  try {
                    setError("");
                    setMessage("");
                    if (!editEstablishmentForm.name || !editEstablishmentForm.city) {
                      throw new Error("Renseignez le nom et la ville de l'etablissement");
                    }
                    await api.updateAdminEstablishment(token, selectedEstablishment.id, {
                      name: editEstablishmentForm.name,
                      city: editEstablishmentForm.city,
                      code: editEstablishmentForm.code || null,
                      outlook_email: editEstablishmentForm.outlook_email || null,
                      lat: selectedEstablishment.lat ?? 0,
                      lon: selectedEstablishment.lon ?? 0,
                    });
                    setMessage("Etablissement mis a jour");
                    await loadDetail();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur mise a jour etablissement");
                  }
                }}
              >
                <h3 className="text-lg font-semibold text-slate-950">Modifier l'etablissement</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <input className="input" placeholder="Nom de l'etablissement" value={editEstablishmentForm.name} onChange={(e) => setEditEstablishmentForm((prev) => ({ ...prev, name: e.target.value }))} />
                  <input className="input" placeholder="Ville" value={editEstablishmentForm.city} onChange={(e) => setEditEstablishmentForm((prev) => ({ ...prev, city: e.target.value }))} />
                  <input className="input" placeholder="Code" value={editEstablishmentForm.code} onChange={(e) => setEditEstablishmentForm((prev) => ({ ...prev, code: e.target.value }))} />
                </div>
                <input className="input" type="email" placeholder="Adresse email" value={editEstablishmentForm.outlook_email} onChange={(e) => setEditEstablishmentForm((prev) => ({ ...prev, outlook_email: e.target.value }))} />
                <button className="btn-primary" type="submit">Mettre a jour l'etablissement</button>
              </form>
            ) : null}
          </div>

          {detail.user.role === "ETABLISSEMENT" ? (
            <div className="space-y-6">
              <div className="panel p-6">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Filtres dossiers</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select
                        className="input min-w-[16rem]"
                        value={adminModuleFilter}
                        onChange={(e) => setAdminModuleFilter(e.target.value as AdminModuleFilter)}
                      >
                        <option value="ACHEMINEMENT">Demandes d'acheminement</option>
                        <option value="ESSAI">Dossiers des essais en ligne</option>
                      </select>
                      {adminModuleFilter === "ACHEMINEMENT" ? (
                        <select
                          className="input min-w-[16rem]"
                          value={transportSubFilter}
                          onChange={(e) => setTransportSubFilter(e.target.value as TransportSubFilter)}
                        >
                          <option value="ALL">Tous les dossiers</option>
                          <option value="CREATED">Demandes creees</option>
                          <option value="RECEPTION">Receptions</option>
                        </select>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {adminModuleFilter === "ACHEMINEMENT" ? (
                      <>
                        <input className="input" type="date" value={transportExportStartDate} onChange={(e) => setTransportExportStartDate(e.target.value)} />
                        <input className="input" type="date" value={transportExportEndDate} onChange={(e) => setTransportExportEndDate(e.target.value)} />
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => {
                            void handleTransportExport();
                          }}
                        >
                          Generer Excel
                        </button>
                      </>
                    ) : (
                      <>
                        <input className="input" type="date" value={trialExportStartDate} onChange={(e) => setTrialExportStartDate(e.target.value)} />
                        <input className="input" type="date" value={trialExportEndDate} onChange={(e) => setTrialExportEndDate(e.target.value)} />
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => {
                            void handleOnlineTrialExport();
                          }}
                        >
                          Generer Excel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {adminModuleFilter === "ACHEMINEMENT" ? (
                  <>
                    <div className="mb-4 text-sm text-slate-500">{filteredTransportGroups.length} dossier(s)</div>
                    {filteredTransportGroups.length === 0 ? (
                      <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                        Aucun dossier d'acheminement a afficher.
                      </div>
                    ) : (
                      <div className="mx-auto max-w-6xl space-y-3">
                        {filteredTransportGroups.map((group) => (
                          <button
                            key={group.alertId}
                            id={`admin-alert-row-${group.alertId}`}
                            type="button"
                            onClick={() => {
                              sessionStorage.setItem(
                                restoreKey,
                                JSON.stringify({
                                  path: location.pathname,
                                  scrollY: window.scrollY,
                                  alertId: group.alertId,
                                  adminModuleFilter,
                                  transportSubFilter,
                                }),
                              );
                              navigate(`/admin/users/${userId}/alerts/${group.alertId}`);
                            }}
                            className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-slate-50"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-lg font-semibold text-slate-950">Dossier #{group.dossierLabel}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                  <p className="font-medium text-slate-700">
                                    {group.origin ?? "-"}
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 20 20"
                                      className="mx-2 inline h-4 w-4 text-brand-600"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 10h14" />
                                      <path d="m11 4 6 6-6 6" />
                                    </svg>
                                    {group.destination ?? "-"}
                                  </p>
                                  <p>
                                    <span className="font-medium text-slate-700">Motif:</span> {group.problem ?? "-"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <span>{formatDateTime(group.lastTimestamp)}</span>
                                {group.status ? <StatusBadge status={group.status} /> : <p className="text-sm text-slate-600">{group.lastAction}</p>}
                                <span className="font-semibold text-brand-700">Ouvrir la demande</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-4 text-sm text-slate-500">{onlineTrialGroups.length} dossier(s)</div>
                    {onlineTrialGroups.length === 0 ? (
                      <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                        Aucun dossier d'essai en ligne a afficher.
                      </div>
                    ) : (
                      <div className="mx-auto max-w-6xl space-y-3">
                        {onlineTrialGroups.map((group) => (
                          <button
                            key={group.trialId}
                            id={`admin-trial-row-${group.trialId}`}
                            type="button"
                            onClick={() => {
                              sessionStorage.setItem(
                                restoreKey,
                                JSON.stringify({
                                  path: location.pathname,
                                  scrollY: window.scrollY,
                                  trialId: group.trialId,
                                  adminModuleFilter,
                                  transportSubFilter,
                                }),
                              );
                              navigate(`/admin/users/${userId}/online-trials/${group.trialId}`);
                            }}
                            className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-slate-50"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-lg font-semibold text-slate-950">Dossier essai #{group.dossierLabel}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                  <p className="font-medium text-slate-700">
                                    {group.origin ?? "-"}
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 20 20"
                                      className="mx-2 inline h-4 w-4 text-brand-600"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 10h14" />
                                      <path d="m11 4 6 6-6 6" />
                                    </svg>
                                    {group.destination ?? "-"}
                                  </p>
                                  <p>
                                    <span className="font-medium text-slate-700">Createur:</span> {group.creator}
                                  </p>
                                  <p>
                                    <span className="font-medium text-slate-700">Motif:</span> {group.problem ?? "-"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <span>{formatDateTime(group.lastTimestamp)}</span>
                                <StatusBadge status={group.status} />
                                <span className="font-semibold text-brand-700">Ouvrir la demande</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}

          {detail.user.role !== "ADMIN" && detail.user.role !== "ETABLISSEMENT" ? (
            <div className="panel p-6">
              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{getHistoryTitle(detail.user.role)}</h3>
                </div>
                <div className="text-sm text-slate-500">{historyGroups.length} dossier(s)</div>
              </div>

              {historyGroups.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  Aucun dossier a afficher.
                </div>
              ) : (
                <div className="mx-auto max-w-6xl space-y-3">
                  {historyGroups.map((group) => (
                    <button
                      key={group.alertId}
                      id={`admin-alert-row-${group.alertId}`}
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem(
                          restoreKey,
                          JSON.stringify({
                            path: location.pathname,
                            scrollY: window.scrollY,
                            alertId: group.alertId,
                          }),
                        );
                        navigate(`/admin/users/${userId}/alerts/${group.alertId}`);
                      }}
                      className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-950">Dossier #{group.dossierLabel}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                            <p className="font-medium text-slate-700">
                              {group.origin ?? "-"}
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                className="mx-2 inline h-4 w-4 text-brand-600"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 10h14" />
                                <path d="m11 4 6 6-6 6" />
                              </svg>
                              {group.destination ?? "-"}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Motif:</span> {group.problem ?? "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span>{formatDateTime(group.lastTimestamp)}</span>
                          {group.status ? <StatusBadge status={group.status} /> : <p className="text-sm text-slate-600">{group.lastAction}</p>}
                          <span className="font-semibold text-brand-700">Ouvrir la demande</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="panel p-6 text-sm text-slate-500">Chargement du detail du compte...</div>
      )}
    </div>
  );
}
