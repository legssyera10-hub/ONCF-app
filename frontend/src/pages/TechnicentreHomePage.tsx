import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { preloadRoute } from "../routes/lazyRoutes";

const sections = [
  {
    key: "acheminements",
    title: "Acheminements",
    description:
      "Acceder au module des demandes d'acheminement, incluant la partie Demande et la partie Reception.",
    to: "/technicentre/acheminements",
    action: "Entrer dans acheminements",
  },
  {
    key: "essais",
    title: "Essais en ligne",
    description: "Creer et suivre les demandes d'essais en ligne pour evaluer performance, qualite et conformite.",
    to: "/essais/dashboard",
    action: "Entrer dans essais en ligne",
  },
] as const;

export function TechnicentreHomePage() {
  const { token } = useAuth();
  const [receptionCount, setReceptionCount] = useState(0);
  const [modificationCount, setModificationCount] = useState(0);
  const [trialModificationCount, setTrialModificationCount] = useState(0);
  const [trialScheduledCount, setTrialScheduledCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.notifications(token), api.alerts(token, "?mine=true"), api.onlineTrials(token, "?mine=true")])
      .then(([notifications, alerts, trials]) => {
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
        setTrialModificationCount(trials.filter((item) => item.status === "A_MODIFIER").length);
        setTrialScheduledCount(trials.filter((item) => item.status === "TRAITEE_PAR_PM").length);
      })
      .catch(() => undefined);
  }, [token]);

  const sectionCount = useMemo(
    () => ({
      acheminements: receptionCount + modificationCount,
      essais: trialModificationCount + trialScheduledCount,
    }),
    [receptionCount, modificationCount, trialModificationCount, trialScheduledCount]
  );

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center">
      <div className="grid w-full gap-6 lg:grid-cols-2">
        {sections.map((section) => {
          const activeCount = sectionCount[section.key];
          const acheminementNotifications = [
            modificationCount > 0
              ? `${modificationCount} demande${modificationCount > 1 ? "s" : ""} d'acheminement a modifier`
              : null,
            receptionCount > 0
              ? `${receptionCount} reception${receptionCount > 1 ? "s" : ""} programmee${receptionCount > 1 ? "s" : ""}`
              : null,
          ].filter((item): item is string => Boolean(item));
          const trialNotifications = [
            trialModificationCount > 0
              ? `${trialModificationCount} demande${trialModificationCount > 1 ? "s" : ""} d'essai a modifier`
              : null,
            trialScheduledCount > 0
              ? `${trialScheduledCount} realisation${trialScheduledCount > 1 ? "s" : ""} d'essai programmee${
                  trialScheduledCount > 1 ? "s" : ""
                }`
              : null,
          ].filter((item): item is string => Boolean(item));
          const sectionNotifications = section.key === "acheminements" ? acheminementNotifications : trialNotifications;
          const badge =
            activeCount > 0
              ? sectionNotifications[0] ?? "Aucun signalement"
              : section.key === "acheminements"
                ? "Aucune action en attente"
                : "Aucun signalement";

          return (
            <NavLink
              key={section.to}
              to={section.to}
              onMouseEnter={() => preloadRoute(section.to)}
              onFocus={() => preloadRoute(section.to)}
              className="group panel flex min-h-[260px] flex-col justify-between overflow-hidden p-8 transition duration-200 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(15,23,42,0.38)]"
            >
              <div>
                <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">
                  Module
                </div>
                <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">{section.description}</p>
                {sectionNotifications.length > 0 ? (
                  <div className="mt-6 space-y-2">
                    {sectionNotifications.map((line) => (
                      <div
                        key={line}
                        className="home-alert-pill inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`mt-6 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                      activeCount > 0
                        ? "home-alert-pill border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {badge}
                  </div>
                )}
              </div>

              <div className="mt-10 flex items-center justify-between rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-4">
                <span className="text-sm font-semibold text-slate-900">{section.action}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-xl text-white transition duration-200 group-hover:translate-x-1">
                  -&gt;
                </span>
              </div>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
