import { useState } from 'react'
import type { PlayerInput } from '../data/types'
import { suggestUsername } from '../lib/player'
import { useApp } from '../store/useApp'
import type { Player } from '../types'
import { ConfirmDialog, Modal } from './Modal'
import { Button, Field, Input, Note, Select } from './ui'

const EMPTY: PlayerInput = {
  username: '',
  full_name: '',
  photo_url: null,
  player_type: 'mensalista',
  dominant_foot: 'direita',
  position: 'linha',
  status: 'ativo',
  // Um cadastro novo nunca nasce administrador: a promoção é um ato
  // deliberado de quem já é admin, feito na tela de Administração.
  role: 'jogador',
  // Todo mundo come\u00e7a no meio da escala. O n\u00edvel n\u00e3o \u00e9 perguntado no cadastro
  // \u2014 nem aqui, nem quando o jogador se cadastra sozinho \u2014 porque \u00e9 avalia\u00e7\u00e3o,
  // e avalia\u00e7\u00e3o se faz depois de ver jogar.
  level: 3,
}

/**
 * Renderize apenas quando o formulário deve aparecer — o estado inicial vem
 * do jogador recebido, sem efeito de sincronização.
 */
export function PlayerFormModal({
  player,
  onClose,
}: {
  player: Player | null
  onClose: () => void
}) {
  const { actions } = useApp()
  const [form, setForm] = useState<PlayerInput>(() =>
    player
      ? {
          username: player.username,
          full_name: player.full_name,
          photo_url: player.photo_url,
          player_type: player.player_type,
          dominant_foot: player.dominant_foot,
          position: player.position,
          status: player.status,
          role: player.role,
          level: player.level,
        }
      : EMPTY,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(Boolean(player))

  function update<K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setError('')
    if (!form.full_name.trim()) {
      setError('Informe o nome completo.')
      return
    }
    if (!form.username.trim()) {
      setError('Informe o nome de usuário.')
      return
    }
    setBusy(true)
    try {
      if (player) await actions.updatePlayer(player.id, form)
      else await actions.createPlayer(form)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!player) return
    setBusy(true)
    try {
      await actions.deletePlayer(player.id)
      setConfirmDelete(false)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open
        title={player ? 'Editar jogador' : 'Novo jogador'}
        onClose={onClose}
        footer={
          <Button size="lg" block onClick={save} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Nome completo">
            <Input
              value={form.full_name}
              onChange={(event) => {
                const value = event.target.value
                update('full_name', value)
                if (!usernameTouched) update('username', suggestUsername(value))
              }}
              placeholder="Igor Santos"
              autoCapitalize="words"
              autoFocus={!player}
            />
          </Field>

          <Field label="Nome de usuário" hint="É com ele que o jogador entra no aplicativo.">
            <Input
              value={form.username}
              onChange={(event) => {
                setUsernameTouched(true)
                update('username', event.target.value)
              }}
              placeholder="igor.santos"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select
                value={form.player_type}
                onChange={(event) =>
                  update('player_type', event.target.value as PlayerInput['player_type'])
                }
              >
                <option value="mensalista">Mensalista</option>
                <option value="visitante">Visitante</option>
              </Select>
            </Field>

            <Field label="Posição">
              <Select
                value={form.position}
                onChange={(event) =>
                  update('position', event.target.value as PlayerInput['position'])
                }
              >
                <option value="linha">Linha</option>
                <option value="goleiro">Goleiro</option>
              </Select>
            </Field>

            <Field label="Perna dominante">
              <Select
                value={form.dominant_foot}
                onChange={(event) =>
                  update('dominant_foot', event.target.value as PlayerInput['dominant_foot'])
                }
              >
                <option value="direita">Direita</option>
                <option value="esquerda">Esquerda</option>
                <option value="ambidestro">Ambidestro</option>
              </Select>
            </Field>

            {/* O nível só aparece na edição: no cadastro ainda não há como
                avaliar quem acabou de chegar. */}
            {player && (
              <Field label="Nível" hint="1 a 5, usado no sorteio.">
                <Select
                  value={String(form.level)}
                  onChange={(event) => update('level', Number(event.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {player && (
            <Field label="Situação">
              <Select
                value={form.status}
                onChange={(event) => update('status', event.target.value as PlayerInput['status'])}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Field>
          )}

          {error && <Note tone="error">{error}</Note>}

          {player && (
            <Button variant="quiet" block destructive onClick={() => setConfirmDelete(true)} disabled={busy}>
              Remover jogador
            </Button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Remover jogador"
        message="Ele sai da lista e das próximas rodadas. Os gols já registrados continuam valendo no placar das partidas antigas. Se for uma ausência temporária, prefira marcar como inativo."
        confirmLabel="Remover"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
