import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import { useAuth } from "../hooks/useAuth";
import { preloadRoute } from "../routes/lazyRoutes";
import { PageBreadcrumbs } from "../components/PageBreadcrumbs";

type RoleBackgroundConfig = {
  image: string;
  position: string;
};

type NavigationItem = {
  to: string;
  label: string;
  icon?: "home";
};

const defaultDashboardHero: RoleBackgroundConfig = {
  image: "/dashboard-hero.jpg",
  position: "center 24%",
};

const roleBackgrounds: Partial<Record<string, RoleBackgroundConfig>> = {
  AGENT: {
    image: "/dashboard-agent.jpg",
    position: "center 24%",
  },
  PERMANENT: {
    image: "/dashboard-permanent.jpg",
    position: "center 24%",
  },
  ETABLISSEMENT: {
    image: "/dashboard-establishment.jpg",
    position: "center 28%",
  },
  PROJET: {
    image: "/dashboard-establishment.jpg",
    position: "center 30%",
  },
  ADMIN: {
    image: "/dashboard-admin.jpg",
    position: "center 22%",
  },
  SUIVI: {
    image: "/dashboard-tracking.jpg",
    position: "center 26%",
  },
};

function getNavigation(role?: string, pathname?: string): NavigationItem[] {
  switch (role) {
    case "AGENT":
    case "ETABLISSEMENT":
      return [{ to: "/technicentre", label: "Accueil", icon: "home" }];
    case "PROJET":
      return [
        { to: "/projet/essais/dashboard", label: "Dashboard essais" },
        { to: "/projet/essais/history", label: "Historique essais" },
      ];
    case "PERMANENT":
      return [
        { to: "/permanent/dashboard", label: "Acheminement" },
        { to: "/permanent/map", label: "Carte Maroc" },
        { to: "/permanent/essais", label: "Essais en ligne" },
      ];
    case "SUIVI":
      return [
        { to: "/tracking/requests", label: "Dashboard" },
        { to: "/tracking/reception-quality", label: "Qualite reception" },
        { to: "/tracking/essais", label: "Suivi essais" },
        { to: "/tracking/essais/performance", label: "Performance essais" },
      ];
    case "ADMIN":
      return [
        { to: "/admin/dashboard", label: "Dashboard" },
        { to: "/admin/accounts", label: "Gestion des comptes" },
        { to: "/admin/request-config", label: "Configuration demandes" },
      ];
    default:
      return [];
  }
}

function getTechnicentreBreadcrumbs(pathname: string) {
  const home = { label: "Accueil", to: "/technicentre" };

  if (pathname === "/technicentre" || pathname === "/technicentre/dashboard" || pathname === "/establishment/dashboard") {
    return [{ label: "Accueil" }];
  }

  if (pathname === "/technicentre/acheminements") {
    return [home, { label: "Acheminements" }];
  }

  if (pathname.startsWith("/technicentre/reception")) {
    const base = [home, { label: "Acheminements", to: "/technicentre/acheminements" }];
    if (pathname.includes("/history")) {
      return [...base, { label: "Historique reception" }];
    }
    if (/\/technicentre\/reception\/\d+/.test(pathname)) {
      return [...base, { label: "Dossier reception" }];
    }
    return [...base, { label: "Reception" }];
  }

  if (pathname.startsWith("/technicentre/demande")) {
    const base = [home, { label: "Acheminements", to: "/technicentre/acheminements" }];
    if (pathname.endsWith("/create")) {
      return [...base, { label: "Nouvelle demande" }];
    }
    if (pathname.endsWith("/modifications")) {
      return [...base, { label: "Demandes a modifier" }];
    }
    if (pathname.includes("/history/")) {
      return [...base, { label: "Detail demande" }];
    }
    if (pathname.endsWith("/history")) {
      return [...base, { label: "Historique demandes" }];
    }
    return [...base, { label: "Demande" }];
  }

  if (pathname.startsWith("/essais")) {
    const base = [home, { label: "Essais en ligne", to: "/essais/dashboard" }];
    if (pathname === "/essais/dashboard" || pathname === "/essais") {
      return [home, { label: "Essais en ligne" }];
    }
    if (pathname.endsWith("/new")) {
      return [...base, { label: "Nouvelle demande d'essai" }];
    }
    if (pathname.includes("/history/")) {
      return [...base, { label: "Dossier essai" }];
    }
    if (pathname.endsWith("/history")) {
      return [...base, { label: "Historique essais" }];
    }
    if (pathname.endsWith("/edit")) {
      return [...base, { label: "Modifier dossier essai" }];
    }
    if (/\/essais\/\d+/.test(pathname)) {
      return [...base, { label: "Dossier essai" }];
    }
    return [home, { label: "Essais en ligne" }];
  }

  if (pathname.startsWith("/establishment/progress")) {
    return [home, { label: "Suivi reception" }];
  }

  if (pathname.startsWith("/establishment/history")) {
    return [home, { label: "Historique reception" }];
  }

  return [home, { label: "Page technicentre" }];
}

function getRoleLabel(role?: string) {
  switch (role) {
    case "AGENT":
      return "Technicentre";
    case "PERMANENT":
      return "Permanent PPM";
    case "PROJET":
      return "Compte Projet";
    case "SUIVI":
      return "Visionnement demandes";
    case "ETABLISSEMENT":
      return "Technicentre";
    case "ADMIN":
      return "Administration";
    default:
      return "";
  }
}

function getHeroTitle(role?: string, pathname?: string) {
  if (role === "AGENT" || role === "ETABLISSEMENT") {
    if (pathname?.startsWith("/essais")) {
      return "Gestion des essais en ligne du materiel roulant";
    }
    if (
      pathname?.startsWith("/technicentre/acheminements") ||
      pathname?.startsWith("/technicentre/reception") ||
      pathname?.startsWith("/technicentre/demande")
    ) {
      return "Gestion d'acheminement du materiel roulant";
    }
    return "Gestion d'acheminement et d'essais en ligne du materiel roulant";
  }
  return "Gestion d'acheminement et d'essais en ligne du materiel roulant";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingTransportDecisionCount, setPendingTransportDecisionCount] = useState(0);
  const [pendingTrialDecisionCount, setPendingTrialDecisionCount] = useState(0);
  const navigation = getNavigation(user?.role, location.pathname);
  const heroTitle = getHeroTitle(user?.role, location.pathname);
  const heroConfig = roleBackgrounds[user?.role ?? ""] ?? defaultDashboardHero;
  const isTechnicentreRole = user?.role === "AGENT" || user?.role === "ETABLISSEMENT";
  const hideTechnicentreContextNavbar =
    location.pathname === "/technicentre" ||
    location.pathname === "/technicentre/dashboard" ||
    location.pathname === "/technicentre/acheminements" ||
    location.pathname === "/establishment/dashboard";
  const technicentreBreadcrumbs = isTechnicentreRole ? getTechnicentreBreadcrumbs(location.pathname) : [];
  const technicentreCurrentPage =
    technicentreBreadcrumbs.length > 0 ? technicentreBreadcrumbs[technicentreBreadcrumbs.length - 1].label : "";
  const isTechnicentreLanding =
    location.pathname === "/technicentre" ||
    location.pathname === "/technicentre/dashboard" ||
    location.pathname === "/technicentre/acheminements" ||
    location.pathname === "/establishment/dashboard";
  const isTechnicentreHome =
    location.pathname === "/technicentre" ||
    location.pathname === "/technicentre/dashboard" ||
    location.pathname === "/technicentre/acheminements" ||
    location.pathname === "/establishment/dashboard" ||
    location.pathname === "/projet/essais/dashboard";

  const refreshPermanentNotificationBadges = useCallback(() => {
    if (!token || user?.role !== "PERMANENT") {
      setPendingTransportDecisionCount(0);
      setPendingTrialDecisionCount(0);
      return;
    }
    Promise.all([api.alerts(token), api.onlineTrials(token)])
      .then(([alerts, trials]) => {
        const pendingTransportCount = alerts.filter((item) => item.status === "EN_COURS_DE_TRAITEMENT").length;
        const pendingCount = trials.filter((item) => item.status === "EN_COURS_DE_TRAITEMENT").length;
        setPendingTransportDecisionCount(pendingTransportCount);
        setPendingTrialDecisionCount(pendingCount);
      })
      .catch(() => undefined);
  }, [token, user?.role]);

  useEffect(() => {
    refreshPermanentNotificationBadges();
  }, [refreshPermanentNotificationBadges]);

  useLiveAlerts(Boolean(token && user?.role === "PERMANENT"), refreshPermanentNotificationBadges);

  useEffect(() => {
    if (!user?.role) {
      return;
    }

    const routesByRole: Record<string, string[]> = {
      AGENT: ["/technicentre/acheminements", "/technicentre/reception", "/technicentre/demande", "/essais/history"],
      ETABLISSEMENT: ["/technicentre/acheminements", "/technicentre/reception", "/technicentre/demande", "/essais/history"],
      PROJET: ["/projet/essais/new", "/projet/essais/history"],
      PERMANENT: ["/permanent/map", "/permanent/essais"],
      SUIVI: ["/tracking/requests", "/tracking/reception-quality", "/tracking/essais", "/tracking/essais/performance"],
      ADMIN: ["/admin/accounts", "/admin/request-config"],
    };

    const warmup = () => {
      routesByRole[user.role]?.forEach((route) => preloadRoute(route));
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warmup, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(warmup, 280);
    return () => globalThis.clearTimeout(timeoutId);
  }, [user?.role]);

  const handlePreload = (route: string) => {
    preloadRoute(route);
  };

  const handleTechnicentreBack = () => {
    if (!isTechnicentreRole) {
      return;
    }
    if (location.pathname === "/technicentre" || location.pathname === "/technicentre/dashboard") {
      navigate("/technicentre");
      return;
    }
    navigate(-1);
  };

  return (
    <div className={`${isTechnicentreLanding ? "h-screen overflow-hidden" : "min-h-screen"} px-4 py-5 md:px-8 md:py-7`}>
      <div
        className={`mx-auto max-w-7xl ${
          isTechnicentreLanding
            ? "flex h-full flex-col justify-center"
            : isTechnicentreHome
              ? "flex min-h-[calc(100vh-3.5rem)] flex-col justify-center"
              : ""
        }`}
      >
        <div
          className={`panel-shell relative overflow-hidden rounded-[2rem] px-6 py-5 md:px-8 ${isTechnicentreHome ? "mb-4" : "mb-6"}`}
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(4, 7, 18, 0.84), rgba(8, 18, 36, 0.7)), url("${heroConfig.image}"), linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(15, 23, 42, 0.96))`,
            backgroundSize: "cover",
            backgroundPosition: heroConfig.position,
            backgroundRepeat: "no-repeat",
          }}
        >
          <button className="btn-logout absolute right-6 top-6 md:right-8 md:top-8" onClick={logout}>
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
              <path d="M14 3h-4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
              <path d="M13 12h8" />
              <path d="m18 7 5 5-5 5" />
            </svg>
            Deconnexion
          </button>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-1 py-1">
                  <img
                    src="/logo-ONCF.jpg"
                    alt="ONCF"
                    className="h-10 w-auto object-contain mix-blend-multiply contrast-125 saturate-125"
                  />
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {heroTitle}
                </h1>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-slate-200"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="8" r="4" />
                    </svg>
                    <p className="font-semibold text-white">{user?.full_name}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 pt-6 xl:items-end xl:self-end xl:pb-1 xl:pt-0">
              {navigation.length > 0 ? (
                <div
                  className={`nav-pill-row ${user?.role === "ADMIN" || isTechnicentreRole ? "xl:justify-end" : ""}`}
                >
                  {navigation.map((item) => {
                    const isPermanentNavItem = user?.role === "PERMANENT" && !item.icon;
                    const isPermanentEssaisButton = user?.role === "PERMANENT" && item.to === "/permanent/essais";
                    const showTransportBadge =
                      user?.role === "PERMANENT" &&
                      item.to === "/permanent/dashboard" &&
                      pendingTransportDecisionCount > 0;
                    const transportBadgeLabel =
                      pendingTransportDecisionCount > 99 ? "99+" : String(pendingTransportDecisionCount);
                    const showTrialBadge =
                      user?.role === "PERMANENT" &&
                      item.to === "/permanent/essais" &&
                      pendingTrialDecisionCount > 0;
                    const trialBadgeLabel =
                      pendingTrialDecisionCount > 99 ? "99+" : String(pendingTrialDecisionCount);
                    const badgeLabel = showTransportBadge ? transportBadgeLabel : showTrialBadge ? trialBadgeLabel : null;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onMouseEnter={() => handlePreload(item.to)}
                        onFocus={() => handlePreload(item.to)}
                        className={({ isActive }) => {
                          const forceActiveHome = isTechnicentreRole && item.icon === "home";
                          return `nav-pill ${item.icon ? "nav-pill-with-icon" : ""} ${isPermanentNavItem ? "nav-pill-permanent" : ""} ${isPermanentEssaisButton ? "nav-pill-module-break" : ""} ${badgeLabel ? "relative" : ""} ${isActive || forceActiveHome ? "nav-pill-active" : "nav-pill-idle"}`;
                        }}
                      >
                        {item.icon === "home" ? (
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
                            <path d="M3 11.5 12 4l9 7.5" />
                            <path d="M5 10.5V20h14v-9.5" />
                          </svg>
                        ) : null}
                        <span>{item.label}</span>
                        {badgeLabel ? (
                          <span className="pointer-events-none absolute -right-1 -top-1 z-30 inline-flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[0.67rem] font-bold leading-none text-white shadow-[0_10px_20px_-12px_rgba(220,38,38,1)]">
                            {badgeLabel}
                          </span>
                        ) : null}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isTechnicentreRole && !hideTechnicentreContextNavbar ? (
          <div className={`${isTechnicentreHome ? "mb-3" : "mb-4"} panel px-4 py-3 md:px-5`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={handleTechnicentreBack}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
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
                  <path d="M15 6 9 12l6 6" />
                </svg>
                Retour
              </button>

              <div className="min-w-0">
                <PageBreadcrumbs items={technicentreBreadcrumbs} />
              </div>

              <div className="inline-flex w-fit items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">
                {technicentreCurrentPage}
              </div>
            </div>
          </div>
        ) : null}

        <div className={`${isTechnicentreHome ? "flex flex-1 items-center" : "space-y-4"}`}>
          <div className={`animate-enter ${isTechnicentreHome ? "w-full" : ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
