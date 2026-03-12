import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { GameShell } from './components/GameShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicShell } from './components/PublicShell';
import { IntroPage } from './pages/IntroPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AgentConsolePage } from './pages/AgentConsolePage';
import { LobbyPage } from './pages/LobbyPage';
import { PlayPage } from './pages/PlayPage';
import { ChessPage } from './pages/ChessPage';
import { DeveloperRuntimePage } from './pages/DeveloperRuntimePage';
import { ArcadePage } from './pages/ArcadePage';
import { ArcadeTablePage } from './pages/ArcadeTablePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicShell />}>
          <Route path="/" element={<IntroPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        <Route element={<AppShell />}>
          <Route
            path="/agents"
            element={(
              <ProtectedRoute>
                <AgentConsolePage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/lobby"
            element={(
              <ProtectedRoute>
                <LobbyPage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/dev/runtime"
            element={(
              <ProtectedRoute>
                <DeveloperRuntimePage />
              </ProtectedRoute>
            )}
          />
        </Route>

        <Route element={<GameShell />}>
          <Route
            path="/play"
            element={(
              <ProtectedRoute>
                <PlayPage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/play/chess"
            element={(
              <ProtectedRoute>
                <ChessPage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/play/arcade"
            element={(
              <ProtectedRoute>
                <ArcadePage />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/play/arcade/table/:tableId"
            element={(
              <ProtectedRoute>
                <ArcadeTablePage />
              </ProtectedRoute>
            )}
          />
        </Route>

        <Route path="/city" element={<Navigate to="/lobby" replace />} />
        <Route path="/arcade" element={<Navigate to="/play/arcade" replace />} />
        <Route path="/chess" element={<Navigate to="/play/chess" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
