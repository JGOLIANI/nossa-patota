import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  ListGroup,
  Note,
  Switch,
  Tag,
  TeamDot,
} from '../components/ui'
import { findMatch, findRound, findTeam, matchEvents, teamPlayers } from '../domain/selectors'
import { cn } from '../lib/cn'
import { readableInk, teamSurface } from '../lib/color'
import { firstName } from '../lib/format'
import { useApp } from '../store/useApp'
import type { MatchEvent, Player } from '../types'

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
  const cell =
    'flex h-[86px] flex-col items-center justify-center gap-1.5 rounded-[14px] px-1 text-center ' +
    'transition duration-200 ease-ios active:scale-[0.96]'
  return (
    <div className="grid grid-cols-3 gap-2">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(cell, value === null ? 'bg-brand-fill text-brand-ink' : 'bg-fill text-muted')}
        >
          <span className="text-title3">—</span>
          <span className="text-caption font-medium">Ninguém</span>
        </button>
      )}
      {players.map((player) => (
        <button
          key={player.id}
          type="button"
          onClick={() => onChange(player.id)}
          className={cn(
            cell,
            value === player.id ? 'bg-brand-fill text-brand-ink' : 'bg-fill text-ink',
          )}
        >
          <Avatar player={player} size="sm" />
          <span className="line-clamp-2 text-caption font-medium">
            {firstName(player.full_name)}
          </span>
        </button>
      ))}
    </div>
  )
}

export function LiveMatchPage() {
  const { matchId = '' } = useParams()
  const navigate = useNavigate()
  const { snapshot, isAdmin, actions } = useApp()

  const [goalFor, setGoalFor] = useState<string | null>(null)
  const [scorer, setScorer] = useState<string | null>(null)
  const [assist, setAssist] = useState<string | null>(null)
  const [ownGoal, setOwnGoal] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  // Quando preenchido, a folha de gol está corrigindo um lance já registrado
  // em vez de lançar um novo.
  const [editing, setEditing] = useState<string | null>(null)

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
    setEditing(null)
    setGoalFor(teamId)
    setScorer(null)
    setAssist(null)
    setOwnGoal(false)
    setError('')
  }

  /** Abre a mesma folha já preenchida, para corrigir o lance. */
  function openEdit(event: MatchEvent) {
    setEditing(event.id)
    setGoalFor(event.team_id)
    setScorer(event.scorer_id)
    setAssist(event.assist_id)
    setOwnGoal(event.own_goal)
    setError('')
  }

  function closeGoal() {
    setGoalFor(null)
    setEditing(null)
  }

  async function saveGoal() {
    if (!goalFor || !match) return
    if (!scorer) {
      setError('Escolha quem marcou o gol.')
      return
    }
    setBusy(true)
    setError('')
    const input = {
      team_id: goalFor,
      scorer_id: scorer,
      assist_id: ownGoal ? null : assist,
      own_goal: ownGoal,
    }
    try {
      if (editing) await actions.editGoal(match, editing, input)
      else await actions.addGoal(match, input)
      closeGoal()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o gol.')
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

  /**
   * Encerra a partida inteira, daqui mesmo.
   *
   * Antes este botão só congelava o placar: a rodada continuava aberta e os
   * prêmios só saíam quando alguém voltava e encerrava de novo, num segundo
   * botão de mesmo nome. Como cada rodada tem uma única partida, os dois
   * passos eram sempre o mesmo ato — e o primeiro parecia não ter feito nada.
   * `closeRound` já fecha as partidas em aberto antes de calcular os prêmios.
   */
  async function finish() {
    if (!match) return
    setConfirmFinish(false)
    setBusy(true)
    setError('')
    try {
      await actions.closeRound(match.round_id)
      // Levar direto aos prêmios é o que mostra que encerrou de verdade.
      navigate(`/rodadas/${match.round_id}`, { state: { tab: 'premios' }, replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível encerrar a partida.')
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
      <div className="space-y-6 pb-32">
        {/* O placar usa a cor real de cada time, e é a mesma cor dos botões
            de gol logo abaixo — não há como marcar para o time errado. */}
        <Card className="overflow-hidden">
          <div className="flex items-stretch">
            {[
              { team: home, score: match.score_a },
              { team: away, score: match.score_b },
            ].map(({ team, score }, index) => (
              <div key={team?.id ?? index} className="contents">
                {index > 0 && <span aria-hidden="true" className="w-px bg-line" />}
                <div className="min-w-0 flex-1 p-4 text-center">
                  <TeamDot color={team?.color} className="mx-auto mb-2 block" />
                  <p className="truncate text-subhead text-muted">{team?.name}</p>
                  <p className="mt-1 font-rounded text-[44px] leading-none font-semibold tabular-nums text-ink">
                    {score}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {error && <Note tone="error">{error}</Note>}

        {isAdmin && !live && (
          <Note>
            A partida está encerrada, mas ainda dá para revisar: toque num gol para corrigir o
            autor, a assistência ou o time, ou lance um gol que ficou faltando. O placar e as
            estatísticas se refazem sozinhos.
          </Note>
        )}

        {isAdmin && (
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
                className="flex h-14 items-center justify-center gap-2 rounded-[14px] text-headline transition duration-200 ease-ios active:scale-[0.97] active:opacity-80 disabled:opacity-35"
                style={{
                  ...teamSurface(team?.color ?? '#333333'),
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
          <h2 className="mb-2.5 px-1 text-title3 text-ink">
            Gols {events.length > 0 && <span className="text-muted">· {events.length}</span>}
          </h2>

          {events.length === 0 ? (
            <EmptyState title="Nenhum gol registrado" />
          ) : (
            <ListGroup>
              {events.map((event) => {
                const team = findTeam(snapshot, event.team_id)
                const scorerPlayer = snapshot.players.find((p) => p.id === event.scorer_id)
                const assistPlayer = snapshot.players.find((p) => p.id === event.assist_id)
                return (
                  <div key={event.id} className="flex items-center gap-3 py-2.5 pr-2 pl-5">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full"
                      style={teamSurface(team?.color)}
                    />
                    <div
                      className="min-w-0 flex-1"
                      role={isAdmin ? 'button' : undefined}
                      tabIndex={isAdmin ? 0 : undefined}
                      onClick={isAdmin ? () => openEdit(event) : undefined}
                      onKeyDown={
                        isAdmin
                          ? (keyEvent) => {
                              if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                                keyEvent.preventDefault()
                                openEdit(event)
                              }
                            }
                          : undefined
                      }
                    >
                      <p className="truncate text-body text-ink">
                        {/* Para o administrador a linha inteira abre a
                            correção, então o nome não pode também navegar:
                            um toque dispararia as duas coisas. */}
                        {scorerPlayer ? (
                          isAdmin ? (
                            scorerPlayer.full_name
                          ) : (
                            <Link to={`/jogadores/${scorerPlayer.id}`}>{scorerPlayer.full_name}</Link>
                          )
                        ) : (
                          'Jogador removido'
                        )}
                        {event.own_goal && (
                          <span className="ml-2 text-footnote text-loss">(contra)</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-footnote text-muted">
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
            </ListGroup>
          )}
        </section>
      </div>

      {isAdmin && (
        <ActionBar>
          {live ? (
            <Button
              size="lg"
              block
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmFinish(true)}
            >
              {busy ? 'Encerrando…' : 'Encerrar partida'}
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
        title={`${editing ? 'Corrigir gol do' : 'Gol do'} ${goalFor === match.team_a_id ? home?.name : away?.name}`}
        onClose={closeGoal}
        footer={
          <Button size="lg" block onClick={saveGoal} disabled={busy || !scorer}>
            {busy ? 'Salvando…' : editing ? 'Salvar correção' : 'Registrar gol'}
          </Button>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 px-1 text-footnote font-medium text-muted">
              {ownGoal ? 'Quem marcou contra?' : 'Quem marcou?'}
            </p>
            <PlayerPicker players={scorerOptions} value={scorer} onChange={setScorer} />
          </div>

          {!ownGoal && (
            <div>
              <p className="mb-2 px-1 text-footnote font-medium text-muted">Assistência</p>
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
        message="O placar será fechado e a votação dos prêmios abre por 16 horas para quem jogou."
        confirmLabel="Encerrar"
        destructive={false}
        onConfirm={finish}
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
