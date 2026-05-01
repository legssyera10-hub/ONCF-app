import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { preloadRoute } from "../routes/lazyRoutes";

type RoleBackgroundConfig = {
  image: string;
  position: string;
};

type NavigationItem = {
  to: string;
  label: string;
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
  ADMIN: {
    image: "/dashboard-admin.jpg",
    position: "center 22%",
  },
  SUIVI: {
    image: "/dashboard-tracking.jpg",
    position: "center 26%",
  },
};

function getNavigation(role?: string): NavigationItem[] {
  switch (role) {
    case "AGENT":
    case "ETABLISSEMENT":
      return [
        { to: "/technicentre/reception", label: "Réception" },
        { to: "/technicentre/demande", label: "Demande" },
      ];
    case "PERMANENT":
      return [
        { to: "/permanent/dashboard", label: "Dashboard" },
        { to: "/permanent/map", label: "Carte Maroc" },
      ];
    case "SUIVI":
      return [
        { to: "/tracking/requests", label: "Dashboard" },
        { to: "/tracking/reception-quality", label: "Qualite reception" },
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

function getRoleLabel(role?: string) {
  switch (role) {
    case "AGENT":
      return "Technicentre";
    case "PERMANENT":
      return "Permanent PM";
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

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigation = getNavigation(user?.role);
  const heroConfig = roleBackgrounds[user?.role ?? ""] ?? defaultDashboardHero;
  const isTechnicentreHome =
    location.pathname === "/technicentre" ||
    location.pathname === "/technicentre/dashboard" ||
    location.pathname === "/establishment/dashboard";

  useEffect(() => {
    if (!user?.role) {
      return;
    }

    const routesByRole: Record<string, string[]> = {
      AGENT: ["/technicentre/reception", "/technicentre/demande", "/technicentre/demande/history"],
      ETABLISSEMENT: ["/technicentre/reception", "/technicentre/demande", "/technicentre/demande/history"],
      PERMANENT: ["/permanent/map"],
      SUIVI: ["/tracking/requests", "/tracking/reception-quality"],
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

  return (
    <div className={`${isTechnicentreHome ? "h-screen overflow-hidden" : "min-h-screen"} px-4 py-5 md:px-8 md:py-7`}>
      <div className={`mx-auto max-w-7xl ${isTechnicentreHome ? "flex h-full flex-col justify-center" : ""}`}>
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
            Déconnexion
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
                  Gestion d'acheminement du matériel roulant
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Espace de pilotage unifié pour la création, l'analyse, le suivi et la confirmation des
                  acheminements.
                </p>
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

            <div className="flex flex-col items-stretch gap-3 pt-6 xl:items-end xl:self-end xl:pt-0">
              {user?.role === "ADMIN" ? (
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onMouseEnter={() => handlePreload(item.to)}
                      onFocus={() => handlePreload(item.to)}
                      className={({ isActive }) => `nav-pill ${isActive ? "nav-pill-active" : "nav-pill-idle"}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}

              {user?.role !== "ADMIN" ? (
                <div className="flex flex-wrap gap-2">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onMouseEnter={() => handlePreload(item.to)}
                      onFocus={() => handlePreload(item.to)}
                      className={({ isActive }) => `nav-pill ${isActive ? "nav-pill-active" : "nav-pill-idle"}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`${isTechnicentreHome ? "flex flex-1 items-center" : "space-y-4"}`}>
          <div className={`animate-enter ${isTechnicentreHome ? "w-full" : ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
