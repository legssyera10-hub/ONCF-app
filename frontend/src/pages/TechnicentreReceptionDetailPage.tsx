import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { AlertRequestDetailsGrid, DossierRouteText } from "../components/AlertRequestDetailsGrid";
import { ConfirmationForm } from "../components/ConfirmationForm";
import { GeneratePdfButton } from "../components/GeneratePdfButton";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { Alert } from "../types";

export function TechnicentreReceptionDetailPage() {
  const { token } = useAuth();
  const { id } = useParams();
  const [alert, setAlert] = useState<Alert | null>(null);

  async function load() {
    if (!token || !id) {
      return;
    }
    const result = await api.alertById(token, Number(id));
    setAlert(result);
  }

  useEffect(() => {
    void load();
  }, [token, id]);

  if (!alert) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement...</div>;
  }

  const canConfirmReception =
    !alert.establishment_confirmation ||
    ["TRAITEE_PAR_PM", "RECEPTION_PARTIELLE"].includes(alert.status);

  return (
    <div className="space-y-6">
      <section className="panel flex flex-col gap-5 p-6">
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

        <div className="mt-2">
          <AlertRequestDetailsGrid alert={alert} title="Details du dossier" />
        </div>
      </section>

      {canConfirmReception ? (
        <section className="panel p-6">
          <h3 className="text-lg font-semibold text-slate-950">Decision de reception</h3>
          <div className="mt-4">
            <ConfirmationForm
              alert={alert}
              onSubmit={async (payload) => {
                if (!token) {
                  return;
                }
                await api.confirmReception(token, alert.id, payload);
                await load();
              }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
