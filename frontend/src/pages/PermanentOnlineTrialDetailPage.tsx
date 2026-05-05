import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { OnlineTrial } from "../types";
import { API_BASE_URL } from "../utils/api";
import { parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { getOnlineTrialDirectionTitleSuffix, getOnlineTrialParcoursLabel } from "../utils/onlineTrialDirection";
import { formatDateTime } from "../utils/format";
import { buildOnlineTrialMaterialRows, parseOnlineTrialProgress } from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";

type MaterialPmStatus = "ACCEPTEE" | "ANNULEE" | null;

type PendingDecisionPayload = {
  decision: "CONFIRMER" | "ANNULER" | "MODIFIER";
  commentaire: string;
  accepted_material_indexes: number[];
  canceled_material_indexes: number[];
  material_reason_updates: Array<{ index: number; motif_pm?: string }>;
};

export function PermanentOnlineTrialDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [trial, setTrial] = useState<OnlineTrial | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<"CONFIRMER" | "ANNULER" | "MODIFIER">("CONFIRMER");
  const [comment, setComment] = useState("");
  const [materialStatuses, setMaterialStatuses] = useState<Record<number, MaterialPmStatus>>({});
  const [materialReasons, setMaterialReasons] = useState<Record<number, string>>({});
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [cancelWarningSummary, setCancelWarningSummary] = useState("");
  const [cancelWarningCount, setCancelWarningCount] = useState(0);
  const [pendingPayload, setPendingPayload] = useState<PendingDecisionPayload | null>(null);

  async function load() {
    if (!token || !id) return;
    try {
      setError("");
      const result = await api.onlineTrialById(token, Number(id));
      setTrial(result);
      const decisions = parsePpmMaterialDecisions(result.permanent_decision?.material_decisions);
      const statuses: Record<number, MaterialPmStatus> = {};
      const reasons: Record<number, string> = {};
      for (const row of buildOnlineTrialMaterialRows(result)) {
        const rawStatus = decisions[row.index]?.ppm_status;
        statuses[row.index] = rawStatus === "ACCEPTEE" || rawStatus === "ANNULEE" ? rawStatus : null;
        reasons[row.index] = decisions[row.index]?.ppm_reason ?? "";
      }
      setMaterialStatuses(statuses);
      setMaterialReasons(reasons);
      if (result.permanent_decision?.comment) {
        setComment(result.permanent_decision.comment);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  const materialRows = useMemo(() => (trial ? buildOnlineTrialMaterialRows(trial) : []), [trial]);
  const ppmDecisions = useMemo(
    () => parsePpmMaterialDecisions(trial?.permanent_decision?.material_decisions),
    [trial?.permanent_decision?.material_decisions]
  );
  const progress = useMemo(() => parseOnlineTrialProgress(trial?.trial_material_progress), [trial?.trial_material_progress]);

  if (!trial && error) {
    return <div className="panel border border-rose-200 p-6 text-sm text-rose-600">{error}</div>;
  }
  if (!trial) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement du dossier permanent essai...</div>;
  }

  const routeFrom = trial.departure_station?.name ?? trial.station.name ?? "-";
  const routeTo = trial.arrival_station?.name ?? "-";
  const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
  const directionSuffix = getOnlineTrialDirectionTitleSuffix(trial);
  const parcoursLabel = getOnlineTrialParcoursLabel(trial);
  const isClosedTrial =
    trial.status === "RECEPTION_COMPLETE" || trial.status === "ANNULEE" || trial.status === "MODIFIEE";

  async function sendDecision(payload: PendingDecisionPayload) {
    if (!token || !trial) return;
    await api.createOnlineTrialDecision(token, trial.id, payload);
    await load();
  }

  async function confirmCancellationSubmit() {
    if (!pendingPayload) return;
    const data = pendingPayload;
    setShowCancelWarning(false);
    setPendingPayload(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSubmitting(true);
    try {
      await sendDecision(data);
      setMessage("Decision enregistree.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de validation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate("/permanent/essais")} className="btn-secondary">
        Retour a la liste
      </button>

      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}
      {submitting ? (
        <div className="panel border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" />
            Traitement de la decision PPM en cours...
          </div>
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Permanent PPM - Dossier essai</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Dossier essai #{dossierLabel} {routeFrom} {"->"} {routeTo} {directionSuffix}
            </h2>
            <p className="mt-2 text-sm text-slate-500">Cree le {formatDateTime(trial.created_at)}</p>
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
                const ppmStatus = ppmDecisions[row.index]?.ppm_status ?? "EN_ATTENTE";
                const rowProgress = progress[row.index];
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                    <td className="px-3 py-3">{row.serie}</td>
                    <td className="px-3 py-3">{row.concerned}</td>
                    <td className="px-3 py-3">{ppmStatus}</td>
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
            <p className="mt-2 text-sm font-semibold text-slate-900">{trial.severity === "NIVEAU_1" ? "Sans" : "Avec"}</p>
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
        <h3 className="text-lg font-semibold text-slate-900">Decision permanent</h3>
        {isClosedTrial ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Dossier cloture: aucune modification supplementaire n'est autorisee.
          </div>
        ) : null}

        {!isClosedTrial ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setAction("MODIFIER")}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              action === "MODIFIER"
                ? "border-amber-300 bg-amber-100 text-amber-900"
                : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
            }`}
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={() => setAction("ANNULER")}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              action === "ANNULER"
                ? "border-rose-300 bg-rose-100 text-rose-900"
                : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
            }`}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => setAction("CONFIRMER")}
            className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              action === "CONFIRMER"
                ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Accepter / Traiter
          </button>
        </div> : null}

        {action === "CONFIRMER" && !isClosedTrial ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-200 bg-white">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-emerald-50 text-xs uppercase tracking-[0.14em] text-emerald-800">
                <tr>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Serie</th>
                  <th className="px-3 py-3">Materiel concerne</th>
                  <th className="px-3 py-3">Decision PPM</th>
                  <th className="px-3 py-3">Motif PPM</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row) => {
                  const statusValue = materialStatuses[row.index] ?? null;
                  return (
                    <tr key={row.id} className="border-t border-emerald-100">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                      <td className="px-3 py-3">{row.serie}</td>
                      <td className="px-3 py-3">{row.concerned}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              statusValue === "ACCEPTEE"
                                ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                            }`}
                            onClick={() =>
                              setMaterialStatuses((prev) => ({
                                ...prev,
                                [row.index]: prev[row.index] === "ACCEPTEE" ? null : "ACCEPTEE",
                              }))
                            }
                          >
                            Acceptee
                          </button>
                          <button
                            type="button"
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              statusValue === "ANNULEE"
                                ? "border-rose-400 bg-rose-100 text-rose-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50"
                            }`}
                            onClick={() =>
                              setMaterialStatuses((prev) => ({
                                ...prev,
                                [row.index]: prev[row.index] === "ANNULEE" ? null : "ANNULEE",
                              }))
                            }
                          >
                            Annulee
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          className="input h-10 w-full min-w-[220px]"
                          placeholder="Motif PPM pour ce materiel"
                          value={materialReasons[row.index] ?? ""}
                          onChange={(event) =>
                            setMaterialReasons((prev) => ({
                              ...prev,
                              [row.index]: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isClosedTrial ? <label className="mt-4 block space-y-2">
          <span className="text-base font-medium text-slate-700">
            {action === "MODIFIER" ? "Message de modification" : action === "ANNULER" ? "Motif d'annulation" : "Commentaire PPM (optionnel)"}
          </span>
          <textarea
            className="input min-h-28 rounded-[1.1rem] bg-slate-50 text-base"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              action === "MODIFIER"
                ? "Expliquez les modifications demandees au createur."
                : action === "ANNULER"
                  ? "Expliquez le motif d'annulation de la demande d'essai."
                  : "Commentaire permanent."
            }
          />
        </label> : null}

        {!isClosedTrial ? <button
          type="button"
          className="btn-primary mt-4"
          disabled={submitting || showCancelWarning}
          onClick={async () => {
            if (!token) return;
            setError("");
            setMessage("");

            const commentaire = comment.trim();
            if (action === "MODIFIER" && !commentaire) {
              setError("Le message de modification est obligatoire.");
              return;
            }
            if (action === "ANNULER" && !commentaire) {
              setError("Le motif d'annulation est obligatoire.");
              return;
            }

            const accepted = materialRows
              .map((row) => row.index)
              .filter((index) => materialStatuses[index] === "ACCEPTEE");
            const canceled = materialRows
              .map((row) => row.index)
              .filter((index) => materialStatuses[index] === "ANNULEE");

            if (action === "CONFIRMER" && accepted.length === 0 && canceled.length === 0) {
              setError("Selectionnez au moins un materiel a accepter ou annuler.");
              return;
            }

            const payload: PendingDecisionPayload = {
              decision: action,
              commentaire,
              accepted_material_indexes: accepted,
              canceled_material_indexes: canceled,
              material_reason_updates: materialRows.map((row) => ({
                index: row.index,
                motif_pm: materialReasons[row.index]?.trim() || undefined,
              })),
            };

            if (action === "CONFIRMER" && canceled.length > 0) {
              const summary = materialRows
                .filter((row) => canceled.includes(row.index))
                .map((row) => `${row.type} ${row.serie}`.trim())
                .join(", ");
              setCancelWarningCount(canceled.length);
              setCancelWarningSummary(summary);
              setPendingPayload(payload);
              setShowCancelWarning(true);
              return;
            }

            try {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setSubmitting(true);
              await sendDecision(payload);
              setMessage("Decision enregistree.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur de validation");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              Validation...
            </span>
          ) : (
            "Valider la decision PPM"
          )}
        </button> : null}
      </section>

      {showCancelWarning ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-warning-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-amber-200 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.72)]">
            <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-6 py-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-base font-bold text-amber-700">
                !
              </span>
              <div>
                <h3 id="cancel-warning-title" className="text-lg font-semibold text-amber-900">
                  Avertissement d'annulation
                </h3>
                <p className="text-sm text-amber-800">Cette action va annuler un ou plusieurs materiels.</p>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-slate-700">
                Vous allez annuler <span className="font-semibold text-rose-700">{cancelWarningCount}</span> materiel(s)
                {cancelWarningSummary ? ` : ${cancelWarningSummary}.` : "."}
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setShowCancelWarning(false);
                    setPendingPayload(null);
                  }}
                >
                  Retour
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-rose-500 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_-22px_rgba(225,29,72,0.82)] transition hover:bg-rose-700"
                  onClick={() => void confirmCancellationSubmit()}
                >
                  Confirmer l'annulation
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
