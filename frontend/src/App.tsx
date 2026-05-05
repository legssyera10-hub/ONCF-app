import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PageSkeleton } from "./components/PageSkeleton";
import { AppShell } from "./layouts/AppShell";
import { useAuth } from "./hooks/useAuth";
import {
  loadAdminAlertDetailPage,
  loadAdminDashboard,
  loadAdminRequestConfigPage,
  loadAdminUserDetailPage,
  loadAdminVirtualPermanentDetailPage,
  loadAgentAlertDetailPage,
  loadAgentDashboard,
  loadEstablishmentHistoryPage,
  loadEstablishmentProgressPage,
  loadLoginPage,
  loadNewAlertPage,
  loadPermanentAlertDetailPage,
  loadPermanentDashboard,
  loadPermanentOnlineTrialDashboardPage,
  loadPermanentOnlineTrialDetailPage,
  loadPermanentMapPage,
  loadOnlineTrialDashboardPage,
  loadOnlineTrialDetailPage,
  loadOnlineTrialHistoryPage,
  loadOnlineTrialNewPage,
  loadTechnicentreDemandPage,
  loadTechnicentreAcheminementsPage,
  loadTechnicentreHomePage,
  loadTechnicentreModificationRequestsPage,
  loadTechnicentreReceptionDetailPage,
  loadTechnicentreReceptionHistoryPage,
  loadTechnicentreReceptionListPage,
  loadTechnicentreRequestHistoryPage,
  loadTrackingReceptionQualityPage,
  loadTrackingRequestsVisionPage,
  loadTrackingOnlineTrialsPage,
  loadTrackingOnlineTrialsPerformancePage,
} from "./routes/lazyRoutes";

const AgentAlertDetailPage = lazy(loadAgentAlertDetailPage);
const AgentDashboard = lazy(loadAgentDashboard);
const AdminDashboard = lazy(loadAdminDashboard);
const AdminRequestConfigPage = lazy(loadAdminRequestConfigPage);
const AdminAlertDetailPage = lazy(loadAdminAlertDetailPage);
const AdminUserDetailPage = lazy(loadAdminUserDetailPage);
const AdminVirtualPermanentDetailPage = lazy(loadAdminVirtualPermanentDetailPage);
const EstablishmentHistoryPage = lazy(loadEstablishmentHistoryPage);
const EstablishmentProgressPage = lazy(loadEstablishmentProgressPage);
const LoginPage = lazy(loadLoginPage);
const NewAlertPage = lazy(loadNewAlertPage);
const PermanentAlertDetailPage = lazy(loadPermanentAlertDetailPage);
const PermanentDashboard = lazy(loadPermanentDashboard);
const PermanentOnlineTrialDashboardPage = lazy(loadPermanentOnlineTrialDashboardPage);
const PermanentOnlineTrialDetailPage = lazy(loadPermanentOnlineTrialDetailPage);
const PermanentMapPage = lazy(loadPermanentMapPage);
const OnlineTrialDashboardPage = lazy(loadOnlineTrialDashboardPage);
const OnlineTrialDetailPage = lazy(loadOnlineTrialDetailPage);
const OnlineTrialHistoryPage = lazy(loadOnlineTrialHistoryPage);
const OnlineTrialNewPage = lazy(loadOnlineTrialNewPage);
const TechnicentreDemandPage = lazy(loadTechnicentreDemandPage);
const TechnicentreAcheminementsPage = lazy(loadTechnicentreAcheminementsPage);
const TechnicentreHomePage = lazy(loadTechnicentreHomePage);
const TechnicentreModificationRequestsPage = lazy(loadTechnicentreModificationRequestsPage);
const TechnicentreReceptionDetailPage = lazy(loadTechnicentreReceptionDetailPage);
const TechnicentreReceptionHistoryPage = lazy(loadTechnicentreReceptionHistoryPage);
const TechnicentreReceptionListPage = lazy(loadTechnicentreReceptionListPage);
const TechnicentreRequestHistoryPage = lazy(loadTechnicentreRequestHistoryPage);
const TrackingReceptionQualityPage = lazy(loadTrackingReceptionQualityPage);
const TrackingRequestsVisionPage = lazy(loadTrackingRequestsVisionPage);
const TrackingOnlineTrialsPage = lazy(loadTrackingOnlineTrialsPage);
const TrackingOnlineTrialsPerformancePage = lazy(loadTrackingOnlineTrialsPerformancePage);

function RouteFallback() {
  return <PageSkeleton />;
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Array<"AGENT" | "PERMANENT" | "ETABLISSEMENT" | "PROJET" | "ADMIN" | "SUIVI">;
}) {
  const { user, token, ready } = useAuth();
  if (!ready) {
    return <RouteFallback />;
  }
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={
          user.role === "PERMANENT"
            ? "/permanent/dashboard"
            : user.role === "PROJET"
              ? "/projet/essais/dashboard"
            : user.role === "ADMIN"
              ? "/admin/dashboard"
              : user.role === "SUIVI"
                ? "/tracking/requests"
                : "/technicentre/dashboard"
        }
        replace
      />
    );
  }
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LazyPage><LoginPage /></LazyPage>} />
      <Route path="/technicentre" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreHomePage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/dashboard" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreHomePage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/acheminements" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreAcheminementsPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/reception" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreReceptionListPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/reception/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreReceptionDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/reception/history" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreReceptionHistoryPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/reception/history/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreReceptionDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/demande" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreDemandPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/demande/modifications" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreModificationRequestsPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/demande/create" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><NewAlertPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/demande/history" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreRequestHistoryPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/demande/history/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><AgentAlertDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/alerts" element={<Navigate to="/technicentre/demande/history" replace />} />
      <Route path="/technicentre/alerts/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><AgentAlertDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/alerts/:id/edit" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><NewAlertPage /></LazyPage></RequireAuth>} />
      <Route path="/technicentre/alerts/new" element={<Navigate to="/technicentre/demande/create" replace />} />
      <Route path="/technicentre/history" element={<Navigate to="/technicentre/reception/history" replace />} />
      <Route path="/essais/dashboard" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialDashboardPage /></LazyPage></RequireAuth>} />
      <Route path="/essais" element={<Navigate to="/essais/dashboard" replace />} />
      <Route path="/essais/new" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialNewPage /></LazyPage></RequireAuth>} />
      <Route path="/essais/history" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialHistoryPage /></LazyPage></RequireAuth>} />
      <Route path="/essais/history/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/essais/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/essais/:id/edit" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><OnlineTrialNewPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais/dashboard" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialDashboardPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais" element={<Navigate to="/projet/essais/dashboard" replace />} />
      <Route path="/projet/essais/new" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialNewPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais/history" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialHistoryPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais/history/:id" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais/:id" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/projet/essais/:id/edit" element={<RequireAuth roles={["PROJET"]}><LazyPage><OnlineTrialNewPage /></LazyPage></RequireAuth>} />
      <Route path="/agent/dashboard" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><AgentDashboard /></LazyPage></RequireAuth>} />
      <Route path="/agent/alerts" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><AgentDashboard /></LazyPage></RequireAuth>} />
      <Route path="/agent/alerts/:id" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><AgentAlertDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/agent/alerts/:id/edit" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><NewAlertPage /></LazyPage></RequireAuth>} />
      <Route path="/agent/alerts/new" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><NewAlertPage /></LazyPage></RequireAuth>} />
      <Route path="/establishment/dashboard" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><TechnicentreHomePage /></LazyPage></RequireAuth>} />
      <Route path="/establishment/progress" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><EstablishmentProgressPage /></LazyPage></RequireAuth>} />
      <Route path="/establishment/history" element={<RequireAuth roles={["AGENT", "ETABLISSEMENT"]}><LazyPage><EstablishmentHistoryPage /></LazyPage></RequireAuth>} />
      <Route path="/admin/dashboard" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminDashboard /></LazyPage></RequireAuth>} />
      <Route path="/admin/accounts" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminDashboard /></LazyPage></RequireAuth>} />
      <Route path="/admin/request-config" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminRequestConfigPage /></LazyPage></RequireAuth>} />
      <Route path="/admin/users/:id" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminUserDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/admin/permanents/:target" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminVirtualPermanentDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/admin/users/:userId/alerts/:alertId" element={<RequireAuth roles={["ADMIN"]}><LazyPage><AdminAlertDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/permanent/dashboard" element={<RequireAuth roles={["PERMANENT"]}><LazyPage><PermanentDashboard /></LazyPage></RequireAuth>} />
      <Route path="/permanent/dashboard/:id" element={<RequireAuth roles={["PERMANENT"]}><LazyPage><PermanentAlertDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/permanent/essais" element={<RequireAuth roles={["PERMANENT"]}><LazyPage><PermanentOnlineTrialDashboardPage /></LazyPage></RequireAuth>} />
      <Route path="/permanent/essais/:id" element={<RequireAuth roles={["PERMANENT"]}><LazyPage><PermanentOnlineTrialDetailPage /></LazyPage></RequireAuth>} />
      <Route path="/permanent/map" element={<RequireAuth roles={["PERMANENT"]}><LazyPage><PermanentMapPage /></LazyPage></RequireAuth>} />
      <Route path="/tracking/requests" element={<RequireAuth roles={["SUIVI"]}><LazyPage><TrackingRequestsVisionPage /></LazyPage></RequireAuth>} />
      <Route path="/tracking/reception-quality" element={<RequireAuth roles={["SUIVI"]}><LazyPage><TrackingReceptionQualityPage /></LazyPage></RequireAuth>} />
      <Route path="/tracking/essais" element={<RequireAuth roles={["SUIVI"]}><LazyPage><TrackingOnlineTrialsPage /></LazyPage></RequireAuth>} />
      <Route path="/tracking/essais/performance" element={<RequireAuth roles={["SUIVI"]}><LazyPage><TrackingOnlineTrialsPerformancePage /></LazyPage></RequireAuth>} />
      <Route path="/tracking/all" element={<Navigate to="/tracking/requests" replace />} />
      <Route path="/tracking/dashboard" element={<Navigate to="/tracking/requests" replace />} />
      <Route path="/tracking/playback" element={<Navigate to="/tracking/requests" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
