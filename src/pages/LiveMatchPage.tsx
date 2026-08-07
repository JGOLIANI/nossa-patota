import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { IconBall, IconTrash } from '../components/icons'
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  IconButton,
  Note,
  Switch,
  Tag,
} from '../components/ui'
import { findMatch, findRound, findTeam, matchEvents, teamPlayers } from '../domain/selectors'
import { cn } from '../lib/cn'
import { readableInk } from '../lib/color'
import { firstName } from '../lib/format'
import { useApp } from '../store/useApp'
import type { Player } from '../types'

/** Grade de jogadores com alvo grande — a tela é usada em pé, com uma mão. */
function PlayerPicker({
  players,
  value,
  onChange,
  allowNone,
}: {
  players: Player[]
  value: string | null
  onChange: (playerId: string | null) => void
  allowNone?: boolean
}) {
  const cell = 'flex h-22 flex-col items-center justify-center gap-1.5 rounded-card border px-1 text-center transition'
  return (
    <div className="grid grid-cols-3 gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            cell,
            value === null ? 'border-brand bg-brand-soft' : 'border-line bg-card',
          )}
        >
          <span className="text-xl text-muted">—</span>
          <span className="text-[12px] font-medium text-muted">Ninguém</span>
        </button>
      )}
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onChange(player.id)}
          className={cn(
            cell,
            value === player.id ? 'border-brand bg-brand-soft' : 'border-line bg-card',
          )}
        >
          <Avatar player={player} size="sm" />
          <span className="line-clamp-2 text-[12px] font-medium text-ink">
            {firstName(player.full_name)}
          </span>
        </button>
      ))}
    </div>
  )
}

export function LiveMatchPage() {
  const { matchId = '' } = useParams()
  const { snapshot, isAdmin, actions } = useApp()

  const [goalFor, setGoalFor] = useState<string | null>(null)
  const [scorer, setScorer] = useState<string | null>(null)
  const [assist, setAssist] = useState<string | null>(null)
  const [ownGoal, setOwnGoal] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const match = findMatch(snapshot, matchId)
  const events = useMemo(() => matchEvents(snapshot, matchId), [snapshot, matchId])

  if (!match) {
    return (
      <Page title="Partida" back>
        <EmptyState title="Partida não encontrada" />
      </Page>
    )
  }

  const round = findRound(snapshot, match.round_id)
  const home = findTeam(snapshot, match.team_a_id)
  const away = findTeam(snapshot, match.team_b_id)
  const squadA = teamPlayers(snapshot, match.team_a_id)
  const squadB = teamPlayers(snapshot, match.team_b_id)
  const live = match.status === 'em_andamento'

  // No gol contra o autor pertence ao time adversário do que pontuou.
  const scoringSquad = goalFor === match.team_a_id ? squadA : squadB
  const opposingSquad = goalFor === match.team_a_id ? squadB : squadA
  const scorerOptions = ownGoal ? opposingSquad : scoringSquad
  const assistOptions = scoringSquad.filter((player) => player.id !== scorer)

  function openGoal(teamId: string) {
    setGoalFor(teamId)
    setScorer(null)
    setAssist(null)
    setOwnGoal(false)
    setError('')
  }

  async function saveGoal() {
    if (!goalFor || !match) return
    if (!scorer) {
      setError('Escolha quem marcou o gol.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await actions.addGoal(match, {
        team_id: goalFor,
        scorer_id: scorer,
        assist_id: ownGoal ? null : assist,
        own_goal: ownGoal,
      })
      setGoalFor(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o gol.')
    } finally {
      setBusy(false)
    }
  }

  async function removeEvent(eventId: string) {
    if (!match) return
    setBusy(true)
    try {
      await actions.removeEvent(match, eventId)
      setRemoving(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o gol.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page
      title={`Partida ${match.sequence}`}
      subtitle={round?.title}
      back
      action={live ? <Tag tone="live">Ao vivo</Tag> : <Tag tone="done">Encerrada</Tag>}
    >
      <div className="space-y-6 pb-20">
        {/* O placar usa a cor real de cada time, e é a mesma cor dos botões
            de gol logo abaixo — não há como marcar para o time errado. */}
        <Card className="overflow-hidden">
          <div className="flex items-stretch">
            <div className="flex-1 p-4 text-center">
              <span
                aria-hidden="true"
                className="mx-auto mb-2 block h-1.5 w-10 rounded-full"
                style={{ backgroundColor: home?.color }}
              />
              <p className="truncate text-sm font-medium text-muted">{home?.name}</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-ink">{match.score_a}</p>
            </div>
            <div className="w-px bg-line" />
            <div className="flex-1 p-4 text-center">
              <span
                aria-hidden="true"
                className="mx-auto mb-2 block h-1.5 w-10 rounded-full"
                style={{ backgroundColor: away?.color }}
              />
              <p className="truncate text-sm font-medium text-muted">{away?.name}</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-ink">{match.score_b}</p>
            </div>
          </div>
        </Card>

        {error && <Note tone="error">{error}</Note>}

        {isAdmin && live && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { team: home, id: match.team_a_id },
              { team: away, id: match.team_b_id },
            ].map(({ team, id }) => (
              <button
                key={id}
                type="button"
                onClick={() => openGoal(id)}
                disabled={busy}
                className="flex h-14 items-center justify-center gap-2 rounded-control text-[15px] font-semibold transition active:opacity-80 disabled:opacity-45"
                style={{
                  backgroundColor: team?.color ?? '#333',
                  color: readableInk(team?.color ?? '#333333'),
                }}
              >
                <IconBall className="size-5" />
                Gol
              </button>
            ))}
          </div>
        )}

        <section>
          <h2 className="mb-2.5 text-[15px] font-semibold text-ink">
            Gols {events.length > 0 && <span className="text-muted">· {events.length}</span>}
          </h2>

          {events.length === 0 ? (
            <EmptyState title="Nenhum gol registrado" />
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
              {events.map((event) => {
                const team = findTeam(snapshot, event.team_id)
                const scorerPlayer = snapshot.players.find((p) => p.id === event.scorer_id)
                const assistPlayer = snapshot.players.find((p) => p.id === event.assist_id)
                return (
                  <div key={event.id} className="relative flex items-center gap-3 py-3 pr-2 pl-5">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                      style={{ backgroundColor: team?.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {scorerPlayer ? (
                          <Link to={`/jogadores/${scorerPlayer.id}`}>{scorerPlayer.full_name}</Link>
                        ) : (
                          'Jogador removido'
                        )}
                        {event.own_goal && (
                          <span className="ml-2 text-[13px] font-normal text-loss">
                            (contra)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-muted">
                        {assistPlayer ? `Assistência de ${assistPlayer.full_name}` : team?.name}
                      </p>
                    </div>
                    {isAdmin && (
                      <IconButton label="Remover gol" onClick={() => setRemoving(event.id)}>
                        <IconTrash className="size-5" />
                      </IconButton>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {isAdmin && (
        <ActionBar>
          {live ? (
            <Button size="lg" block variant="secondary" onClick={() => setConfirmFinish(true)}>
              Encerrar partida
            </Button>
          ) : (
            <Button size="lg" block variant="secondary" onClick={() => actions.reopenMatch(match.id)}>
              Reabrir partida
            </Button>
          )}
        </ActionBar>
      )}

      <Modal
        open={Boolean(goalFor)}
        title={`Gol do ${goalFor === match.team_a_id ? home?.name : away?.name}`}
        onClose={() => setGoalFor(null)}
        footer={
          <Button size="lg" block onClick={saveGoal} disabled={busy || !scorer}>
            {busy ? 'Registrando…' : 'Registrar gol'}
          </Button>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">
              {ownGoal ? 'Quem marcou contra?' : 'Quem marcou?'}
            </p>
            <PlayerPicker players={scorerOptions} value={scorer} onChange={setScorer} />
          </div>

          {!ownGoal && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted">Assistência</p>
              <PlayerPicker players={assistOptions} value={assist} onChange={setAssist} allowNone />
            </div>
          )}

          <Switch
            label="Foi gol contra"
            checked={ownGoal}
            onChange={(checked) => {
              setOwnGoal(checked)
              setScorer(null)
              setAssist(null)
            }}
          />

          {error && <Note tone="error">{error}</Note>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmFinish}
        title="Encerrar partida"
        message="O placar será congelado e as estatísticas dos jogadores passam a contar esta partida."
        confirmLabel="Encerrar"
        destructive={false}
        onConfirm={() => {
          setConfirmFinish(false)
          actions.finishMatch(match.id)
        }}
        onCancel={() => setConfirmFinish(false)}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover gol"
        message="O gol sai do placar e das estatísticas dos jogadores."
        confirmLabel="Remover"
        onConfirm={() => removing && removeEvent(removing)}
        onCancel={() => setRemoving(null)}
      />
    </Page>
  )
}
