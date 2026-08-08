import { useState } from 'react'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import {
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  Note,
  SectionHeader,
  Select,
  Tag,
} from '../components/ui'
import { resetDemoData } from '../data/localBackend'
import { useApp } from '../store/useApp'
import type { Player, Role } from '../types'
import { WEEKDAYS } from '../types'

export function AdminPage() {
  const { snapshot, currentPlayer, demoMode, actions, refresh } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState(snapshot.settings.join_code)
  const [codeSaved, setCodeSaved] = useState('')

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

  async function saveCode() {
    setError('')
    setBusy(true)
    try {
      const value = code.trim()
      await actions.updateSettings({ join_code: value })
      setCodeOpen(false)
      setCodeSaved(
        value
          ? `Código salvo. Quem for se cadastrar precisa digitar "${value}".`
          : 'Código removido. O cadastro está aberto a quem tiver o endereço do aplicativo.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o código.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Administração" subtitle="Usuários e permissões" back>
      <div className="space-y-7">
        {error && <Note tone="error">{error}</Note>}

        {codeSaved && <Note>{codeSaved}</Note>}

        <section>
          <SectionHeader title="A patota" />
          <ListGroup>
            <ListRow
              to="/admin/agenda"
              title="Agenda da patota"
              subtitle={`${WEEKDAYS[snapshot.settings.weekday]} às ${snapshot.settings.start_time}${snapshot.settings.location ? ` · ${snapshot.settings.location}` : ''}`}
              chevron
            />
            <ListRow
              onClick={() => {
                setCode(snapshot.settings.join_code)
                setCodeSaved('')
                setCodeOpen(true)
              }}
              title="Código da patota"
              subtitle={
                snapshot.settings.join_code
                  ? `Exigido no cadastro · ${snapshot.settings.join_code}`
                  : 'Nenhum — qualquer pessoa com o endereço pode se cadastrar'
              }
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
                Todos os mensalistas já criaram a própria conta.
              </p>
            </Card>
          ) : (
            <>
              <p className="mb-3 px-1 text-footnote text-muted">
                Fichas abertas por um administrador que ainda não têm dono. Quem se cadastrar com o
                nome de usuário abaixo assume a ficha e o histórico dela.
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

      <Modal
        open={codeOpen}
        title="Código da patota"
        onClose={() => setCodeOpen(false)}
        footer={
          <Button size="lg" block onClick={saveCode} disabled={busy}>
            Salvar código
          </Button>
        }
      >
        <Field
          label="Código"
          hint="Deixe em branco para abrir o cadastro a qualquer pessoa com o endereço."
        >
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            placeholder="PATOTA24"
            autoFocus
          />
        </Field>
        <div className="mt-3">
          <Note>
            O jogador digita este código ao criar a conta. Trocar o código não afeta quem já entrou
            — só vale para os cadastros seguintes.
          </Note>
        </div>
      </Modal>

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
