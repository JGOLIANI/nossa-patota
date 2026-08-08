import { useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { IconCamera, IconChevronRight } from '../components/icons'
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  LoadingScreen,
  Note,
  Stat,
  StatRow,
} from '../components/ui'
import { percent } from '../lib/format'
import { useApp } from '../store/useApp'

export function ProfilePage() {
  const { currentPlayer, stats, isAdmin, demoMode, hydrated, signOut, changePassword, actions } =
    useApp()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Mesma razão do guarda de administrador: sem o acervo carregado a ficha
  // ainda não foi encontrada, e dizer que ela não existe seria mentira.
  if (!hydrated) {
    return (
      <Page title="Perfil" back>
        <LoadingScreen />
      </Page>
    )
  }

  if (!currentPlayer) {
    return (
      <Page title="Perfil" back>
        <Card className="p-4">
          <p className="text-subhead text-muted">
            Sua conta ainda não está vinculada a um jogador da patota. Peça ao administrador para
            cadastrar seu nome de usuário.
          </p>
          <Button className="mt-4" block variant="secondary" onClick={signOut}>
            Sair
          </Button>
        </Card>
      </Page>
    )
  }

  const entry = stats.get(currentPlayer.id)!
  const playedInGoal = (entry?.keeperMatches ?? 0) > 0

  async function upload(file: File | undefined) {
    if (!file || !currentPlayer) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await actions.uploadAvatar(currentPlayer.id, file)
      setMessage('Foto atualizada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a foto.')
    } finally {
      setBusy(false)
    }
  }

  async function updatePassword() {
    setError('')
    setMessage('')
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    setBusy(true)
    try {
      await changePassword(password)
      setPassword('')
      setPasswordOpen(false)
      setMessage('Senha alterada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Meu perfil" back>
      <div className="space-y-7">
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar player={currentPlayer} size="xl" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-label="Alterar foto"
              className="absolute right-0 bottom-0 inline-flex size-9 items-center justify-center rounded-full bg-brand text-brand-ink ring-4 ring-canvas transition duration-200 ease-ios active:scale-90"
            >
              <IconCamera className="size-4" />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => upload(event.target.files?.[0])}
            />
          </div>
          <h2 className="mt-3 text-title2 text-ink">{currentPlayer.full_name}</h2>
          <p className="mt-0.5 text-subhead text-muted">
            @{currentPlayer.username}
            {isAdmin && ' · administrador'}
          </p>
        </div>

        {message && <Note>{message}</Note>}
        {error && <Note tone="error">{error}</Note>}

        <Card className="p-4">
          <StatRow>
            <Stat label="Jogos" value={entry.played} />
            <Stat label="Vitórias" value={entry.wins} tone="win" />
            <Stat label="Gols" value={entry.goals} />
            {playedInGoal ? (
              <Stat label="Sofridos" value={entry.goalsAgainst} />
            ) : (
              <Stat label="Assistências" value={entry.assists} />
            )}
          </StatRow>
          <p className="hairline-top mt-3.5 pt-3 text-center text-footnote text-muted">
            Aproveitamento de {percent(entry.pointsPct)}
          </p>
        </Card>

        <ListGroup>
          <ListRow
            to={`/jogadores/${currentPlayer.id}`}
            title="Estatísticas completas"
            subtitle="Histórico e premiações"
            chevron
          />
          {isAdmin && (
            <ListRow
              to="/admin"
              title="Administração"
              subtitle="Usuários e permissões"
              chevron
            />
          )}
          {!demoMode && (
            <ListRow
              onClick={() => setPasswordOpen(true)}
              title="Alterar senha"
              trailing={<IconChevronRight className="size-4 text-faint" />}
            />
          )}
        </ListGroup>

        <Button variant="quiet" block destructive onClick={signOut}>
          Sair da conta
        </Button>
      </div>

      <Modal
        open={passwordOpen}
        title="Alterar senha"
        onClose={() => setPasswordOpen(false)}
        footer={
          <Button size="lg" block onClick={updatePassword} disabled={busy}>
            Salvar nova senha
          </Button>
        }
      >
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
        {error && (
          <div className="mt-3">
            <Note tone="error">{error}</Note>
          </div>
        )}
      </Modal>
    </Page>
  )
}
