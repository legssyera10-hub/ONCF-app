import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AlertRequestDetailsGrid, DossierRouteText } from "../components/AlertRequestDetailsGrid";
import { DecisionForm } from "../components/DecisionForm";
import { GeneratePdfButton } from "../components/GeneratePdfButton";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../utils/api";
import { getPermanentDecisionReason } from "../utils/alertHistory";
import type { Alert, Establishment } from "../types";

export function PermanentAlertDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token || !id) return;
    try {
      const [alertResult, establishmentsResult] = await Promise.all([
        api.alertById(token, Number(id)),
        api.establishments(token),
      ]);
      setAlert(alertResult);
      setEstablishments(establishmentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  if (!alert && error) {
    return <div className="panel border border-rose-200 p-6 text-sm text-rose-600">{error}</div>;
  }

  if (!alert) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement du dossier permanent...</div>;
  }

  const latestHistoryNote = alert.history
    .slice()
    .reverse()
    .find((item) => item.note?.trim());
  const permanentDecisionReason = getPermanentDecisionReason(alert);
  const isModificationRequest = alert.status === "A_MODIFIER";
  const isCancelledRequest = alert.status === "ANNULEE";
  const isClosedDossier =
    alert.status === "RECEPTION_COMPLETE" || alert.status === "ANNULEE" || alert.status === "MODIFIEE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate("/permanent/dashboard")} className="btn-secondary">
          Retour à la liste
        </button>
      </div>

      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Dossier permanent</p>
            <div className="mt-2 flex w-full flex-wrap items-center gap-4">
              <h2 className="min-w-0 flex-1 text-3xl font-semibold text-slate-900">
                Dossier #{alert.dossier_label ?? alert.id} · <DossierRouteText alert={alert} />
              </h2>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <GeneratePdfButton alert={alert} />
                <StatusBadge
                  status={alert.status}
                  materialConfirmations={alert.establishment_confirmation?.material_confirmations}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <AlertRequestDetailsGrid alert={alert} />
        </div>

        {alert.attachments.length > 0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pièces jointes</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {alert.attachments.map((attachment) => (
                <a key={attachment.id} className="btn-secondary" href={`${API_BASE_URL}${attachment.stored_path}`} target="_blank" rel="noreferrer">
                  {attachment.filename}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Décision permanent</h3>
        {alert.permanent_decision ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Établissement</p>
              <p className="mt-2 font-semibold text-slate-900">{alert.permanent_decision.destination_establishment.name}</p>
            </div>
            {!isClosedDossier ? (
              <DecisionForm
                alert={alert}
                establishments={establishments}
                onSubmit={async (payload) => {
                  if (!token) return;
                  await api.createDecision(token, alert.id, payload);
                  await load();
                }}
              />
            ) : null}
          </div>
        ) : isModificationRequest || isCancelledRequest ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/90 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Traitement en attente</p>
              <p className="mt-2 leading-6 text-slate-700">
                {permanentDecisionReason ?? latestHistoryNote?.note ?? ""}
              </p>
            </div>
          </div>
        ) : (
          <DecisionForm
            alert={alert}
            establishments={establishments}
            onSubmit={async (payload) => {
              if (!token) return;
              await api.createDecision(token, alert.id, payload);
              await load();
            }}
          />
        )}
      </section>
    </div>
  );
}
