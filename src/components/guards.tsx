import { useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { Button, EmptyState, Field, Input, LoadingScreen, Note } from './ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, session } = useApp()
  if (!ready) return <LoadingScreen />
  if (!session) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

/**
 * Barreira de quem entrou com a senha padrão.
 *
 * A senha que o administrador aplica é conhecida de quem a entregou — e, se
 * ela foi ditada no grupo, de mais gente. Por isso vale para uma entrada só:
 * enquanto a marca estiver ligada, esta tela toma o lugar do aplicativo
 * inteiro. Não é um aviso que se fecha no X; a única saída para a frente é
 * escolher outra senha.
 */
export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { currentPlayer, changePassword, signOut, actions } = useApp()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Sem ficha carregada ainda não há o que exigir: o snapshot pode estar a
  // caminho, e travar aqui deixaria a pessoa presa numa tela em branco.
  if (!currentPlayer?.must_change_password) return <>{children}</>

  async function submit() {
    if (!currentPlayer) return
    setError('')
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('As duas senhas não são iguais.')
      return
    }
    setBusy(true)
    try {
      await changePassword(password)
      // Só depois de a senha trocar de verdade a marca sai da ficha.
      await actions.updatePlayer(currentPlayer.id, { must_change_password: false })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível trocar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-title1 text-ink">Escolha uma senha</h1>
      <p className="mt-1 mb-7 text-subhead text-muted">
        Você entrou com a senha provisória que o administrador criou. Ela vale só para esta
        entrada — defina a sua para continuar.
      </p>

      <div className="space-y-4">
        <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="••••••"
            autoFocus
          />
        </Field>

        <Field label="Repita a nova senha">
          <Input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            placeholder="••••••"
          />
        </Field>

        {error && <Note tone="error">{error}</Note>}

        <Button size="lg" block onClick={submit} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar e continuar'}
        </Button>

        <Button variant="quiet" block onClick={signOut} disabled={busy}>
          Sair da conta
        </Button>
      </div>
    </div>
  )
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
