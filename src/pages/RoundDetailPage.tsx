import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AttendanceControl } from '../components/AttendanceControl'
import { AwardsCard } from '../components/AwardsCard'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { ShareRound } from '../components/ShareRound'
import { IconBall, IconClose, IconGlove, IconPlus, IconShuffle } from '../components/icons'
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  Note,
  SectionHeader,
  Tabs,
  Tag,
} from '../components/ui'
import { attendanceLists } from '../domain/attendance'
import {
  findRound,
  playerMap,
  positionInRound,
  roundEntries,
  roundMatches,
  roundTeams,
  teamPlayers,
} from '../domain/selectors'
import { computeStats } from '../domain/stats'
import { formatDate, formatWeekday } from '../lib/format'
import { playerCaption } from '../lib/player'
import { useApp } from '../store/useApp'
import type { Player } from '../types'

type Tab = 'presenca' | 'times' | 'premios'

export function RoundDetailPage() {
  const { roundId = '' } = useParams()
  const navigate = useNavigate()
  const { snapshot, isAdmin, actions } = useApp()

  const round = findRound(snapshot, roundId)
  const teams = roundTeams(snapshot, roundId)
  const matches = roundMatches(snapshot, roundId)
  const roundStats = useMemo(() => computeStats(snapshot, { roundId }), [snapshot, roundId])

  const [tab, setTab] = useState<Tab>(teams.length > 0 ? 'times' : 'presenca')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'sortear' | 'encerrar' | 'excluir' | null>(null)
  const [addPlayer, setAddPlayer] = useState(false)

  if (!round) {
    return (
      <Page title="Partida" back>
        <EmptyState title="Partida não encontrada" />
      </Page>
    )
  }

  const closed = round.status === 'encerrada'
  const byId = playerMap(snapshot)
  const rows = roundEntries(snapshot, roundId)
  const lists = attendanceLists(rows)
  const responded = new Set(rows.map((row) => row.player_id))
  const available = snapshot.players.filter(
    (player) => player.status === 'ativo' && !responded.has(player.id),
  )

  async function guard(operation: () => Promise<unknown>) {
    setError('')
    setBusy(true)
    try {
      await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  function attendanceGroup(title: string, entries: typeof lists.confirmed, numbered = false) {
    if (entries.length === 0) return null
    return (
      <section>
        <SectionHeader title={`${title} · ${entries.length}`} />
        <ListGroup>
          {entries.map((entry, index) => {
            const player = byId.get(entry.player_id)
            if (!player) return null
            return (
              <PlayerRow
                key={entry.player_id}
                player={player}
                rank={numbered ? index + 1 : undefined}
                subtitle={playerCaption(player)}
                trailing={
                  isAdmin && !closed ? (
                    <IconButton
                      label={`Tirar ${player.full_name} da partida`}
                      onClick={() => guard(() => actions.removeFromRound(roundId, player.id))}
                    >
                      <IconClose className="size-4" />
                    </IconButton>
                  ) : undefined
                }
              />
            )
          })}
        </ListGroup>
      </section>
    )
  }

  return (
    <Page
      title={round.title}
      subtitle={
        <>
          {formatWeekday(round.date)}, {formatDate(round.date)} às {round.start_time}
          {round.location && ` · ${round.location}`}
        </>
      }
      back
      action={
        <Tag tone={closed ? 'done' : round.status === 'em_andamento' ? 'live' : 'neutral'}>
          {closed ? 'Encerrada' : round.status === 'em_andamento' ? 'Ao vivo' : 'Aberta'}
        </Tag>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'presenca', label: 'Presença' },
          { value: 'times', label: 'Times' },
          { value: 'premios', label: 'Prêmios' },
        ]}
      />

      <div className="mt-5 space-y-6 pb-24">
        {error && <Note tone="error">{error}</Note>}

        {tab === 'presenca' && (
          <>
            <Card className="p-4">
              <p className="mb-3 text-center text-subhead text-muted">
                {round.max_players > 0
                  ? `${lists.confirmed.length} de ${round.max_players} vagas preenchidas`
                  : `${lists.confirmed.length} confirmados`}
                {lists.waiting.length > 0 && ` · ${lists.waiting.length} na espera`}
              </p>
              <AttendanceControl round={round} />
            </Card>

            {attendanceGroup('Confirmados', lists.confirmed)}
            {attendanceGroup('Lista de espera', lists.waiting, true)}
            {attendanceGroup('Não vão', lists.out)}

            {lists.confirmed.length === 0 && lists.waiting.length === 0 && (
              <EmptyState
                title="Ninguém confirmou ainda"
                description="Assim que o pessoal responder, os nomes aparecem aqui."
              />
            )}

            {isAdmin && !closed && available.length > 0 && (
              <Button variant="secondary" block onClick={() => setAddPlayer(true)}>
                <IconPlus className="size-5" /> Confirmar alguém na mão
              </Button>
            )}
          </>
        )}

        {tab === 'times' &&
          (teams.length === 0 ? (
            <EmptyState
              title="Times ainda não sorteados"
              description={
                isAdmin
                  ? 'O sorteio divide quem confirmou em dois times e já abre o placar.'
                  : 'O administrador ainda não sorteou as equipes.'
              }
              action={
                isAdmin ? (
                  <Button onClick={() => setConfirm('sortear')}>
                    <IconShuffle className="size-5" /> Sortear times
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {matches.length > 0 && (
                <section>
                  <SectionHeader title="Placar" />
                  <ListGroup>
                    {matches.map((match) => {
                      const home = teams.find((team) => team.id === match.team_a_id)
                      const away = teams.find((team) => team.id === match.team_b_id)
                      return (
                        <ListRow
                          key={match.id}
                          to={`/partidas/${match.id}`}
                          chevron
                          leading={
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-muted">
                              <IconBall className="size-5" />
                            </span>
                          }
                          title={`${home?.name ?? '—'} × ${away?.name ?? '—'}`}
                          subtitle={
                            match.status === 'em_andamento' ? 'Registrar gols' : 'Encerrado'
                          }
                          trailing={
                            <span className="font-rounded text-title3 tabular-nums text-ink">
                              {match.score_a}–{match.score_b}
                            </span>
                          }
                        />
                      )
                    })}
                  </ListGroup>
                </section>
              )}

              {teams.map((team) => {
                const squad = teamPlayers(snapshot, team.id)
                return (
                  <section key={team.id}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <h2 className="text-headline text-ink">{team.name}</h2>
                      <span className="text-subhead text-muted">{squad.length} jogadores</span>
                    </div>
                    <ListGroup>
                      {squad.map((player) => {
                        const entry = roundStats.get(player.id)
                        const playing = positionInRound(snapshot, roundId, player.id)
                        return (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            to={`/jogadores/${player.id}`}
                            subtitle={
                              playing === 'goleiro'
                                ? `No gol · ${entry?.goalsAgainst ?? 0} sofridos`
                                : `Na linha · ${entry?.goals ?? 0} gols · ${entry?.assists ?? 0} assist.`
                            }
                            trailing={
                              isAdmin && !closed ? (
                                <IconButton
                                  label={
                                    playing === 'goleiro'
                                      ? `Passar ${player.full_name} para a linha`
                                      : `Colocar ${player.full_name} no gol`
                                  }
                                  className={playing === 'goleiro' ? 'text-brand' : undefined}
                                  onClick={() =>
                                    guard(() =>
                                      actions.setRoundPosition(
                                        roundId,
                                        player.id,
                                        playing === 'goleiro' ? 'linha' : 'goleiro',
                                      ),
                                    )
                                  }
                                >
                                  <IconGlove className="size-5" />
                                </IconButton>
                              ) : undefined
                            }
                          />
                        )
                      })}
                    </ListGroup>
                  </section>
                )
              })}

              {isAdmin && !closed && (
                <Note>
                  Toque na luva para trocar quem está no gol nesta partida. Os gols sofridos
                  contam só para quem estiver debaixo das traves.
                </Note>
              )}

              <ShareRound round={round} kind="escalacao" />

              {isAdmin && !closed && (
                <Button variant="secondary" block onClick={() => setConfirm('sortear')} disabled={busy}>
                  <IconShuffle className="size-5" /> Sortear novamente
                </Button>
              )}

              {isAdmin && (
                <Button variant="quiet" block destructive onClick={() => setConfirm('excluir')}>
                  Excluir partida
                </Button>
              )}
            </>
          ))}

        {tab === 'premios' && (
          <>
            <AwardsCard snapshot={snapshot} roundId={roundId} />
            {matches.length > 0 && <ShareRound round={round} kind="resultado" />}
          </>
        )}
      </div>

      {isAdmin && !closed && teams.length === 0 && lists.confirmed.length > 0 && (
        <ActionBar>
          <Button size="lg" block onClick={() => setConfirm('sortear')} disabled={busy}>
            <IconShuffle className="size-5" /> Sortear times · {lists.confirmed.length}
          </Button>
        </ActionBar>
      )}

      {isAdmin && !closed && teams.length > 0 && (
        <ActionBar>
          <Button size="lg" block variant="secondary" onClick={() => setConfirm('encerrar')} disabled={busy}>
            Encerrar partida
          </Button>
        </ActionBar>
      )}

      <Modal open={addPlayer} title="Confirmar jogador" onClose={() => setAddPlayer(false)}>
        <p className="mb-3 px-1 text-footnote text-muted">
          Para quem avisou por fora que vai jogar. Ele entra como confirmado, ou na lista de
          espera se as vagas já acabaram.
        </p>
        <ListGroup>
          {available.map((player: Player) => (
            <PlayerRow
              key={player.id}
              player={player}
              subtitle={playerCaption(player)}
              onClick={() =>
                guard(async () => {
                  const attendance =
                    round.max_players > 0 && lists.confirmed.length >= round.max_players
                      ? 'espera'
                      : 'confirmado'
                  await actions.setAttendance(roundId, player.id, attendance)
                  setAddPlayer(false)
                })
              }
            />
          ))}
        </ListGroup>
      </Modal>

      <ConfirmDialog
        open={confirm === 'sortear'}
        title={teams.length === 0 ? 'Sortear times' : 'Sortear novamente'}
        message={
          teams.length === 0
            ? `Os ${lists.confirmed.length} confirmados serão divididos em dois times equilibrados pelo histórico de cada um, e o placar já abre.`
            : 'Os times serão refeitos com quem está confirmado agora. Os gols já registrados nesta partida serão apagados.'
        }
        confirmLabel="Sortear"
        destructive={matches.length > 0}
        onConfirm={() => {
          setConfirm(null)
          guard(async () => {
            await actions.generateTeamsForRound(roundId)
            setTab('times')
          })
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'encerrar'}
        title="Encerrar partida"
        message="O placar será fechado, os prêmios calculados e as estatísticas atualizadas."
        confirmLabel="Encerrar"
        destructive={false}
        onConfirm={() => {
          setConfirm(null)
          guard(async () => {
            await actions.closeRound(roundId)
            setTab('premios')
          })
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'excluir'}
        title="Excluir partida"
        message="Tudo será apagado: presenças, times, placar, gols e prêmios."
        confirmLabel="Excluir"
        onConfirm={() => {
          setConfirm(null)
          guard(async () => {
            await actions.deleteRound(roundId)
            navigate('/rodadas', { replace: true })
          })
        }}
        onCancel={() => setConfirm(null)}
      />
    </Page>
  )
}
