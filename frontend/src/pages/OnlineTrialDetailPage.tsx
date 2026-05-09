import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { OnlineTrial } from "../types";
import { API_BASE_URL } from "../utils/api";
import { parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { getOnlineTrialDirectionTitleSuffix, getOnlineTrialParcoursLabel } from "../utils/onlineTrialDirection";
import { formatDateTime, formatDelayMinutes, parseApiDate, toLocalInputDateTime } from "../utils/format";
import {
  buildOnlineTrialMaterialRows,
  parseOnlineTrialProgress,
  type OnlineTrialProgressEntry,
} from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";
import { getOnlineTrialCreatorLabel } from "../utils/onlineTrialCreator";

type TrialResultValue = "CONCLUANT" | "NON_CONCLUANT";

type GlobalProgressDraft = {
  performed: boolean;
  result: TrialResultValue;
  realizationDate: string;
  remarks: string;
};

const DEFAULT_PROGRESS_DRAFT: GlobalProgressDraft = {
  performed: false,
  result: "CONCLUANT",
  realizationDate: "",
  remarks: "",
};

function inferTrialResult(entry?: OnlineTrialProgressEntry): TrialResultValue {
  if (entry?.result === "CONCLUANT" || entry?.result === "NON_CONCLUANT") {
    return entry.result;
  }
  return (entry?.remarks ?? "").trim().length > 0 ? "NON_CONCLUANT" : "CONCLUANT";
}

function getTrialResultLabel(entry?: OnlineTrialProgressEntry): string {
  if (!entry?.performed) {
    return "-";
  }
  return inferTrialResult(entry) === "NON_CONCLUANT" ? "Non Concluant" : "Concluant";
}

function getTrialDelayDisplay(entry: OnlineTrialProgressEntry | undefined, departureDate: string | null | undefined): string {
  const departure = parseApiDate(departureDate);
  if (!departure) {
    return "-";
  }

  const referenceDate = entry?.performed ? parseApiDate(entry.realization_date) : new Date();
  if (!referenceDate) {
    return "-";
  }

  const rawMinutes = Math.floor((referenceDate.getTime() - departure.getTime()) / 60000);
  const minutes = entry?.performed ? rawMinutes : Math.max(0, rawMinutes);
  const formattedDelay = formatDelayMinutes(minutes);
  return entry?.performed ? formattedDelay : `${formattedDelay} (en cours)`;
}

function getDisplayedPpmStatus(
  trialStatus: OnlineTrial["status"],
  rowPpmStatus?: "ACCEPTEE" | "ANNULEE" | "MODIFIEE" | null
): string {
  if (trialStatus === "A_MODIFIER") return "A modifier";
  if (trialStatus === "ANNULEE") return "Annulee";
  if (trialStatus === "MODIFIEE") return "Modifiee";

  if (rowPpmStatus === "ACCEPTEE") return "Acceptee";
  if (rowPpmStatus === "ANNULEE") return "Annulee";
  if (rowPpmStatus === "MODIFIEE") return "Modifiee";

  return "En attente";
}

function getDisplayedPpmStatusClass(ppmStatus: string): string {
  if (ppmStatus === "Acceptee") return "font-semibold text-emerald-700";
  if (ppmStatus === "Annulee") return "font-semibold text-rose-700";
  if (ppmStatus === "A modifier") return "font-semibold text-amber-700";
  if (ppmStatus === "Modifiee") return "font-semibold text-violet-700";
  return "text-slate-700";
}

function getScope(pathname: string) {
  if (pathname.startsWith("/admin/")) {
    return { base: "", label: "Administration" };
  }
  if (pathname.startsWith("/projet/")) {
    return { base: "/projet/essais", label: "Projet" };
  }
  return { base: "/essais", label: "Technicentre" };
}

export function OnlineTrialDetailPage() {
  const { token, user } = useAuth();
  const { id, userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const scope = getScope(location.pathname);
  const [trial, setTrial] = useState<OnlineTrial | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [progressDraft, setProgressDraft] = useState<GlobalProgressDraft>(DEFAULT_PROGRESS_DRAFT);

  async function load() {
    if (!token || !id) return;
    try {
      setError("");
      const result = await api.onlineTrialById(token, Number(id));
      setTrial(result);
      const parsedProgress = parseOnlineTrialProgress(result.trial_material_progress);
      const rows = buildOnlineTrialMaterialRows(result);
      const decisions = parsePpmMaterialDecisions(result.permanent_decision?.material_decisions);
      const accepted = rows.map((row) => row.index).filter((index) => decisions[index]?.ppm_status === "ACCEPTEE");
      const indexesToRead = accepted.length > 0 ? accepted : rows.map((row) => row.index);
      const entries = indexesToRead.map((index) => parsedProgress[index]).filter((entry) => entry != null);

      const allPerformed = entries.length > 0 ? entries.every((entry) => Boolean(entry?.performed)) : false;
      const firstWithDate = entries.find((entry) =>
        Boolean(entry?.realization_date ?? entry?.return_date ?? entry?.departure_date)
      );
      const firstWithRemarks = entries.find((entry) => (entry?.remarks ?? "").trim().length > 0);
      const firstWithResult = entries.find((entry) => Boolean(entry?.performed)) ?? entries[0];

      setProgressDraft({
        performed: allPerformed,
        result: inferTrialResult(firstWithResult),
        realizationDate: toLocalInputDateTime(
          firstWithDate?.realization_date ?? firstWithDate?.return_date ?? firstWithDate?.departure_date ?? null
        ),
        remarks: firstWithRemarks?.remarks ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement du dossier");
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  const materialRows = useMemo(() => (trial ? buildOnlineTrialMaterialRows(trial) : []), [trial]);
  const pmDecisions = useMemo(
    () => parsePpmMaterialDecisions(trial?.permanent_decision?.material_decisions),
    [trial?.permanent_decision?.material_decisions]
  );
  const progress = useMemo(() => parseOnlineTrialProgress(trial?.trial_material_progress), [trial?.trial_material_progress]);
  const trialResultSummary = useMemo(() => {
    const performedEntries = materialRows
      .map((row) => progress[row.index])
      .filter((entry): entry is OnlineTrialProgressEntry => Boolean(entry?.performed));

    if (performedEntries.length === 0) {
      return {
        value: null as "CONCLUANT" | "NON_CONCLUANT" | null,
        label: "-",
        observation: "",
      };
    }

    const nonConcludingEntries = performedEntries.filter((entry) => inferTrialResult(entry) === "NON_CONCLUANT");
    if (nonConcludingEntries.length === 0) {
      return {
        value: "CONCLUANT" as const,
        label: "Concluant",
        observation: "",
      };
    }

    const uniqueObservations = nonConcludingEntries
      .map((entry) => (entry.remarks ?? "").trim())
      .filter((remark, index, all) => remark.length > 0 && all.indexOf(remark) === index);

    return {
      value: "NON_CONCLUANT" as const,
      label: "Non concluant",
      observation: uniqueObservations.length > 0 ? uniqueObservations.join(" | ") : "-",
    };
  }, [materialRows, progress]);

  const acceptedIndexes = useMemo(
    () => materialRows.map((row) => row.index).filter((index) => pmDecisions[index]?.ppm_status === "ACCEPTEE"),
    [materialRows, pmDecisions]
  );
  const globalCancelOrModifyReason = useMemo(() => {
    if (!trial) return "";
    const historyReason =
      [...trial.history]
        .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
        .find((item) => (item.status === "ANNULEE" || item.status === "A_MODIFIER") && (item.note || "").trim())?.note
        ?.trim() ?? "";
    return historyReason || trial.permanent_decision?.comment?.trim() || "";
  }, [trial]);

  if (!trial && error) {
    return <div className="panel border border-rose-200 p-6 text-sm text-rose-600">{error}</div>;
  }
  if (!trial) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement du dossier d'essai...</div>;
  }

  const routeFrom = trial.departure_station?.name ?? trial.station.name ?? "-";
  const routeTo = trial.arrival_station?.name ?? "-";
  const creatorLabel = getOnlineTrialCreatorLabel(trial);
  const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
  const directionSuffix = getOnlineTrialDirectionTitleSuffix(trial);
  const parcoursLabel = getOnlineTrialParcoursLabel(trial);
  const isAdmin = user?.role === "ADMIN";
  const canEditTrial = trial.status === "A_MODIFIER" && user?.role !== "ADMIN";
  const canShowDecisionAndFollowup = trial.status === "TRAITEE_PAR_PM";

  function handleAdminBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (userId && !Number.isNaN(Number(userId))) {
      navigate(`/admin/users/${userId}`);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {isAdmin ? (
            <button
              type="button"
              onClick={handleAdminBack}
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
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {canEditTrial ? (
            <>
              <span className="btn-secondary cursor-not-allowed opacity-70">Modification disponible apres demande PPM</span>
              <Link to={`${scope.base}/${trial.id}/edit`} className="btn-primary">
                Modifier la demande
              </Link>
            </>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              disabled={deleting}
              className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!token || deleting) return;
                if (!window.confirm(`Supprimer definitivement le dossier essai #${dossierLabel} ?`)) {
                  return;
                }
                try {
                  setDeleting(true);
                  setError("");
                  setMessage("");
                  await api.deleteAdminOnlineTrial(token, trial.id);
                  handleAdminBack();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur suppression dossier d'essai");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Suppression..." : "Supprimer le dossier"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}
      {savingProgress ? (
        <div className="panel border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            Mise a jour du suivi des essais en cours...
          </div>
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{scope.label} - Dossier essai</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Dossier essai #{dossierLabel} {routeFrom} {"->"} {routeTo} {directionSuffix}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Cree le {formatDateTime(trial.created_at)}
            </p>
          </div>
          <StatusBadge status={trial.status} labelOverride={getOnlineTrialStatusLabel(trial.status)} />
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Serie</th>
                <th className="px-3 py-3">Materiel concerne</th>
                <th className="px-3 py-3">Etat PPM</th>
                <th className="px-3 py-3">Motif d'annulation/ modification</th>
                <th className="px-3 py-3">Essai realise</th>
                <th className="px-3 py-3">Date de realisation</th>
                <th className="px-3 py-3">Resultat</th>
                <th className="px-3 py-3">Observation</th>
                <th className="px-3 py-3">Retard</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((row) => {
                const pmStatus = getDisplayedPpmStatus(trial.status, pmDecisions[row.index]?.ppm_status);
                const rowReason = (pmDecisions[row.index]?.ppm_reason || "").trim() || globalCancelOrModifyReason || "-";
                const rowProgress = progress[row.index];
                const rowResult = getTrialResultLabel(rowProgress);
                const rowObservation =
                  rowResult === "Concluant"
                    ? ""
                    : (rowProgress?.remarks ?? "").trim() || "-";
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                    <td className="px-3 py-3">{row.serie}</td>
                    <td className="px-3 py-3">{row.concerned}</td>
                    <td className="px-3 py-3">
                      <span className={getDisplayedPpmStatusClass(pmStatus)}>{pmStatus}</span>
                    </td>
                    <td className="px-3 py-3">{rowReason}</td>
                    <td className="px-3 py-3">{rowProgress?.performed ? "Oui" : "Non"}</td>
                    <td className="px-3 py-3">
                      {rowProgress?.realization_date ? formatDateTime(rowProgress.realization_date) : "-"}
                    </td>
                    <td className="px-3 py-3">{rowResult}</td>
                    <td className="px-3 py-3">{rowObservation}</td>
                    <td className="px-3 py-3">{getTrialDelayDisplay(rowProgress, trial.departure_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Createur</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{creatorLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mode d'essai</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{trial.transport_mode || "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Exploitant</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{trial.maintenance_state}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Accompagnement</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {trial.severity === "NIVEAU_1" ? "Sans" : "Avec"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vitesse</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {trial.speed_kmh != null ? `${trial.speed_kmh} km/h` : "Normal"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{parcoursLabel}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {routeFrom} {"->"} {routeTo}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Date de depart prevu</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {trial.departure_date ? formatDateTime(trial.departure_date) : "-"}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              trialResultSummary.value === "CONCLUANT"
                ? "border-emerald-300 bg-emerald-50"
                : trialResultSummary.value === "NON_CONCLUANT"
                  ? "border-rose-300 bg-rose-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <p
              className={`text-xs uppercase tracking-[0.18em] ${
                trialResultSummary.value === "CONCLUANT"
                  ? "text-emerald-700"
                  : trialResultSummary.value === "NON_CONCLUANT"
                    ? "text-rose-700"
                    : "text-slate-500"
              }`}
            >
              Resultat
            </p>
            <p
              className={`mt-2 text-sm font-semibold ${
                trialResultSummary.value === "CONCLUANT"
                  ? "text-emerald-900"
                  : trialResultSummary.value === "NON_CONCLUANT"
                    ? "text-rose-900"
                    : "text-slate-900"
              }`}
            >
              {trialResultSummary.label}
            </p>
          </div>
        </div>

        {trialResultSummary.value === "NON_CONCLUANT" ? (
          <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Observation</p>
            <p className="mt-2 text-sm font-medium text-rose-900">{trialResultSummary.observation || "-"}</p>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Motif</p>
          <p className="mt-2 text-sm text-slate-700">{trial.problem_description}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Autres conditions</p>
          <p className="mt-2 text-sm text-slate-700">{trial.transport_conditions_initial}</p>
        </div>

        {trial.attachments.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Pieces jointes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {trial.attachments.map((attachment) => (
                <a key={attachment.id} className="btn-secondary" href={`${API_BASE_URL}${attachment.stored_path}`} target="_blank" rel="noreferrer">
                  {attachment.filename}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {canShowDecisionAndFollowup ? (
        <section className="panel p-6">
          <h3 className="text-lg font-semibold text-slate-900">Decision permanent et suivi d'essai</h3>
          {trial.permanent_decision ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Decision PPM</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{trial.permanent_decision.decision}</p>
              {trial.permanent_decision.comment ? (
                <p className="mt-2 text-sm text-slate-700">{trial.permanent_decision.comment}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">En attente de decision du permanent.</p>
          )}

          {acceptedIndexes.length > 0 ? (
            <form
              className="mt-5 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!token) return;
                window.scrollTo({ top: 0, behavior: "smooth" });
                setSavingProgress(true);
                setError("");
                setMessage("");

                const realizationIso = progressDraft.realizationDate
                  ? (() => {
                      const parsed = new Date(progressDraft.realizationDate);
                      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
                    })()
                  : null;
                const trimmedRemarks = progressDraft.remarks.trim();

                if (progressDraft.performed && !realizationIso) {
                  setSavingProgress(false);
                  setError("La date de realisation est obligatoire.");
                  return;
                }

                if (progressDraft.performed && progressDraft.result === "NON_CONCLUANT" && !trimmedRemarks) {
                  setSavingProgress(false);
                  setError("L'observation est obligatoire pour un resultat Non Concluant.");
                  return;
                }

                const updates = acceptedIndexes.map((index) => ({
                  index,
                  performed: progressDraft.performed,
                  result: progressDraft.performed ? progressDraft.result : null,
                  realization_date: realizationIso,
                  remarks:
                    progressDraft.performed && progressDraft.result === "NON_CONCLUANT"
                      ? trimmedRemarks
                      : null,
                }));

                try {
                  await api.updateOnlineTrialProgress(token, trial.id, {
                    material_updates: updates,
                    global_remarks: "Suivi essai actualise par le createur",
                  });
                  setMessage("Suivi d'essai mis a jour.");
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur de mise a jour du suivi");
                } finally {
                  setSavingProgress(false);
                }
              }}
            >
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">Mise a jour du suivi essai</h4>
              <div className="rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-900">
                  Mise a jour globale pour {acceptedIndexes.length} materiel(s) accepte(s)
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={progressDraft.performed}
                      onChange={(e) =>
                        setProgressDraft((prev) => ({
                          ...prev,
                          performed: e.target.checked,
                        }))
                      }
                    />
                      Essai realise
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Date de realisation</span>
                    <input
                      className="input bg-white"
                      type="datetime-local"
                      value={progressDraft.realizationDate}
                      onChange={(e) =>
                        setProgressDraft((prev) => ({
                          ...prev,
                          realizationDate: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Resultat</span>
                    <select
                      className="input bg-white"
                      value={progressDraft.result}
                      onChange={(e) =>
                        setProgressDraft((prev) => ({
                          ...prev,
                          result: e.target.value as TrialResultValue,
                        }))
                      }
                      disabled={!progressDraft.performed}
                    >
                      <option value="CONCLUANT">Concluant</option>
                      <option value="NON_CONCLUANT">Non Concluant</option>
                    </select>
                  </label>
                  {progressDraft.performed && progressDraft.result === "NON_CONCLUANT" ? (
                    <label className="space-y-1 md:col-span-3">
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Observation</span>
                      <input
                        className="input bg-white"
                        type="text"
                        value={progressDraft.remarks}
                        onChange={(e) =>
                          setProgressDraft((prev) => ({
                            ...prev,
                            remarks: e.target.value,
                          }))
                        }
                        placeholder="Observation"
                        required
                      />
                    </label>
                  ) : null}
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={savingProgress}>
                {savingProgress ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                    Mise a jour...
                  </span>
                ) : (
                  "Valider le suivi des essais"
                )}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}


