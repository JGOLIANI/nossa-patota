import { useMemo, useState } from 'react'
import { attendanceLists } from '../domain/attendance'
import { playerMap, roundEntries, roundTeams } from '../domain/selectors'
import { cn } from '../lib/cn'
import { playerCaption } from '../lib/player'
import { useApp } from '../store/useApp'
import { TEAM_PRESETS, type Round } from '../types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { Button, ListGroup, Note, TeamDot } from './ui'

/**
 * Montagem manual dos times.
 *
 * O sorteio resolve o caso comum, mas nem toda pelada quer o time que o
 * histórico sugere — os quatro que vieram juntos costumam querer jogar
 * juntos. Aqui cada jogador tem dois botões, um por colete: tocar o colete
 * escala, tocar de novo o mesmo colete tira de campo.
 *
 * A folha serve aos dois momentos. Antes do sorteio ela monta os times e abre
 * o placar; com a partida já rolando, ela só troca alguém de lado, e por isso
 * não passa por refazer os times — refazer apagaria os gols já registrados.
 */
export function TeamBuilder({
  round,
  open,
  onClose,
}: {
  round: Round
  open: boolean
  onClose: () => void
}) {
  const { snapshot, actions } = useApp()
  const teams = roundTeams(snapshot, round.id)
  const byId = playerMap(snapshot)
  const rows = roundEntries(snapshot, round.id)

  /**
   * Quem aparece na folha: os confirmados, mais quem já está em um time. O
   * segundo caso cobre quem foi escalado e depois mudou de ideia na presença
   * — ele continua em campo, e sumir daqui deixaria o time com um fantasma.
   */
  const candidates = useMemo(() => {
    const lists = attendanceLists(rows)
    const ids = new Set(lists.confirmed.map((entry) => entry.player_id))
    for (const row of rows) {
      if (row.team_id) ids.add(row.player_id)
    }
    return [...ids]
      .map((id) => byId.get(id))
      .filter((player) => player !== undefined)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [rows, byId])

  const initial = useMemo(() => {
    const teamIndex = new Map(teams.map((team, index) => [team.id, index]))
    const state: Record<string, number | null> = {}
    for (const player of candidates) {
      const row = rows.find((entry) => entry.player_id === player.id)
      state[player.id] = row?.team_id ? (teamIndex.get(row.team_id) ?? null) : null
    }
    return state
  }, [candidates, rows, teams])

  // A chave reinicia o rascunho toda vez que a folha reabre: sair sem salvar
  // não pode deixar a escolha anterior guardada.
  const [draft, setDraft] = useState(initial)
  const [key, setKey] = useState(open)
  if (key !== open) {
    setKey(open)
    setDraft(initial)
  }

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sides = teams.length >= 2 ? teams : TEAM_PRESETS.slice(0, 2)
  const counts = [0, 1].map(
    (index) => Object.values(draft).filter((value) => value === index).length,
  )
  const outside = Object.values(draft).filter((value) => value === null).length
  const building = teams.length === 0
  // Montando do zero, os dois times precisam de gente: sem isto o botão
  // convidava ao toque só para devolver um erro que dava para prever.
  const ready = !building || counts.every((count) => count > 0)

  async function save() {
    setError('')
    setBusy(true)
    try {
      await actions.setManualTeams(round.id, draft)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os times.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={building ? 'Montar os times' : 'Ajustar os times'}
      onClose={onClose}
      footer={
        <Button size="lg" block onClick={save} disabled={busy || !ready}>
          {busy ? 'Salvando…' : building ? 'Criar times e abrir placar' : 'Salvar mudanças'}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-4 text-footnote text-muted">
          {sides.map((side, index) => (
            <span key={side.name} className="flex items-center gap-1.5">
              <TeamDot color={side.color} />
              {side.name} · <span className="tabular-nums text-ink">{counts[index]}</span>
            </span>
          ))}
          <span>
            Fora · <span className="tabular-nums text-ink">{outside}</span>
          </span>
        </div>

        {error && <Note tone="error">{error}</Note>}

        {building && (
          <Note>
            Ao salvar, os times são criados e o placar abre — o mesmo que o sorteio faz, só que
            com quem você escolheu.
          </Note>
        )}

        <ListGroup>
          {candidates.map((player) => (
            <div key={player.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar player={player} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-headline text-ink">{player.full_name}</p>
                <p className="truncate text-footnote text-muted">{playerCaption(player)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {sides.map((side, index) => {
                  const active = draft[player.id] === index
                  return (
                    <button
                      key={side.name}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${active ? 'Tirar' : 'Escalar'} ${player.full_name} no ${side.name}`}
                      onClick={() =>
                        setDraft((state) => ({
                          ...state,
                          [player.id]: active ? null : index,
                        }))
                      }
                      className={cn(
                        'inline-flex size-11 items-center justify-center rounded-2xl border-2',
                        'transition duration-200 ease-ios active:scale-90',
                        active ? 'border-brand bg-brand-soft' : 'border-line bg-card',
                      )}
                    >
                      <TeamDot color={side.color} className="size-5" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </ListGroup>

        {candidates.length === 0 && (
          <Note tone="warn">Ninguém confirmou presença ainda, então não há quem escalar.</Note>
        )}
      </div>
    </Modal>
  )
}
