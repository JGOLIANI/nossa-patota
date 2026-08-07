import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireAuth } from './components/guards'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { LiveMatchPage } from './pages/LiveMatchPage'
import { LoginPage } from './pages/LoginPage'
import { PlayerDetailPage } from './pages/PlayerDetailPage'
import { PlayersPage } from './pages/PlayersPage'
import { ProfilePage } from './pages/ProfilePage'
import { RankingsPage } from './pages/RankingsPage'
import { RoundDetailPage } from './pages/RoundDetailPage'
import { RoundNewPage } from './pages/RoundNewPage'
import { RoundsPage } from './pages/RoundsPage'
import { AppProvider } from './store/AppProvider'

export function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/entrar" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="jogadores" element={<PlayersPage />} />
            <Route path="jogadores/:playerId" element={<PlayerDetailPage />} />
            <Route path="rodadas" element={<RoundsPage />} />
            <Route
              path="rodadas/nova"
              element={
                <RequireAdmin>
                  <RoundNewPage />
                </RequireAdmin>
              }
            />
            <Route path="rodadas/:roundId" element={<RoundDetailPage />} />
            <Route path="partidas/:matchId" element={<LiveMatchPage />} />
            <Route path="rankings" element={<RankingsPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route
              path="admin"
              element={
                <RequireAdmin>
                  <AdminPage />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
