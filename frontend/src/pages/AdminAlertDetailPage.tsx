import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AlertRequestDetailsGrid, DossierRouteText } from "../components/AlertRequestDetailsGrid";
import { GeneratePdfButton } from "../components/GeneratePdfButton";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { Alert } from "../types";
import { API_BASE_URL } from "../utils/api";
import { formatDateTime } from "../utils/format";

export function AdminAlertDetailPage() {
  const { token } = useAuth();
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!token || !alertId) return;
    api.alertById(token, Number(alertId))
      .then(setAlert)
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement"));
  }, [token, alertId]);

  if (error) {
    return <div className="panel border border-rose-200 p-6 text-sm text-rose-600">{error}</div>;
  }

  if (!alert) {
    return <div className="panel p-6 text-sm text-slate-500">Chargement de la demande d'acheminement...</div>;
  }

  return (
    <div className="space-y-6">
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
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
          <div className="mt-3 flex w-full flex-wrap items-center gap-4">
            <h2 className="min-w-0 flex-1 text-2xl font-semibold text-slate-950">
              Dossier #{alert.dossier_label ?? alert.id} · <DossierRouteText alert={alert} />
            </h2>
            <div className="ml-auto">
              <div className="flex items-center gap-2">
                <GeneratePdfButton alert={alert} />
                <button
                  type="button"
                  disabled={deleting}
                  className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={async () => {
                    if (!token || deleting) return;
                    if (!window.confirm(`Supprimer définitivement le dossier #${alert.dossier_label ?? alert.id} ?`)) {
                      return;
                    }
                    try {
                      setDeleting(true);
                      setError("");
                      setMessage("");
                      await api.deleteAdminAlert(token, alert.id);
                      navigate(-1);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur suppression dossier");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? "Suppression..." : "Supprimer le dossier"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Dossier #{alert.dossier_label ?? alert.id}</p>
            <p className="text-sm text-slate-500">Création : {formatDateTime(alert.created_at)}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge
              status={alert.status}
              materialConfirmations={alert.establishment_confirmation?.material_confirmations}
            />
          </div>
        </div>

        <AlertRequestDetailsGrid alert={alert} />

        {alert.attachments.length > 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pièces jointes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {alert.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-700"
                  href={`${API_BASE_URL}${attachment.stored_path}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {attachment.filename}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
