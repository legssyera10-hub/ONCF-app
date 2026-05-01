import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AlertTimeline } from "./AlertTimeline";
import { StatusBadge } from "./StatusBadge";
import { useAuth } from "../hooks/useAuth";
import type { Alert } from "../types";
import { API_BASE_URL } from "../utils/api";
import { formatDateTime, formatDelayMinutes, parseApiDate } from "../utils/format";

type TechnicentreAlertPreviewPanelProps = {
  alertId?: number | null;
  mode: "reception" | "demande";
  returnTo: string;
  fullPath: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

type PanelBodyProps = {
  alertId?: number | null;
  alert: Alert | null;
  loading: boolean;
  mode: "reception" | "demande";
  returnTo: string;
  fullPath: string;
  onMobileClose?: () => void;
};

function PanelBody({ alertId, alert, loading, mode, returnTo, fullPath, onMobileClose }: PanelBodyProps) {
  const latestHistoryNote = useMemo(
    () =>
      alert?.history
        .slice()
        .reverse()
        .find((item) => item.note?.trim()),
    [alert]
  );

  if (!alertId) {
    return (
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Aperçu dossier</p>
        <h3 className="mt-3 text-lg font-semibold text-slate-950">Sélectionnez un dossier</h3>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          Le détail s'affiche ici sans quitter la liste pour accélérer la consultation métier.
        </p>
      </div>
    );
  }

  if (loading || !alert) {
    return (
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Aperçu dossier</p>
        <div className="mt-4 space-y-4">
          <div className="h-7 w-2/3 rounded-xl bg-slate-200" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-[86%] rounded-full bg-slate-100" />
          <div className="h-28 rounded-2xl bg-slate-50" />
          <div className="h-40 rounded-2xl bg-slate-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Aperçu dossier</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{alert.material_ref}</h3>
          <p className="mt-1 text-sm text-slate-500">{alert.station.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={alert.status}
            materialConfirmations={alert.establishment_confirmation?.material_confirmations}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Navigation rapide : <span className="font-semibold text-slate-700">↑</span> / <span className="font-semibold text-slate-700">↓</span>
        {" "}ou <span className="font-semibold text-slate-700">K</span> / <span className="font-semibold text-slate-700">J</span>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Motif</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{alert.problem_description}</p>
        </div>

        {mode === "reception" ? (
          <>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Destination</p>
              <p className="mt-2 text-sm text-slate-700">
                {alert.permanent_decision?.destination_establishment.name ??
                  alert.requested_destination_establishment?.name ??
                  "-"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Réception</p>
                <p className="mt-2 text-sm text-slate-700">
                  {alert.establishment_confirmation
                    ? ["RECEPTION_PARTIELLE"].includes(alert.status)
                      ? `Partielle le ${formatDateTime(alert.establishment_confirmation.confirmed_at)}`
                      : `Confirmée le ${formatDateTime(alert.establishment_confirmation.confirmed_at)}`
                    : "En attente"}
                </p>
                {alert.establishment_confirmation ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Retard : {formatDelayMinutes(alert.establishment_confirmation.delay_minutes)}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Destination demandée</p>
              <p className="mt-2 text-sm text-slate-700">
                {alert.requested_destination_establishment?.name ?? "Destination non renseignée"}
              </p>
            </div>
            {latestHistoryNote ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Dernière note métier</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{latestHistoryNote.note}</p>
              </div>
            ) : null}
          </>
        )}

        {alert.attachments.length > 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pièces jointes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {alert.attachments.slice(0, 3).map((attachment) => (
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

        {alert.revisions.length > 0 && mode === "demande" ? (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Dernière version archivée</p>
            <p className="mt-2 text-sm text-slate-700">
              Version {alert.revisions[0].revision_number} ·{" "}
              {parseApiDate(alert.revisions[0].archived_at)?.toLocaleString() ?? alert.revisions[0].archived_at}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline</p>
        <div className="max-h-[24rem] overflow-auto pr-1">
          <AlertTimeline history={alert.history} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Link to={fullPath} state={{ returnTo }} className="btn-primary w-full" onClick={onMobileClose}>
          Ouvrir le dossier complet
        </Link>
        {onMobileClose ? (
          <button type="button" className="btn-secondary w-full xl:hidden" onClick={onMobileClose}>
            Fermer l'aperçu
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TechnicentreAlertPreviewPanel({
  alertId,
  mode,
  returnTo,
  fullPath,
  mobileOpen = false,
  onMobileClose,
}: TechnicentreAlertPreviewPanelProps) {
  const { token } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token || !alertId) {
        setAlert(null);
        return;
      }

      setLoading(true);
      try {
        const result = await api.alertById(token, alertId);
        if (!cancelled) {
          setAlert(result);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [alertId, token]);

  return (
    <>
      <aside className="hidden panel xl:sticky xl:top-6 xl:block">
        <PanelBody
          alertId={alertId}
          alert={alert}
          loading={loading}
          mode={mode}
          returnTo={returnTo}
          fullPath={fullPath}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 xl:hidden" onClick={onMobileClose}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-[2rem] bg-white shadow-[0_-24px_80px_-24px_rgba(15,23,42,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Détail mobile</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {alert?.material_ref ?? "Chargement du dossier"}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={onMobileClose}>
                Fermer
              </button>
            </div>

            <PanelBody
              alertId={alertId}
              alert={alert}
              loading={loading}
              mode={mode}
              returnTo={returnTo}
              fullPath={fullPath}
              onMobileClose={onMobileClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
