import { useMemo, useState } from "react";
import type { Alert } from "../types";
import {
  buildAlertMaterialRows,
  parseMaterialConfirmations,
  parsePpmMaterialDecisions,
} from "../utils/alertMaterials";

type MaterialReceptionOutcome = "VALIDEE" | "EN_INSTANCE";

type MaterialReceptionDraft = {
  receptionDate: string;
  outcome: MaterialReceptionOutcome | null;
  reason: string;
};

function formatDateForInput(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseReceptionDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function outcomePillClass(value: MaterialReceptionOutcome, selected: boolean) {
  if (value === "VALIDEE") {
    return selected
      ? "border-emerald-400 bg-emerald-100 text-emerald-900"
      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50";
  }

  return selected
    ? "border-amber-400 bg-amber-100 text-amber-900"
    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50";
}

function canSetInstance(
  receptionStatus: string | null,
  instanceUsedOnce: boolean,
  selectedOutcome: MaterialReceptionOutcome | null
) {
  if (selectedOutcome === "EN_INSTANCE") {
    return true;
  }
  if (receptionStatus === "EN_INSTANCE") {
    return true;
  }
  return !instanceUsedOnce;
}

export function ConfirmationForm({
  alert,
  onSubmit,
}: {
  alert: Alert;
  onSubmit: (payload: {
    remarques: string;
    confirmed_material_indexes: number[];
    material_updates: Array<{
      index: number;
      date_reception: string;
      outcome: MaterialReceptionOutcome | "EN_ATTENTE";
      reason?: string;
    }>;
  }) => Promise<void>;
}) {
  const materialRows = useMemo(() => buildAlertMaterialRows(alert), [alert]);
  const pmDecisions = useMemo(
    () => parsePpmMaterialDecisions(alert.permanent_decision?.material_decisions),
    [alert.permanent_decision?.material_decisions]
  );
  const existingConfirmations = useMemo(
    () => parseMaterialConfirmations(alert.establishment_confirmation?.material_confirmations),
    [alert.establishment_confirmation?.material_confirmations]
  );

  const acceptedRows = useMemo(
    () => materialRows.filter((row) => pmDecisions[row.index]?.ppm_status === "ACCEPTEE"),
    [materialRows, pmDecisions]
  );
  const [defaultReceptionDate] = useState(() => formatDateForInput(new Date().toISOString()));

  const [remarques, setRemarques] = useState("");
  const [error, setError] = useState("");
  const [rowsDraft, setRowsDraft] = useState<Record<number, MaterialReceptionDraft>>(() => {
    const initial: Record<number, MaterialReceptionDraft> = {};
    for (const row of acceptedRows) {
      const existing = existingConfirmations[row.index];
      const existingOutcome = existing?.reception_status;
      initial[row.index] = {
        receptionDate: formatDateForInput(existing?.reception_date) || defaultReceptionDate,
        outcome: existingOutcome === "VALIDEE" || existingOutcome === "EN_INSTANCE" ? existingOutcome : null,
        reason: existing?.remarks ?? "",
      };
    }
    return initial;
  });

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();

        if (acceptedRows.length === 0) {
          setError("Aucun materiel accepte par le PM n'est disponible pour la reception.");
          return;
        }

        const material_updates: Array<{
          index: number;
          date_reception: string;
          outcome: MaterialReceptionOutcome | "EN_ATTENTE";
          reason?: string;
        }> = [];

        for (const row of acceptedRows) {
          const rowDraft = rowsDraft[row.index];
          const outcome = rowDraft?.outcome ?? null;
          const existingStatus = existingConfirmations[row.index]?.reception_status ?? null;
          const effectiveOutcome = outcome ?? (existingStatus === "EN_INSTANCE" ? "EN_ATTENTE" : null);
          if (!effectiveOutcome) {
            continue;
          }
          const parsedDate = parseReceptionDate(rowDraft?.receptionDate ?? "");
          if (!parsedDate) {
            setError(`Saisir une date valide pour le materiel ${row.serie || row.type}.`);
            return;
          }

          material_updates.push({
            index: row.index,
            date_reception: parsedDate.toISOString(),
            outcome: effectiveOutcome,
            reason: rowDraft?.reason.trim() || undefined,
          });
        }

        const confirmed_material_indexes = material_updates
          .filter((item) => item.outcome === "VALIDEE")
          .map((item) => item.index);

        if (material_updates.length === 0) {
          setError("Renseignez au moins un materiel a traiter.");
          return;
        }

        setError("");
        await onSubmit({
          remarques,
          confirmed_material_indexes,
          material_updates,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(248,250,252,0.95),rgba(255,255,255,1)_48%,rgba(236,253,245,0.6))] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Suivi reception par materiel</p>

        <div className="mt-4 overflow-x-auto rounded-[1rem] border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-600">
              <tr>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Serie</th>
                <th className="px-3 py-3">Materiel concerne</th>
                <th className="px-3 py-3">Etat demande (PM)</th>
                <th className="px-3 py-3">Motif PM</th>
                <th className="px-3 py-3">Date reception</th>
                <th className="px-3 py-3">Confirmation reception</th>
                <th className="px-3 py-3">Observation</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((row) => {
                const pmStatus = pmDecisions[row.index]?.ppm_status ?? null;
                const disabled = pmStatus !== "ACCEPTEE";
                const existingStatus = existingConfirmations[row.index]?.reception_status ?? null;
                const instanceUsedOnce = Boolean(existingConfirmations[row.index]?.instance_used_once);
                const isValidatedClosed = existingStatus === "VALIDEE";
                const rowDraft = rowsDraft[row.index] ?? {
                  receptionDate: defaultReceptionDate,
                  outcome: existingStatus === "VALIDEE" || existingStatus === "EN_INSTANCE" ? existingStatus : null,
                  reason: "",
                };
                const isInstanceActive = rowDraft.outcome === "EN_INSTANCE";
                const canChooseInstance = canSetInstance(existingStatus, instanceUsedOnce, rowDraft.outcome);

                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.type}</td>
                    <td className="px-3 py-3">{row.serie}</td>
                    <td className="px-3 py-3">{row.concerned}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-xl border px-2 py-1 text-xs font-semibold ${
                          pmStatus === "ACCEPTEE"
                            ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                            : pmStatus === "ANNULEE"
                              ? "border-rose-300 bg-rose-100 text-rose-900"
                              : "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {pmStatus === "ACCEPTEE" ? "Acceptée" : pmStatus === "ANNULEE" ? "Annulée" : "En attente"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{pmDecisions[row.index]?.ppm_reason ?? ""}</td>
                    <td className="px-3 py-3">
                      {disabled || isValidatedClosed ? (
                        <span className="text-xs text-slate-400">Non applicable</span>
                      ) : (
                        <input
                          type="datetime-local"
                          className="input h-10 w-full min-w-[180px]"
                          value={rowDraft.receptionDate}
                          onChange={(event) =>
                            setRowsDraft((prev) => ({
                              ...prev,
                              [row.index]: {
                                ...prev[row.index],
                                receptionDate: event.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {disabled || isValidatedClosed ? (
                        <span className="text-xs text-slate-400">Non applicable</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${outcomePillClass("VALIDEE", rowDraft.outcome === "VALIDEE")}`}
                            onClick={() =>
                              setRowsDraft((prev) => ({
                                ...prev,
                                [row.index]: {
                                  ...prev[row.index],
                                  outcome: "VALIDEE",
                                },
                              }))
                            }
                          >
                            Validée
                          </button>
                          <button
                            type="button"
                            disabled={!canChooseInstance}
                            className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${outcomePillClass("EN_INSTANCE", rowDraft.outcome === "EN_INSTANCE")} ${!canChooseInstance ? "cursor-not-allowed opacity-45" : ""}`}
                            onClick={() =>
                              setRowsDraft((prev) => ({
                                ...prev,
                                [row.index]: {
                                  ...prev[row.index],
                                  outcome: prev[row.index]?.outcome === "EN_INSTANCE" ? null : "EN_INSTANCE",
                                },
                              }))
                            }
                          >
                            En instance
                          </button>
                        </div>
                      )}
                      {!disabled && !isValidatedClosed && isInstanceActive ? (
                        <p className="mt-1 text-xs text-amber-700">Decochez "En instance" pour retirer l'etat et reprendre plus tard.</p>
                      ) : null}
                      {!disabled && !isValidatedClosed && !canChooseInstance && existingStatus !== "EN_INSTANCE" ? (
                        <p className="mt-1 text-xs text-slate-500">Ce materiel a deja utilise l'etat en instance une fois.</p>
                      ) : null}
                      {isValidatedClosed ? <p className="mt-1 text-xs text-emerald-700">Materiel valide et cloture.</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      {disabled || isValidatedClosed ? (
                        <span className="text-xs text-slate-400">-</span>
                      ) : (
                        <input
                          className="input h-10 w-full min-w-[180px]"
                          placeholder="Ex: Bien recu / Une erreur"
                          value={rowDraft.reason}
                          onChange={(event) =>
                            setRowsDraft((prev) => ({
                              ...prev,
                              [row.index]: {
                                ...prev[row.index],
                                reason: event.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Remarque globale</span>
          <textarea
            className="input min-h-24"
            value={remarques}
            onChange={(event) => setRemarques(event.target.value)}
            placeholder="Commentaire general optionnel"
          />
        </label>
      </div>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      <button
        type="submit"
        className="w-full rounded-[1.3rem] bg-emerald-600 px-5 py-4 text-base font-semibold text-white shadow-[0_24px_44px_-26px_rgba(5,150,105,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-700"
      >
        Enregistrer
      </button>
    </form>
  );
}
