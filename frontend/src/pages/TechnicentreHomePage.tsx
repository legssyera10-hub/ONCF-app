import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { preloadRoute } from "../routes/lazyRoutes";

const sections = [
  {
    title: "Réception",
    description:
      "Consulter les dossiers de réception destinés à ce technicentre, ouvrir chaque dossier et confirmer la réception.",
    to: "/technicentre/reception",
    action: "Ouvrir la réception",
  },
  {
    title: "Demande",
    description: "Créer une demande d'acheminement et consulter l'historique complet de vos dossiers.",
    to: "/technicentre/demande",
    action: "Ouvrir la demande",
  },
] as const;

export function TechnicentreHomePage() {
  const { token } = useAuth();
  const [receptionCount, setReceptionCount] = useState(0);
  const [modificationCount, setModificationCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.notifications(token), api.alerts(token, "?mine=true")])
      .then(([notifications, alerts]) => {
        const pendingReceptions = notifications.filter((item) =>
          ["TRAITEE_PAR_PM", "RECEPTION_PARTIELLE"].includes(item.alert.status)
        ).length;
        setReceptionCount(pendingReceptions);

        const latestIterationByRoot = new Map<number, number>();
        for (const item of alerts) {
          const rootId = item.dossier_parent_id ?? item.id;
          const iteration = item.dossier_iteration ?? 0;
          const currentMax = latestIterationByRoot.get(rootId);
          if (currentMax === undefined || iteration > currentMax) {
            latestIterationByRoot.set(rootId, iteration);
          }
        }

        const actionableModificationCount = alerts.filter((item) => {
          if (item.status !== "A_MODIFIER") {
            return false;
          }
          const rootId = item.dossier_parent_id ?? item.id;
          const latestIteration = latestIterationByRoot.get(rootId) ?? 0;
          return (item.dossier_iteration ?? 0) >= latestIteration;
        }).length;

        setModificationCount(actionableModificationCount);
      })
      .catch(() => undefined);
  }, [token]);

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-center">
      <div className="grid w-full gap-6 lg:grid-cols-2">
        {sections.map((section) => {
          const isDemand = section.title === "Demande";
          const activeCount = isDemand ? modificationCount : receptionCount;
          const targetPath = isDemand && activeCount > 0 ? "/technicentre/demande/modifications" : section.to;
          const badge =
            activeCount > 0
              ? isDemand
                ? `${activeCount} signalement${activeCount > 1 ? "s" : ""} de modification`
                : `${activeCount} reception${activeCount > 1 ? "s" : ""} programmee${activeCount > 1 ? "s" : ""}`
              : isDemand
                ? "Aucun signalement"
                : "Aucune reception";

          return (
            <NavLink
              key={section.to}
              to={targetPath}
              onMouseEnter={() => preloadRoute(targetPath)}
              onFocus={() => preloadRoute(targetPath)}
              className="group panel flex min-h-[260px] flex-col justify-between overflow-hidden p-8 transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.38)]"
            >
              <div>
                <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
                  Espace {section.title}
                </div>
                <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">{section.description}</p>
                <div
                  className={`mt-6 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    activeCount > 0
                      ? "home-alert-pill border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {badge}
                </div>
              </div>

              <div className="mt-10 flex items-center justify-between rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-4">
                <span className="text-sm font-semibold text-slate-900">{section.action}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-xl text-white transition duration-200 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
