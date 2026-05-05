import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const heroText =
  "Un espace simple pour gérer les demandes d'acheminement, suivre les décisions et piloter les acheminements ferroviaires.";

export function LoginPage() {
  const { login, user } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user?.role === "PERMANENT") {
    return <Navigate to="/permanent/dashboard" replace />;
  }
  if (user?.role === "AGENT" || user?.role === "ETABLISSEMENT") {
    return <Navigate to="/technicentre/dashboard" replace />;
  }
  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (user?.role === "PROJET") {
    return <Navigate to="/projet/essais/dashboard" replace />;
  }
  if (user?.role === "SUIVI") {
    return <Navigate to="/tracking/requests" replace />;
  }

  return (
    <div className="login-page flex h-screen items-center justify-center overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="grid h-full max-h-[820px] w-full max-w-[1280px] overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_35px_90px_-46px_rgba(15,23,42,0.14)] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex items-center bg-white px-4 py-5 md:px-7 lg:px-10 xl:px-14">
          <div className="mx-auto w-full max-w-[21rem]">
            <div className="login-mark">
              <div className="login-mark-icon">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3 5.5 5.5v5.8c0 4.3 2.8 8.3 6.5 9.7 3.7-1.4 6.5-5.4 6.5-9.7V5.5L12 3Z" />
                  <path d="m9.4 12.1 1.8 1.8 3.5-3.8" />
                </svg>
              </div>
            <h1 className="login-brand">ONCF</h1>
            </div>

            <p className="mt-4 text-[0.8rem] leading-6 text-slate-500">
              Connectez-vous pour accéder à votre espace de pilotage des acheminements et des opérations terrain.
            </p>

            <form
              className="mt-7 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  setError("");
                  await login(username, password);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erreur de connexion");
                }
              }}
            >
              <label className="block">
                <span className="mb-2 block text-[0.8rem] font-semibold text-slate-700">Identifiant</span>
                <div className="login-input-shell">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    className="login-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Saisir l'identifiant"
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[0.8rem] font-semibold text-slate-700">Mot de passe</span>
                </div>
                <div className="login-input-shell">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                  </svg>
                  <input
                    className="login-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Saisir le mot de passe"
                    autoComplete="current-password"
                  />
                </div>
              </label>

              {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

              <button className="login-submit" type="submit">
                Connexion sécurisée
                <span aria-hidden="true" className="text-lg leading-none">
                  →
                </span>
              </button>
            </form>

            <p className="mt-6 text-center text-[0.72rem] font-medium text-slate-400">
              © 2026 ONCF. Réseau interne sécurisé.
            </p>
          </div>
        </section>

        <section className="login-showcase relative hidden overflow-hidden lg:block">
          <div className="login-showcase-overlay" />
          <div className="login-showcase-grid" />
          <div className="login-showcase-content">
            <div className="login-showcase-pill">
              <span className="text-brand-300">∿</span>
              Plateforme opérationnelle ONCF
            </div>
            <h2 className="mt-5 max-w-[15ch] text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-white xl:text-[2.35rem]">
              Gestion ONCF
              <span className="block text-brand-300">des acheminements du matériel roulant</span>
            </h2>
            <p className="mt-4 max-w-[34rem] text-[0.8rem] leading-6 text-slate-200">{heroText}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
