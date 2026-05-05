import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { OnlineTrial } from "../types";
import { API_BASE_URL } from "../utils/api";
import { parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { getOnlineTrialDirectionTitleSuffix, getOnlineTrialParcoursLabel } from "../utils/onlineTrialDirection";
import { formatDateTime, toLocalInputDateTime } from "../utils/format";
import { buildOnlineTrialMaterialRows, parseOnlineTrialProgress } from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";

type GlobalProgressDraft = {
  performed: boolean;
  realizationDate: string;
  remarks: string;
};

const DEFAULT_PROGRESS_DRAFT: GlobalProgressDraft = {
  performed: false,
  realizationDate: "",
  remarks: "",
};

function getScope(pathname: string) {
  if (pathname.startsWith("/projet/")) {
    return { base: "/projet/essais", label: "Projet" };
  }
  return { base: "/essais", label: "Technicentre" };
}

export function OnlineTrialDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const location = useLocation();
  const scope = getScope(location.pathname);
  const [trial, setTrial] = useState<OnlineTrial | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);
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

      setProgressDraft({
        performed: allPerformed,
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

  const acceptedIndexes = useMemo(
    () => materialRows.map((row) => row.index).filter((index) => pmDecisions[index]?.ppm_status === "ACCEPTEE"),
    [materialRows, pmDecisions]
  );

  if (!trial && error) {
    return <div className="panel border border-rose-200 p-6 text-sm text-rose-600">{error}</div>;
  }
  if (!trial) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement du dossier d'essai...</div>;
  }

  const routeFrom = trial.departure_station?.name ?? trial.station.name ?? "-";
  const routeTo = trial.arrival_station?.name ?? "-";
  const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
  const directionSuffix = getOnlineTrialDirectionTitleSuffix(trial);
  const parcoursLabel = getOnlineTrialParcoursLabel(trial);
  const isClosedTrial =
    trial.status === "RECEPTION_COMPLETE" || trial.status === "ANNULEE" || trial.status === "MODIFIEE";
  const canEditTrial = trial.status === "A_MODIFIER";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {canEditTrial ? (
          <Link to={`${scope.base}/${trial.id}/edit`} className="btn-primary">
            Modifier la demande
          </Link>
        ) : isClosedTrial ? (
          <span className="btn-secondary cursor-not-allowed opacity-70">Dossier cloture</span>
        ) : (
          <span className="btn-secondary cursor-not-allowed opacity-70">Modification disponible apres demande PPM</span>
        )}
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
                <th className="px-3 py-3">Essai realise</th>
                <th className="px-3 py-3">Date de realisation</th>
                <th className="px-3 py-3">Observation</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((row) => {
                const pmStatus = pmDecisions[row.index]?.ppm_status ?? "EN_ATTENTE";
                const rowProgress = progress[row.index];
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                    <td className="px-3 py-3">{row.serie}</td>
                    <td className="px-3 py-3">{row.concerned}</td>
                    <td className="px-3 py-3">{pmStatus}</td>
                    <td className="px-3 py-3">{rowProgress?.performed ? "Oui" : "Non"}</td>
                    <td className="px-3 py-3">
                      {rowProgress?.realization_date ? formatDateTime(rowProgress.realization_date) : "-"}
                    </td>
                    <td className="px-3 py-3">{rowProgress?.remarks || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        </div>

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
        {isClosedTrial ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Dossier cloture: aucune modification supplementaire n'est autorisee.
          </div>
        ) : null}

        {acceptedIndexes.length > 0 && !isClosedTrial ? (
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

              const updates = acceptedIndexes.map((index) => ({
                index,
                performed: progressDraft.performed,
                realization_date: realizationIso,
                remarks: progressDraft.remarks.trim() || null,
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
              <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                <label className="space-y-1 md:col-span-2">
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
                  />
                </label>
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
    </div>
  );
}


