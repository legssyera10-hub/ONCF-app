import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { OnlineTrial } from "../types";
import { API_BASE_URL } from "../utils/api";
import { parsePpmMaterialDecisions } from "../utils/alertMaterials";
import { getOnlineTrialDirectionTitleSuffix, getOnlineTrialParcoursLabel } from "../utils/onlineTrialDirection";
import { formatDateTime, formatDelayMinutes, parseApiDate } from "../utils/format";
import {
  buildOnlineTrialMaterialRows,
  parseOnlineTrialProgress,
  type OnlineTrialProgressEntry,
} from "../utils/onlineTrialMaterials";
import { getOnlineTrialStatusLabel } from "../utils/onlineTrialStatus";
import { getOnlineTrialCreatorLabel } from "../utils/onlineTrialCreator";

type PendingDecisionPayload = {
  decision: "CONFIRMER" | "ANNULER" | "MODIFIER";
  commentaire?: string;
};

function inferTrialResult(entry?: OnlineTrialProgressEntry): "CONCLUANT" | "NON_CONCLUANT" {
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

export function PermanentOnlineTrialDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [trial, setTrial] = useState<OnlineTrial | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<"CONFIRMER" | "ANNULER" | "MODIFIER">("CONFIRMER");
  const [decisionReason, setDecisionReason] = useState("");

  async function load() {
    if (!token || !id) return;
    try {
      setError("");
      const result = await api.onlineTrialById(token, Number(id));
      setTrial(result);
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
    return <div className="panel p-6 text-sm text-slate-500">Chargement du dossier permanent essai...</div>;
  }

  const routeFrom = trial.departure_station?.name ?? trial.station.name ?? "-";
  const routeTo = trial.arrival_station?.name ?? "-";
  const creatorLabel = getOnlineTrialCreatorLabel(trial);
  const dossierLabel = trial.dossier_label ?? String(trial.dossier_number ?? trial.id);
  const directionSuffix = getOnlineTrialDirectionTitleSuffix(trial);
  const parcoursLabel = getOnlineTrialParcoursLabel(trial);
  const isClosedTrial =
    trial.status === "RECEPTION_COMPLETE" ||
    trial.status === "ANNULEE" ||
    trial.status === "MODIFIEE" ||
    trial.status === "A_MODIFIER";

  async function sendDecision(payload: PendingDecisionPayload) {
    if (!token || !trial) return;
    await api.createOnlineTrialDecision(token, trial.id, payload);
    await load();
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
                const ppmStatus = getDisplayedPpmStatus(trial.status, ppmDecisions[row.index]?.ppm_status);
                const rowReason = (ppmDecisions[row.index]?.ppm_reason || "").trim() || globalCancelOrModifyReason || "-";
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
                      <span className={getDisplayedPpmStatusClass(ppmStatus)}>{ppmStatus}</span>
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

      {!isClosedTrial ? (
        <section className="panel p-6">
          <h3 className="text-lg font-semibold text-slate-900">Decision permanent</h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
          </div>

          {action === "CONFIRMER" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              la demande d'essai sera confirmee
            </div>
          ) : null}

          {action !== "CONFIRMER" ? (
          <label className="mt-4 block space-y-2">
            <span className="text-base font-medium text-slate-700">
              {action === "ANNULER" ? "Motif d'annulation" : "Motif de modification"}
            </span>
            <textarea
              className="input min-h-24 rounded-[1.1rem] bg-slate-50 text-base"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={action === "ANNULER" ? "Saisir le motif d'annulation" : "Saisir le motif de modification"}
            />
          </label>
          ) : null}

          <button
          type="button"
          className="btn-primary mt-4"
          disabled={submitting}
          onClick={async () => {
            if (!token) return;
            setError("");
            setMessage("");
            const commentaire = decisionReason.trim();
            if (action === "ANNULER" && !commentaire) {
              setError("Le motif d'annulation est obligatoire.");
              return;
            }
            if (action === "MODIFIER" && !commentaire) {
              setError("Le motif de modification est obligatoire.");
              return;
            }
            const payload: PendingDecisionPayload = {
              decision: action,
              commentaire: action === "CONFIRMER" ? undefined : commentaire,
            }

            try {
              setSubmitting(true);
              await sendDecision(payload);
              setMessage(
                action === "CONFIRMER"
                  ? "Decision enregistree: demande acceptee et traitee."
                  : action === "MODIFIER"
                    ? "Decision enregistree: demande retournee pour modification."
                    : "Decision enregistree: demande annulee."
              );
              window.scrollTo({ top: 0, behavior: "smooth" });
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
          </button>
        </section>
      ) : null}
    </div>
  );
}
