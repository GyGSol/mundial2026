import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import PredictionsPage from './pages/PredictionsPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import RulesPage from './pages/RulesPage.jsx';
import WorldCupPage from './pages/WorldCupPage.jsx';
import SimulationPage from './pages/SimulationPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

import CreateGroupPage from './pages/CreateGroupPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LeaderboardPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="leaderboard" element={<Navigate to="/" replace />} />
            <Route path="groups/new" element={<CreateGroupPage />} />
            <Route path="mundial" element={<WorldCupPage />} />
            <Route path="simulation" element={<SimulationPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
