import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { PendingApprovalsProvider } from './context/PendingApprovalsContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import { RealtimeProvider } from './context/RealtimeContext.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';
import AdminFaviconOutlet from './components/admin/AdminFaviconOutlet.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import GuestRoute from './components/GuestRoute.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const AdminSetupPage = lazy(() => import('./pages/admin/AdminSetupPage.jsx'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'));
const AdminSyncPage = lazy(() => import('./pages/admin/AdminSyncPage.jsx'));
const AdminMatchesPage = lazy(() => import('./pages/admin/AdminMatchesPage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'));
const AdminGroupsPage = lazy(() => import('./pages/admin/AdminGroupsPage.jsx'));
const AdminPredictionsPage = lazy(() => import('./pages/admin/AdminPredictionsPage.jsx'));
const AdminSimulationPage = lazy(() => import('./pages/admin/AdminSimulationPage.jsx'));

const PredictionsPage = lazy(() => import('./pages/PredictionsPage.jsx'));
const AiPredictionsPage = lazy(() => import('./pages/AiPredictionsPage.jsx'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'));
const RulesPage = lazy(() => import('./pages/RulesPage.jsx'));
const WorldCupPage = lazy(() => import('./pages/WorldCupPage.jsx'));
const SimulationPage = lazy(() => import('./pages/SimulationPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const WelcomePage = lazy(() => import('./pages/WelcomePage.jsx'));
const CreateGroupPage = lazy(() => import('./pages/CreateGroupPage.jsx'));
const GroupsPage = lazy(() => import('./pages/GroupsPage.jsx'));
const InviteJoinPage = lazy(() => import('./pages/InviteJoinPage.jsx'));

function RouteFallback() {
  return <LoadingSpinner variant="fullscreen" label="Cargando…" />;
}

export default function App() {
  return (
    <AuthProvider>
      <PendingApprovalsProvider>
        <AdminAuthProvider>
          <RealtimeProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route element={<AdminFaviconOutlet />}>
                    <Route path="/admin/setup" element={<AdminSetupPage />} />
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin" element={<AdminRoute />}>
                      <Route element={<AdminLayout />}>
                        <Route index element={<AdminDashboardPage />} />
                        <Route path="sync" element={<AdminSyncPage />} />
                        <Route path="matches" element={<AdminMatchesPage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="groups" element={<AdminGroupsPage />} />
                        <Route path="predictions" element={<AdminPredictionsPage />} />
                        <Route path="simulation" element={<AdminSimulationPage />} />
                      </Route>
                    </Route>
                  </Route>
                  <Route path="/" element={<WelcomePage />} />
                  <Route path="/login" element={<GuestRoute />}>
                    <Route index element={<LoginPage />} />
                  </Route>
                  <Route path="/register" element={<GuestRoute />}>
                    <Route index element={<RegisterPage />} />
                  </Route>
                  <Route path="/invite/:groupId" element={<InviteJoinPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                      <Route path="ranking" element={<LeaderboardPage />} />
                      <Route path="predictions" element={<PredictionsPage />} />
                      <Route path="ai-predictions" element={<AiPredictionsPage />} />
                      <Route path="leaderboard" element={<Navigate to="/ranking" replace />} />
                      <Route path="groups/new" element={<CreateGroupPage />} />
                      <Route path="groups" element={<GroupsPage />} />
                      <Route path="mundial" element={<WorldCupPage />} />
                      <Route path="simulation" element={<SimulationPage />} />
                      <Route path="rules" element={<RulesPage />} />
                      <Route path="*" element={<Navigate to="/ranking" replace />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </RealtimeProvider>
        </AdminAuthProvider>
      </PendingApprovalsProvider>
    </AuthProvider>
  );
}
