import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx';
import AdminSetupPage from './pages/admin/AdminSetupPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminSyncPage from './pages/admin/AdminSyncPage.jsx';
import AdminMatchesPage from './pages/admin/AdminMatchesPage.jsx';
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx';
import AdminGroupsPage from './pages/admin/AdminGroupsPage.jsx';
import AdminPredictionsPage from './pages/admin/AdminPredictionsPage.jsx';
import AdminSimulationPage from './pages/admin/AdminSimulationPage.jsx';
import Layout from './components/Layout.jsx';
import PredictionsPage from './pages/PredictionsPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import RulesPage from './pages/RulesPage.jsx';
import WorldCupPage from './pages/WorldCupPage.jsx';
import SimulationPage from './pages/SimulationPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

import CreateGroupPage from './pages/CreateGroupPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import InviteJoinPage from './pages/InviteJoinPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
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
            <Route element={<Layout />}>
              <Route index element={<LeaderboardPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="leaderboard" element={<Navigate to="/" replace />} />
              <Route path="groups/new" element={<CreateGroupPage />} />
              <Route path="groups" element={<GroupsPage />} />
              <Route path="invite/:groupId" element={<InviteJoinPage />} />
              <Route path="mundial" element={<WorldCupPage />} />
              <Route path="simulation" element={<SimulationPage />} />
              <Route path="rules" element={<RulesPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
