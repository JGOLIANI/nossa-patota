import { useState } from 'react'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { PlayerRow } from '../components/PlayerRow'
import { Badge, Button, Card, ErrorText, SectionTitle, Select, StatTile } from '../components/ui'
import { resetDemoData } from '../data/localBackend'
import { useApp } from '../store/useApp'
import type { Player, Role } from '../types'

export function AdminPage() {
  const { snapshot, currentPlayer, demoMode, actions, refresh } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const withAccess = snapshot.players.filter((player) => player.user_id)
  const withoutAccess = snapshot.players.filter(
    (player) => !player.user_id && player.player_type === 'mensalista',
  )

  async function changeRole(player: Player, role: Role) {
    setError('')
    setBusy(true)
    try {
      await actions.updatePlayer(player.id, { role })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a permissão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Administração" subtitle="Usuários e permissões" back />

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Jogadores" value={snapshot.players.length} />
        <StatTile label="Rodadas" value={snapshot.rounds.length} />
        <StatTile label="Partidas" value={snapshot.matches.length} />
      </div>

      <ErrorText>{error}</ErrorText>

      <section>
        <SectionTitle>Com acesso ao aplicativo</SectionTitle>
        <div className="space-y-2">
          {withAccess.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              subtitle={`@${player.username}`}
              right={
                player.id === currentPlayer?.id ? (
                  <Badge tone="emerald">você</Badge>
                ) : (
                  <Select
                    value={player.role}
                    disabled={busy}
                    onChange={(event) => changeRole(player, event.target.value as Role)}
                    className="w-36 py-2 text-sm"
                  >
                    <option value="jogador">Jogador</option>
                    <option value="admin">Administrador</option>
                  </Select>
                )
              }
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Aguardando primeiro acesso</SectionTitle>
        {withoutAccess.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">
              Todos os mensalistas já criaram a própria senha.
            </p>
          </Card>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              Peça para cada um abrir o aplicativo, tocar em “Primeiro acesso” e usar exatamente o
              nome de usuário abaixo.
            </p>
            <div className="space-y-2">
              {withoutAccess.map((player) => (
                <PlayerRow key={player.id} player={player} subtitle={`@${player.username}`} />
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <SectionTitle>Manutenção</SectionTitle>
        <div className="space-y-2">
          <Button block variant="secondary" onClick={() => refresh()} disabled={busy}>
            Recarregar dados
          </Button>
          {demoMode && (
            <Button block variant="danger" onClick={() => setConfirmReset(true)}>
              Restaurar dados da demonstração
            </Button>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Restaurar demonstração"
        message="Tudo que você criou neste aparelho será apagado e a patota fictícia volta ao estado inicial."
        confirmLabel="Restaurar"
        onConfirm={async () => {
          resetDemoData()
          setConfirmReset(false)
          await refresh()
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
