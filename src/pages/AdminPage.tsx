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

/**
 * Senha provisória para passar no grupo. Sem `0/O` e `1/l`, que viram
 * discussão quando alguém digita o que leu de um print.
 */
const SAFE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

function temporaryPassword(): string {
  const values = crypto.getRandomValues(new Uint32Array(8))
  return Array.from(values, (value) => SAFE_CHARS[value % SAFE_CHARS.length]).join('')
}

export function AdminPage() {
  const { snapshot, currentPlayer, demoMode, actions, refresh } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState(snapshot.settings.join_code)
  const [codeSaved, setCodeSaved] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPlayerId, setResetPlayerId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetDone, setResetDone] = useState('')

  const withAccess = snapshot.players.filter((player) => player.user_id)
  const waiting = snapshot.players.filter(
    (player) => !player.user_id && player.player_type === 'mensalista',
  )
  // A própria senha se troca no perfil, com a sessão aberta — aqui só as dos
  // outros.
  const resettable = withAccess.filter((player) => player.id !== currentPlayer?.id)

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

  function openReset() {
    setError('')
    setResetDone('')
    setResetPlayerId(resettable[0]?.id ?? '')
    setNewPassword(temporaryPassword())
    setResetOpen(true)
  }

  async function applyReset() {
    const target = resettable.find((player) => player.id === resetPlayerId)
    if (!target) return
    setError('')
    setBusy(true)
    try {
      await actions.setPlayerPassword(target.id, newPassword)
      setResetOpen(false)
      setResetDone(
        `Senha de ${target.full_name} trocada para "${newPassword}". Passe para ele e peça que troque em Perfil → Alterar senha.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Administração" subtitle="Usuários e permissões" back>
      <div className="space-y-7">
        {error && <Note tone="error">{error}</Note>}

        {codeSaved && <Note>{codeSaved}</Note>}
        {resetDone && <Note>{resetDone}</Note>}

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
            {!demoMode && resettable.length > 0 && (
              <ListRow
                onClick={openReset}
                title="Redefinir a senha de alguém"
                subtitle="Gera uma senha provisória para quem esqueceu a sua"
                chevron
              />
            )}
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

      <Modal
        open={resetOpen}
        title="Redefinir senha"
        onClose={() => setResetOpen(false)}
        footer={
          <Button size="lg" block onClick={applyReset} disabled={busy || !resetPlayerId}>
            Trocar a senha
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Jogador">
            <Select
              value={resetPlayerId}
              onChange={(event) => setResetPlayerId(event.target.value)}
            >
              {resettable.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name} (@{player.username})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Senha provisória" hint="Mínimo de 6 caracteres.">
            <Input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Field>

          <Button variant="secondary" block onClick={() => setNewPassword(temporaryPassword())}>
            Gerar outra
          </Button>

          <Note tone="warn">
            A senha antiga deixa de funcionar na hora. Passe a nova para a pessoa e peça que ela
            troque em Perfil → Alterar senha.
          </Note>

          {error && <Note tone="error">{error}</Note>}
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
