import { useState } from 'react'
import { ConfirmDialog } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { Button, Card, ListGroup, ListRow, Note, SectionHeader, Select, Tag } from '../components/ui'
import { resetDemoData } from '../data/localBackend'
import { useApp } from '../store/useApp'
import type { Player, Role } from '../types'
import { WEEKDAYS } from '../types'

export function AdminPage() {
  const { snapshot, currentPlayer, demoMode, actions, refresh } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const withAccess = snapshot.players.filter((player) => player.user_id)
  const waiting = snapshot.players.filter(
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
    <Page title="Administração" subtitle="Usuários e permissões" back>
      <div className="space-y-7">
        {error && <Note tone="error">{error}</Note>}

        <section>
          <SectionHeader title="A patota" />
          <ListGroup>
            <ListRow
              to="/admin/agenda"
              title="Agenda da patota"
              subtitle={`${WEEKDAYS[snapshot.settings.weekday]} às ${snapshot.settings.start_time}${snapshot.settings.location ? ` · ${snapshot.settings.location}` : ''}`}
              chevron
            />
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Contas ativas" />
          <Note>
            Só um administrador pode promover outra pessoa. Ninguém consegue criar uma conta de
            administrador por conta própria.
          </Note>
          <div className="mt-3">
            <ListGroup>
              {withAccess.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  subtitle={`@${player.username}`}
                  trailing={
                    player.id === currentPlayer?.id ? (
                      <Tag tone="live">você</Tag>
                    ) : (
                      <span className="block w-36">
                        <Select
                          value={player.role}
                          disabled={busy}
                          aria-label={`Permissão de ${player.full_name}`}
                          onChange={(event) => changeRole(player, event.target.value as Role)}
                        >
                          <option value="jogador">Jogador</option>
                          <option value="admin">Administrador</option>
                        </Select>
                      </span>
                    )
                  }
                />
              ))}
            </ListGroup>
          </div>
        </section>

        <section>
          <SectionHeader title="Aguardando primeiro acesso" />
          {waiting.length === 0 ? (
            <Card className="p-4">
              <p className="text-subhead text-muted">
                Todos os mensalistas já criaram a própria senha.
              </p>
            </Card>
          ) : (
            <>
              <p className="mb-3 px-1 text-footnote text-muted">
                Peça para cada um abrir o aplicativo, tocar em “Primeiro acesso” e usar exatamente
                o nome de usuário abaixo.
              </p>
              <ListGroup>
                {waiting.map((player) => (
                  <PlayerRow key={player.id} player={player} subtitle={`@${player.username}`} />
                ))}
              </ListGroup>
            </>
          )}
        </section>

        <section>
          <SectionHeader title="Manutenção" />
          <div className="space-y-2">
            <Button variant="secondary" block onClick={() => refresh()} disabled={busy}>
              Recarregar dados
            </Button>
            {demoMode && (
              <Button variant="quiet" block destructive onClick={() => setConfirmReset(true)}>
                Restaurar dados da demonstração
              </Button>
            )}
          </div>
        </section>
      </div>

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
    </Page>
  )
}
