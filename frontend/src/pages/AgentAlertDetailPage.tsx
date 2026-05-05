import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AlertRequestDetailsGrid, DossierRouteText } from "../components/AlertRequestDetailsGrid";
import { GeneratePdfButton } from "../components/GeneratePdfButton";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { Alert } from "../types";
import { getPermanentDecisionReason } from "../utils/alertHistory";

export function AgentAlertDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [mineAlerts, setMineAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!token || !id) {
      return;
    }
    Promise.all([api.alertById(token, Number(id)), api.alerts(token, "?mine=true")]).then(([alertResult, mineResult]) => {
      setAlert(alertResult);
      setMineAlerts(mineResult);
    });
  }, [token, id]);

  if (!alert) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement...</div>;
  }

  const permanentDecisionReason = getPermanentDecisionReason(alert);
  const dossierRootId = alert.dossier_parent_id ?? alert.id;
  const currentIteration = alert.dossier_iteration ?? 0;
  const hasNewerVersion = mineAlerts.some((item) => {
    const itemRootId = item.dossier_parent_id ?? item.id;
    return itemRootId === dossierRootId && item.id !== alert.id && (item.dossier_iteration ?? 0) > currentIteration;
  });
  const canModifyCurrentAlert = alert.status === "A_MODIFIER" && !hasNewerVersion;

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <div className="space-y-4">
          <div className="flex w-full flex-wrap items-center gap-4">
            <h2 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight text-slate-950">
              Dossier #{alert.dossier_label ?? alert.id} - <DossierRouteText alert={alert} />
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

        <div className="mt-6">
          <AlertRequestDetailsGrid alert={alert} />
        </div>
      </section>

      {alert.status === "A_MODIFIER" || alert.status === "MODIFIEE" ? (
        <section
          className={`panel p-6 ${
            alert.status === "MODIFIEE" ? "border border-fuchsia-200 bg-fuchsia-50" : "border border-amber-200 bg-amber-50"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {alert.status === "MODIFIEE" ? "Demande modifiée" : "Demande de modification"}
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{permanentDecisionReason ?? "-"}</p>
          {alert.status === "A_MODIFIER" && canModifyCurrentAlert ? (
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => navigate(`/technicentre/alerts/${alert.id}/edit`)}
            >
              Modifier la demande
            </button>
          ) : alert.status === "A_MODIFIER" ? (
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Version plus recente deja creee, modification desactivee pour ce dossier.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
