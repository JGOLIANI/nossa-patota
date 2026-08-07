import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog, Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { IconBall, IconTrash, IconWhistle } from '../components/icons'
import { Badge, Button, Card, EmptyState, ErrorText } from '../components/ui'
import { findMatch, findRound, findTeam, matchEvents, teamPlayers } from '../domain/selectors'
import { cn } from '../lib/cn'
import { firstName } from '../lib/format'
import { useApp } from '../store/useApp'
import type { Player } from '../types'

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
  return (
    <div className="grid grid-cols-3 gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold',
            value === null
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-800 bg-slate-900 text-slate-400',
          )}
        >
          <span className="text-2xl">—</span>
          Sem assistência
        </button>
      )}
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onChange(player.id)}
          className={cn(
            'flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center',
            value === player.id
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-800 bg-slate-900',
          )}
        >
          <Avatar player={player} size="sm" />
          <span className="line-clamp-2 text-xs font-semibold text-slate-200">
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
      <>
        <PageHeader title="Partida" back />
        <EmptyState title="Partida não encontrada" />
      </>
    )
  }

  const round = findRound(snapshot, match.round_id)
  const home = findTeam(snapshot, match.team_a_id)
  const away = findTeam(snapshot, match.team_b_id)
  const squadA = teamPlayers(snapshot, match.team_a_id)
  const squadB = teamPlayers(snapshot, match.team_b_id)
  const live = match.status === 'em_andamento'

  // No gol contra, o autor pertence ao time adversário do que pontuou.
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
    <div className="pb-24">
      <PageHeader
        title={`Partida ${match.sequence}`}
        subtitle={round?.title}
        back
        action={live ? <Badge tone="emerald">Ao vivo</Badge> : <Badge tone="amber">Fim</Badge>}
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-2 text-center">
          <div className="min-w-0 flex-1">
            <span
              className="mx-auto mb-1 block size-2.5 rounded-full"
              style={{ backgroundColor: home?.color }}
            />
            <p className="truncate text-sm font-semibold text-slate-200">{home?.name}</p>
          </div>
          <p className="shrink-0 text-4xl font-bold tabular-nums">
            {match.score_a}
            <span className="mx-2 text-slate-600">-</span>
            {match.score_b}
          </p>
          <div className="min-w-0 flex-1">
            <span
              className="mx-auto mb-1 block size-2.5 rounded-full"
              style={{ backgroundColor: away?.color }}
            />
            <p className="truncate text-sm font-semibold text-slate-200">{away?.name}</p>
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {isAdmin && live && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => openGoal(match.team_a_id)} disabled={busy}>
            <IconBall className="size-5" /> Gol {home?.name?.replace('Time ', '')}
          </Button>
          <Button size="lg" onClick={() => openGoal(match.team_b_id)} disabled={busy}>
            <IconBall className="size-5" /> Gol {away?.name?.replace('Time ', '')}
          </Button>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
          Gols da partida
        </h2>
        {events.length === 0 ? (
          <EmptyState title="Nenhum gol registrado" />
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const team = findTeam(snapshot, event.team_id)
              const scorerPlayer = snapshot.players.find((p) => p.id === event.scorer_id)
              const assistPlayer = snapshot.players.find((p) => p.id === event.assist_id)
              return (
                <Card key={event.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team?.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {scorerPlayer ? (
                        <Link to={`/jogadores/${scorerPlayer.id}`}>{scorerPlayer.full_name}</Link>
                      ) : (
                        'Jogador removido'
                      )}
                      {event.own_goal && (
                        <Badge tone="red" className="ml-2">
                          contra
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {assistPlayer ? `Assistência de ${assistPlayer.full_name}` : team?.name}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setRemoving(event.id)}
                      className="shrink-0 rounded-lg p-2 text-slate-500"
                      aria-label="Remover gol"
                    >
                      <IconTrash className="size-5" />
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {isAdmin && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg px-4">
          {live ? (
            <Button size="lg" block variant="secondary" onClick={() => setConfirmFinish(true)}>
              <IconWhistle className="size-5" /> Encerrar partida
            </Button>
          ) : (
            <Button
              size="lg"
              block
              variant="ghost"
              onClick={() => actions.reopenMatch(match.id)}
              className="bg-slate-900"
            >
              Reabrir partida
            </Button>
          )}
        </div>
      )}

      <Modal
        open={Boolean(goalFor)}
        title={`Gol · ${goalFor === match.team_a_id ? home?.name : away?.name}`}
        onClose={() => setGoalFor(null)}
        footer={
          <Button block size="lg" onClick={saveGoal} disabled={busy || !scorer}>
            {busy ? 'Registrando…' : 'Registrar gol'}
          </Button>
        }
      >
        <div className="space-y-5">
          <label className="flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-3">
            <span className="text-sm font-semibold text-slate-200">Gol contra</span>
            <input
              type="checkbox"
              checked={ownGoal}
              onChange={(event) => {
                setOwnGoal(event.target.checked)
                setScorer(null)
                setAssist(null)
              }}
              className="size-6 accent-emerald-500"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-300">
              {ownGoal ? 'Quem marcou contra?' : 'Quem marcou?'}
            </p>
            <PlayerPicker players={scorerOptions} value={scorer} onChange={setScorer} />
          </div>

          {!ownGoal && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">Assistência</p>
              <PlayerPicker
                players={assistOptions}
                value={assist}
                onChange={setAssist}
                allowNone
              />
            </div>
          )}

          <ErrorText>{error}</ErrorText>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmFinish}
        title="Encerrar partida"
        message="O placar será congelado e as estatísticas dos jogadores passam a contar esta partida."
        confirmLabel="Encerrar"
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
    </div>
  )
}
