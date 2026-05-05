export const loadAgentAlertDetailPage = () =>
  import("../pages/AgentAlertDetailPage").then((module) => ({ default: module.AgentAlertDetailPage }));

export const loadAgentDashboard = () =>
  import("../pages/AgentDashboard").then((module) => ({ default: module.AgentDashboard }));

export const loadAdminDashboard = () =>
  import("../pages/AdminDashboard").then((module) => ({ default: module.AdminDashboard }));

export const loadAdminRequestConfigPage = () =>
  import("../pages/AdminRequestConfigPage").then((module) => ({ default: module.AdminRequestConfigPage }));

export const loadAdminAlertDetailPage = () =>
  import("../pages/AdminAlertDetailPage").then((module) => ({ default: module.AdminAlertDetailPage }));

export const loadAdminUserDetailPage = () =>
  import("../pages/AdminUserDetailPage").then((module) => ({ default: module.AdminUserDetailPage }));

export const loadAdminVirtualPermanentDetailPage = () =>
  import("../pages/AdminVirtualPermanentDetailPage").then((module) => ({
    default: module.AdminVirtualPermanentDetailPage,
  }));

export const loadEstablishmentHistoryPage = () =>
  import("../pages/EstablishmentHistoryPage").then((module) => ({ default: module.EstablishmentHistoryPage }));

export const loadEstablishmentProgressPage = () =>
  import("../pages/EstablishmentProgressPage").then((module) => ({ default: module.EstablishmentProgressPage }));

export const loadLoginPage = () => import("../pages/LoginPage").then((module) => ({ default: module.LoginPage }));

export const loadNewAlertPage = () =>
  import("../pages/NewAlertPage").then((module) => ({ default: module.NewAlertPage }));

export const loadPermanentDashboard = () =>
  import("../pages/PermanentDashboard").then((module) => ({ default: module.PermanentDashboard }));

export const loadPermanentAlertDetailPage = () =>
  import("../pages/PermanentAlertDetailPage").then((module) => ({ default: module.PermanentAlertDetailPage }));

export const loadPermanentMapPage = () =>
  import("../pages/PermanentMapPage").then((module) => ({ default: module.PermanentMapPage }));

export const loadTechnicentreDemandPage = () =>
  import("../pages/TechnicentreDemandPage").then((module) => ({ default: module.TechnicentreDemandPage }));

export const loadTechnicentreModificationRequestsPage = () =>
  import("../pages/TechnicentreModificationRequestsPage").then((module) => ({
    default: module.TechnicentreModificationRequestsPage,
  }));

export const loadTechnicentreHomePage = () =>
  import("../pages/TechnicentreHomePage").then((module) => ({ default: module.TechnicentreHomePage }));

export const loadTechnicentreAcheminementsPage = () =>
  import("../pages/TechnicentreAcheminementsPage").then((module) => ({
    default: module.TechnicentreAcheminementsPage,
  }));

export const loadTechnicentreReceptionDetailPage = () =>
  import("../pages/TechnicentreReceptionDetailPage").then((module) => ({ default: module.TechnicentreReceptionDetailPage }));

export const loadTechnicentreReceptionHistoryPage = () =>
  import("../pages/TechnicentreReceptionHistoryPage").then((module) => ({ default: module.TechnicentreReceptionHistoryPage }));

export const loadTechnicentreReceptionListPage = () =>
  import("../pages/TechnicentreReceptionListPage").then((module) => ({ default: module.TechnicentreReceptionListPage }));

export const loadTechnicentreRequestHistoryPage = () =>
  import("../pages/TechnicentreRequestHistoryPage").then((module) => ({ default: module.TechnicentreRequestHistoryPage }));

export const loadTrackingRequestsVisionPage = () =>
  import("../pages/TrackingRequestsVisionPage").then((module) => ({ default: module.TrackingRequestsVisionPage }));

export const loadTrackingReceptionQualityPage = () =>
  import("../pages/TrackingReceptionQualityPage").then((module) => ({ default: module.TrackingReceptionQualityPage }));

export const loadOnlineTrialDashboardPage = () =>
  import("../pages/OnlineTrialDashboardPage").then((module) => ({ default: module.OnlineTrialDashboardPage }));

export const loadOnlineTrialHistoryPage = () =>
  import("../pages/OnlineTrialHistoryPage").then((module) => ({ default: module.OnlineTrialHistoryPage }));

export const loadOnlineTrialNewPage = () =>
  import("../pages/OnlineTrialNewPage").then((module) => ({ default: module.OnlineTrialNewPage }));

export const loadOnlineTrialDetailPage = () =>
  import("../pages/OnlineTrialDetailPage").then((module) => ({ default: module.OnlineTrialDetailPage }));

export const loadPermanentOnlineTrialDashboardPage = () =>
  import("../pages/PermanentOnlineTrialDashboardPage").then((module) => ({
    default: module.PermanentOnlineTrialDashboardPage,
  }));

export const loadPermanentOnlineTrialDetailPage = () =>
  import("../pages/PermanentOnlineTrialDetailPage").then((module) => ({
    default: module.PermanentOnlineTrialDetailPage,
  }));

export const loadTrackingOnlineTrialsPage = () =>
  import("../pages/TrackingOnlineTrialsPage").then((module) => ({ default: module.TrackingOnlineTrialsPage }));

export const loadTrackingOnlineTrialsPerformancePage = () =>
  import("../pages/TrackingOnlineTrialsPerformancePage").then((module) => ({
    default: module.TrackingOnlineTrialsPerformancePage,
  }));

const routePreloaders: Array<[prefix: string, load: () => Promise<unknown>]> = [
  ["/login", loadLoginPage],
  ["/technicentre/reception/history/", loadTechnicentreReceptionDetailPage],
  ["/technicentre/reception/history", loadTechnicentreReceptionHistoryPage],
  ["/technicentre/reception/", loadTechnicentreReceptionDetailPage],
  ["/technicentre/reception", loadTechnicentreReceptionListPage],
  ["/technicentre/demande/modifications", loadTechnicentreModificationRequestsPage],
  ["/technicentre/demande/history/", loadAgentAlertDetailPage],
  ["/technicentre/demande/history", loadTechnicentreRequestHistoryPage],
  ["/technicentre/demande/create", loadNewAlertPage],
  ["/technicentre/demande", loadTechnicentreDemandPage],
  ["/technicentre/acheminements", loadTechnicentreAcheminementsPage],
  ["/technicentre/alerts/new", loadNewAlertPage],
  ["/technicentre/alerts/", loadAgentAlertDetailPage],
  ["/technicentre/alerts", loadTechnicentreRequestHistoryPage],
  ["/technicentre/history", loadTechnicentreReceptionHistoryPage],
  ["/technicentre", loadTechnicentreHomePage],
  ["/agent/alerts/new", loadNewAlertPage],
  ["/agent/alerts/", loadAgentAlertDetailPage],
  ["/agent/alerts", loadAgentDashboard],
  ["/agent/dashboard", loadAgentDashboard],
  ["/establishment/history", loadEstablishmentHistoryPage],
  ["/establishment/progress", loadEstablishmentProgressPage],
  ["/establishment/dashboard", loadTechnicentreHomePage],
  ["/admin/users/", loadAdminUserDetailPage],
  ["/admin/permanents/", loadAdminVirtualPermanentDetailPage],
  ["/admin/request-config", loadAdminRequestConfigPage],
  ["/admin/accounts", loadAdminDashboard],
  ["/admin/dashboard", loadAdminDashboard],
  ["/permanent/dashboard/", loadPermanentAlertDetailPage],
  ["/permanent/essais/", loadPermanentOnlineTrialDetailPage],
  ["/permanent/essais", loadPermanentOnlineTrialDashboardPage],
  ["/permanent/map", loadPermanentMapPage],
  ["/permanent/dashboard", loadPermanentDashboard],
  ["/projet/essais/history/", loadOnlineTrialDetailPage],
  ["/projet/essais/history", loadOnlineTrialHistoryPage],
  ["/projet/essais/new", loadOnlineTrialNewPage],
  ["/projet/essais/", loadOnlineTrialDetailPage],
  ["/projet/essais", loadOnlineTrialDashboardPage],
  ["/essais/history/", loadOnlineTrialDetailPage],
  ["/essais/history", loadOnlineTrialHistoryPage],
  ["/essais/new", loadOnlineTrialNewPage],
  ["/essais/", loadOnlineTrialDetailPage],
  ["/essais", loadOnlineTrialDashboardPage],
  ["/tracking/essais/performance", loadTrackingOnlineTrialsPerformancePage],
  ["/tracking/essais", loadTrackingOnlineTrialsPage],
  ["/tracking/reception-quality", loadTrackingReceptionQualityPage],
  ["/tracking/requests", loadTrackingRequestsVisionPage],
];

const preloadedRoutes = new Set<string>();

export function preloadRoute(route: string) {
  const match = routePreloaders.find(([prefix]) => route.startsWith(prefix));
  if (!match) {
    return;
  }

  const [prefix, load] = match;
  if (preloadedRoutes.has(prefix)) {
    return;
  }

  preloadedRoutes.add(prefix);
  void load();
}
