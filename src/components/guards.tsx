import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { EmptyState, LoadingScreen } from './ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session } = useApp()
  if (!ready) return <LoadingScreen />
  if (!session) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading, snapshot } = useApp()
  if (loading && snapshot.players.length === 0) return <LoadingScreen />
  if (!isAdmin) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Somente administradores da patota podem abrir esta tela."
      />
    )
  }
  return <>{children}</>
}
