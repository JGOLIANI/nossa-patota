import { useState } from 'react'
import type { PlayerInput } from '../data/types'
import { useApp } from '../store/useApp'
import type { Player } from '../types'
import { ConfirmDialog, Modal } from './Modal'
import { Button, ErrorText, Field, Input, Select } from './ui'

const EMPTY: PlayerInput = {
  username: '',
  full_name: '',
  photo_url: null,
  player_type: 'mensalista',
  dominant_foot: 'direita',
  position: 'linha',
  status: 'ativo',
  role: 'jogador',
  level: 3,
}

function suggestUsername(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9.]/g, '')
}

/**
 * Renderize este componente apenas quando o formulário deve aparecer — o
 * estado inicial vem do jogador recebido, sem efeito de sincronização.
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
          <div className="flex gap-2">
            {player && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Remover
              </Button>
            )}
            <Button block onClick={save} disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
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
            />
          </Field>

          <Field
            label="Nome de usuário"
            hint="Usado no login. Precisa ser único na patota."
          >
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
                <option value="linha">Jogador de linha</option>
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

            <Field label="Situação">
              <Select
                value={form.status}
                onChange={(event) =>
                  update('status', event.target.value as PlayerInput['status'])
                }
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Field>

            <Field label="Nível" hint="1 a 5, usado no balanceamento.">
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

            <Field label="Permissão">
              <Select
                value={form.role}
                onChange={(event) => update('role', event.target.value as PlayerInput['role'])}
              >
                <option value="jogador">Jogador</option>
                <option value="admin">Administrador</option>
              </Select>
            </Field>
          </div>

          <ErrorText>{error}</ErrorText>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Remover jogador"
        message="O jogador sai da lista e das próximas rodadas. Os gols já registrados continuam no placar das partidas antigas. Prefere apenas marcar como inativo?"
        confirmLabel="Remover mesmo assim"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
