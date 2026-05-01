import { useMemo, useState } from "react";
import type { Alert, Establishment, PermanentDecisionAction } from "../types";
import { buildAlertMaterialRows, parseMaterialConfirmations, parsePpmMaterialDecisions } from "../utils/alertMaterials";

type MaterialPpmStatus = "ACCEPTEE" | "ANNULEE" | null;
type DecisionSubmitPayload = {
  etablissement_dest_id?: number;
  commentaire: string;
  decision: PermanentDecisionAction;
  accepted_material_indexes: number[];
  canceled_material_indexes: number[];
  material_reason_updates?: Array<{ index: number; motif_pm?: string }>;
};

const decisionOptions: Array<{ value: PermanentDecisionAction; label: string; helper: string }> = [
  {
    value: "MODIFIER",
    label: "Modifier",
    helper: "Retourner au demandeur",
  },
  {
    value: "ANNULER",
    label: "Annuler",
    helper: "Clore la demande",
  },
  {
    value: "CONFIRMER",
    label: "Traiter",
    helper: "Attribuer la reception",
  },
];

function getDecisionButtonClasses(decision: PermanentDecisionAction, isActive: boolean) {
  if (decision === "MODIFIER") {
    return isActive
      ? "border-orange-300 bg-[radial-gradient(circle_at_top,rgba(255,237,213,0.95),rgba(255,247,237,0.98)_58%,rgba(255,255,255,1))] text-orange-950 shadow-[0_20px_48px_-30px_rgba(249,115,22,0.6)]"
      : "border-orange-200 bg-white text-orange-700 hover:border-orange-300 hover:bg-orange-50";
  }

  if (decision === "ANNULER") {
    return isActive
      ? "border-rose-300 bg-[radial-gradient(circle_at_top,rgba(255,228,230,0.95),rgba(255,241,242,0.98)_58%,rgba(255,255,255,1))] text-rose-950 shadow-[0_20px_48px_-30px_rgba(244,63,94,0.58)]"
      : "border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50";
  }

  return isActive
    ? "border-emerald-300 bg-[radial-gradient(circle_at_top,rgba(209,250,229,0.98),rgba(236,253,245,0.98)_58%,rgba(255,255,255,1))] text-emerald-950 shadow-[0_20px_48px_-30px_rgba(16,185,129,0.62)]"
    : "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50";
}

function getSubmitButtonClasses(decision: PermanentDecisionAction) {
  if (decision === "MODIFIER") {
    return "w-full rounded-[1.35rem] bg-orange-500 px-5 py-4 text-base font-semibold text-white shadow-[0_24px_44px_-24px_rgba(249,115,22,0.72)] transition hover:-translate-y-0.5 hover:bg-orange-600";
  }

  if (decision === "ANNULER") {
    return "w-full rounded-[1.35rem] bg-rose-600 px-5 py-4 text-base font-semibold text-white shadow-[0_24px_44px_-24px_rgba(225,29,72,0.72)] transition hover:-translate-y-0.5 hover:bg-rose-700";
  }

  return "w-full rounded-[1.35rem] bg-emerald-600 px-5 py-4 text-base font-semibold text-white shadow-[0_24px_44px_-24px_rgba(5,150,105,0.72)] transition hover:-translate-y-0.5 hover:bg-emerald-700";
}

function getDestinationLabel(code?: string | null, name?: string | null) {
  const safeCode = (code ?? "").trim();
  const safeName = (name ?? "").trim();
  if (safeCode && safeName) {
    if (safeCode.toLowerCase() === safeName.toLowerCase()) {
      return safeCode;
    }
    return `${safeCode} - ${safeName}`;
  }
  return safeCode || safeName || "";
}

export function DecisionForm({
  alert,
  establishments,
  onSubmit,
}: {
  alert: Alert;
  establishments: Establishment[];
  onSubmit: (payload: {
    etablissement_dest_id?: number;
    commentaire: string;
    decision: PermanentDecisionAction;
    accepted_material_indexes: number[];
    canceled_material_indexes: number[];
    motif_pm?: string;
    material_reason_updates?: Array<{ index: number; motif_pm?: string }>;
  }) => Promise<void>;
}) {
  const materialRows = useMemo(() => buildAlertMaterialRows(alert), [alert]);
  const existingMaterialDecisions = useMemo(
    () => parsePpmMaterialDecisions(alert.permanent_decision?.material_decisions),
    [alert.permanent_decision?.material_decisions]
  );
  const existingMaterialConfirmations = useMemo(
    () => parseMaterialConfirmations(alert.establishment_confirmation?.material_confirmations),
    [alert.establishment_confirmation?.material_confirmations]
  );
  const forceTreatOnly = alert.permanent_decision?.decision === "CONFIRMER";

  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState({
    commentaire: "",
    decision: "CONFIRMER" as PermanentDecisionAction,
    destinationId:
      alert.permanent_decision?.destination_establishment.id ??
      alert.requested_destination_establishment?.id ??
      establishments[0]?.id ??
      0,
  });
  const [materialStatuses, setMaterialStatuses] = useState<Record<number, MaterialPpmStatus>>(() => {
    const defaults: Record<number, MaterialPpmStatus> = {};
    for (const row of materialRows) {
      const existingStatus = existingMaterialDecisions[row.index]?.ppm_status;
      defaults[row.index] = existingStatus === "ACCEPTEE" || existingStatus === "ANNULEE" ? existingStatus : null;
    }
    return defaults;
  });
  const [materialReasons, setMaterialReasons] = useState<Record<number, string>>(() => {
    const defaults: Record<number, string> = {};
    for (const row of materialRows) {
      defaults[row.index] = existingMaterialDecisions[row.index]?.ppm_reason ?? "";
    }
    return defaults;
  });
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [cancelWarningSummary, setCancelWarningSummary] = useState("");
  const [cancelWarningCount, setCancelWarningCount] = useState(0);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<DecisionSubmitPayload | null>(null);

  async function submitPayload(submitPayloadData: DecisionSubmitPayload) {
    await onSubmit(submitPayloadData);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmCancellationSubmit() {
    if (!pendingSubmitPayload) {
      return;
    }
    const payloadToSubmit = pendingSubmitPayload;
    setShowCancelWarning(false);
    setPendingSubmitPayload(null);
    await submitPayload(payloadToSubmit);
  }

  async function submitDecision() {
    setError(null);
    const commentaire = payload.commentaire.trim();

    if (payload.decision === "MODIFIER") {
      if (!commentaire) {
        setError("Expliquez ce que le demandeur doit modifier.");
        return;
      }
      await submitPayload({
        commentaire,
        decision: payload.decision,
        accepted_material_indexes: [],
        canceled_material_indexes: [],
      });
      return;
    }

    if (payload.decision === "ANNULER") {
      if (!commentaire) {
        setError("Expliquez pourquoi la demande est annulee.");
        return;
      }
      await submitPayload({
        commentaire,
        decision: payload.decision,
        accepted_material_indexes: [],
        canceled_material_indexes: [],
      });
      return;
    }

    if (!payload.destinationId) {
      setError("Selectionnez un destinataire.");
      return;
    }

    const accepted_material_indexes = materialRows
      .map((row) => row.index)
      .filter((index) => materialStatuses[index] === "ACCEPTEE");
    const canceled_material_indexes = materialRows
      .map((row) => row.index)
      .filter((index) => materialStatuses[index] === "ANNULEE");

    if (accepted_material_indexes.length === 0 && canceled_material_indexes.length === 0) {
      setError("Selectionnez au moins un materiel a accepter ou annuler.");
      return;
    }

    const confirmationPayload: DecisionSubmitPayload = {
      decision: payload.decision,
      commentaire,
      etablissement_dest_id: payload.destinationId,
      accepted_material_indexes,
      canceled_material_indexes,
      material_reason_updates: materialRows.map((row) => ({
        index: row.index,
        motif_pm: materialReasons[row.index]?.trim() || undefined,
      })),
    };

    if (canceled_material_indexes.length > 0) {
      const canceledMaterialsSummary = materialRows
        .filter((row) => canceled_material_indexes.includes(row.index))
        .map((row) => `${row.type} ${row.serie}`.trim())
        .join(", ");
      setCancelWarningSummary(canceledMaterialsSummary);
      setCancelWarningCount(canceled_material_indexes.length);
      setPendingSubmitPayload(confirmationPayload);
      setShowCancelWarning(true);
      return;
    }

    await submitPayload(confirmationPayload);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submitDecision();
      }}
    >
      <div className="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(248,250,252,0.98),rgba(255,255,255,1)_40%,rgba(236,253,245,0.6))] p-5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.35)]">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Action permanent</p>
          </div>
          <div className={forceTreatOnly ? "grid gap-3 sm:grid-cols-1" : "grid gap-3 sm:grid-cols-3"}>
            {decisionOptions
              .filter((option) => (forceTreatOnly ? option.value === "CONFIRMER" : true))
              .map((option) => {
              const isActive = payload.decision === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`min-h-[5.2rem] rounded-[1.35rem] border px-5 py-4 text-base font-semibold transition ${getDecisionButtonClasses(option.value, isActive)} ${forceTreatOnly ? "mx-auto w-full sm:max-w-[340px]" : ""}`}
                  onClick={() => setPayload((prev) => ({ ...prev, decision: option.value }))}
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-1 block text-xs font-medium opacity-80">{option.helper}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {payload.decision === "CONFIRMER" ? (
        <div className="space-y-5 rounded-[1.5rem] border border-emerald-200 bg-[linear-gradient(160deg,rgba(240,253,244,0.95),rgba(236,253,245,0.86))] p-5">
          <div className="grid gap-4 md:grid-cols-1">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Destinataire</span>
              <select
                className="input bg-white"
                value={payload.destinationId}
                onChange={(event) => setPayload((prev) => ({ ...prev, destinationId: Number(event.target.value) }))}
              >
                {establishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getDestinationLabel(item.code, item.name)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto rounded-[1.2rem] border border-emerald-200 bg-white/90">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-emerald-50 text-xs uppercase tracking-[0.14em] text-emerald-800">
                <tr>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Serie</th>
                  <th className="px-3 py-3">Materiel concerne</th>
                  <th className="px-3 py-3">Decision PM</th>
                  <th className="px-3 py-3">Motif PPM (modification / annulation)</th>
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row) => {
                  const persistedStatus = existingMaterialDecisions[row.index]?.ppm_status ?? null;
                  const isPersistedCancelled = persistedStatus === "ANNULEE";
                  const isReceptionValidated = existingMaterialConfirmations[row.index]?.reception_status === "VALIDEE";
                  const isRowClosed = isPersistedCancelled || isReceptionValidated;
                  const currentStatus = materialStatuses[row.index] ?? null;
                  return (
                    <tr key={row.id} className="border-t border-emerald-100">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                      <td className="px-3 py-3">{row.serie}</td>
                      <td className="px-3 py-3">{row.concerned}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isRowClosed}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              currentStatus === "ACCEPTEE"
                                ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                            } ${isRowClosed ? "cursor-not-allowed opacity-45" : ""}`}
                            onClick={() =>
                              setMaterialStatuses((prev) => ({
                                ...prev,
                                [row.index]: prev[row.index] === "ACCEPTEE" ? null : "ACCEPTEE",
                              }))
                            }
                          >
                            Acceptée
                          </button>
                          <button
                            type="button"
                            disabled={isRowClosed}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                              currentStatus === "ANNULEE"
                                ? "border-rose-400 bg-rose-100 text-rose-900"
                                : "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50"
                            } ${isRowClosed ? "cursor-not-allowed opacity-45" : ""}`}
                            onClick={() =>
                              setMaterialStatuses((prev) => ({
                                ...prev,
                                [row.index]: prev[row.index] === "ANNULEE" ? null : "ANNULEE",
                              }))
                            }
                          >
                            Annulée
                          </button>
                        </div>
                        {!isPersistedCancelled && isReceptionValidated ? (
                          <p className="mt-1 text-xs text-slate-600">Reception deja validee: materiel cloture.</p>
                        ) : null}
                        {persistedStatus === "MODIFIEE" ? (
                          <p className="mt-1 text-xs text-orange-700">Demande modifiee par PM sur ce dossier.</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          className="input h-10 w-full min-w-[220px]"
                          placeholder="Motif PM pour ce materiel"
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
        </div>
      ) : null}

      {payload.decision !== "CONFIRMER" ? (
        <label className="block space-y-2">
          <span className="text-base font-medium text-slate-700">
            {payload.decision === "MODIFIER" ? "Message au demandeur" : "Motif d'annulation"}
          </span>
          <textarea
            className="input min-h-40 rounded-[1.35rem] bg-slate-50 text-base"
            placeholder={
              payload.decision === "MODIFIER"
                ? "Expliquez pourquoi la demande doit être modifiée et quels éléments corriger."
                : "Expliquez clairement pourquoi la demande est annulée."
            }
            value={payload.commentaire}
            onChange={(event) => setPayload((prev) => ({ ...prev, commentaire: event.target.value }))}
          />
        </label>
      ) : null}

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

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
                Vous allez annuler <span className="font-semibold text-rose-700">{cancelWarningCount}</span>{" "}
                materiel(s)
                {cancelWarningSummary ? ` : ${cancelWarningSummary}.` : "."}
              </p>
              <p className="text-xs text-slate-500">
                Verifiez votre selection avant confirmation. Cette operation sera enregistree dans la demande.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setShowCancelWarning(false);
                    setPendingSubmitPayload(null);
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

      <button
        type="submit"
        className={`${getSubmitButtonClasses(payload.decision)} ${
          showCancelWarning ? "cursor-not-allowed opacity-60" : ""
        }`}
        disabled={showCancelWarning}
      >
        {payload.decision === "MODIFIER"
          ? "Renvoyer au demandeur"
          : payload.decision === "ANNULER"
            ? "Annuler la demande"
            : "Valider le traitement PM"}
      </button>
    </form>
  );
}
