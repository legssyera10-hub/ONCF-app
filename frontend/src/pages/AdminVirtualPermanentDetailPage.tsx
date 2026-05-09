import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { AdminMailRoutingSettings } from "../types";

type VirtualPermanentTarget = "pv" | "pfl";

export function AdminVirtualPermanentDetailPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { target } = useParams<{ target: string }>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const normalizedTarget = (target ?? "").toLowerCase() as VirtualPermanentTarget;
  const isValidTarget = normalizedTarget === "pv" || normalizedTarget === "pfl";
  const targetLabel = normalizedTarget === "pv" ? "PV" : "PFL";
  const permanentTitle = normalizedTarget === "pv" ? "Permanent PV" : "Permanent PFL";

  const payload = useMemo<AdminMailRoutingSettings>(() => {
    if (normalizedTarget === "pv") {
      return { permanent_pv_email: email.trim() || null };
    }
    return { permanent_pfl_email: email.trim() || null };
  }, [email, normalizedTarget]);

  useEffect(() => {
    if (!token || !isValidTarget) return;
    api
      .adminMailRouting(token)
      .then((settings) => {
        setEmail(
          normalizedTarget === "pv"
            ? settings.permanent_pv_email ?? ""
            : settings.permanent_pfl_email ?? "",
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur chargement"));
  }, [token, normalizedTarget, isValidTarget]);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    const dashboardRestore = sessionStorage.getItem("admin-dashboard-restore");
    if (dashboardRestore) {
      try {
        const parsed = JSON.parse(dashboardRestore) as { path?: string };
        if (parsed.path) {
          navigate(parsed.path);
          return;
        }
      } catch {
        // ignore and fallback below
      }
    }

    navigate("/admin/accounts");
  }

  if (!isValidTarget) {
    return <div className="panel p-6 text-sm text-rose-600">Permanent cible invalide.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleBack}
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
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{permanentTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">Notification exploitant</p>
        </div>
      </div>

      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}

      <section className="panel p-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            className="input"
            type="email"
            placeholder="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!token) return;
                try {
                  setError("");
                  setMessage("");
                  const updated = await api.updateAdminMailRouting(token, payload);
                  setEmail(
                    normalizedTarget === "pv"
                      ? updated.permanent_pv_email ?? ""
                      : updated.permanent_pfl_email ?? "",
                  );
                  setMessage(`Email notification ${targetLabel} mis a jour`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : `Erreur mise a jour ${targetLabel}`);
                }
              }}
            >
              Enregistrer {targetLabel}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (!token) return;
                try {
                  setError("");
                  setMessage("");
                  const result = await api.testAdminMailRouting(token, payload);
                  setMessage(result.message);
                } catch (err) {
                  setError(err instanceof Error ? err.message : `Erreur test ${targetLabel}`);
                }
              }}
            >
              Tester {targetLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
