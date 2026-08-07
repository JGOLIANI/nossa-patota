import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PageHeader'
import { IconCamera, IconChevronRight, IconLogout, IconSettings } from '../components/icons'
import { Badge, Button, Card, ErrorText, Field, Input, StatTile } from '../components/ui'
import { percent } from '../lib/format'
import { useApp } from '../store/useApp'

export function ProfilePage() {
  const { currentPlayer, stats, isAdmin, demoMode, signOut, changePassword, actions } = useApp()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (!currentPlayer) {
    return (
      <div>
        <PageHeader title="Perfil" />
        <Card>
          <p className="text-sm text-slate-300">
            Sua conta ainda não está vinculada a um jogador da patota. Peça ao administrador para
            cadastrar seu nome de usuário.
          </p>
          <Button className="mt-4" block variant="secondary" onClick={signOut}>
            Sair
          </Button>
        </Card>
      </div>
    )
  }

  const entry = stats.get(currentPlayer.id)!
  const isKeeper = currentPlayer.position === 'goleiro'

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
      setMessage('Senha alterada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" />

      <div className="flex flex-col items-center">
        <div className="relative">
          <Avatar player={currentPlayer} size="xl" />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="absolute right-0 bottom-0 inline-flex size-10 items-center justify-center rounded-full bg-emerald-500 text-slate-950"
            aria-label="Alterar foto"
          >
            <IconCamera className="size-5" />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </div>
        <h2 className="mt-3 text-xl font-bold">{currentPlayer.full_name}</h2>
        <p className="text-sm text-slate-400">@{currentPlayer.username}</p>
        {isAdmin && (
          <Badge tone="emerald" className="mt-2">
            Administrador
          </Badge>
        )}
      </div>

      {message && (
        <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-300">
          {message}
        </p>
      )}
      <ErrorText>{error}</ErrorText>

      <div className="grid grid-cols-4 gap-2">
        <StatTile label="Jogos" value={entry.played} />
        <StatTile label="Vitórias" value={entry.wins} />
        {isKeeper ? (
          <>
            <StatTile label="Sofridos" value={entry.goalsAgainst} />
            <StatTile label="S/ sofrer" value={entry.cleanSheets} />
          </>
        ) : (
          <>
            <StatTile label="Gols" value={entry.goals} />
            <StatTile label="Assist." value={entry.assists} />
          </>
        )}
      </div>
      <p className="-mt-3 text-center text-xs text-slate-500">
        Aproveitamento de {percent(entry.pointsPct)}
      </p>

      <Link to={`/jogadores/${currentPlayer.id}`}>
        <Card className="flex items-center gap-3">
          <span className="flex-1 text-sm font-semibold text-slate-200">
            Ver estatísticas completas
          </span>
          <IconChevronRight className="size-5 text-slate-500" />
        </Card>
      </Link>

      {isAdmin && (
        <Link to="/admin">
          <Card className="flex items-center gap-3">
            <IconSettings className="size-5 text-slate-400" />
            <span className="flex-1 text-sm font-semibold text-slate-200">
              Administração da patota
            </span>
            <IconChevronRight className="size-5 text-slate-500" />
          </Card>
        </Link>
      )}

      {!demoMode && (
        <Card>
          <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••"
            />
          </Field>
          <Button className="mt-3" block variant="secondary" onClick={updatePassword} disabled={busy}>
            Alterar senha
          </Button>
        </Card>
      )}

      <Button block variant="ghost" onClick={signOut} className="bg-slate-900">
        <IconLogout className="size-5" /> Sair da conta
      </Button>
    </div>
  )
}
