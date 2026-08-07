import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AttendanceControl } from '../components/AttendanceControl'
import { AwardsCard } from '../components/AwardsCard'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { ShareRound } from '../components/ShareRound'
import { IconClose, IconPlus, IconShuffle } from '../components/icons'
import {
  ActionBar,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  ListGroup,
  ListRow,
  Note,
  SectionHeader,
  Select,
  Tabs,
  Tag,
} from '../components/ui'
import { attendanceLists } from '../domain/attendance'
import { findRound, playerMap, roundMatches, roundTeams, teamPlayers } from '../domain/selectors'
import { computeStats } from '../domain/stats'
import { formatDate, formatWeekday } from '../lib/format'
import { playerCaption } from '../lib/player'
import { useApp } from '../store/useApp'
import type { Player } from '../types'

type Tab = 'presenca' | 'times' | 'partidas' | 'premios'

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
  const [confirm, setConfirm] = useState<'regenerar' | 'encerrar' | 'excluir' | null>(null)
  const [newMatch, setNewMatch] = useState(false)
  const [addPlayer, setAddPlayer] = useState(false)
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')

  if (!round) {
    return (
      <Page title="Rodada" back>
        <EmptyState title="Rodada não encontrada" />
      </Page>
    )
  }

  const closed = round.status === 'encerrada'
  const byId = playerMap(snapshot)
  const rows = snapshot.roundPlayers.filter((rp) => rp.round_id === roundId)
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

  async function createMatch() {
    const a = teamA || teams[0]?.id
    const b = teamB || teams[1]?.id
    if (!a || !b || a === b) {
      setError('Escolha dois times diferentes.')
      return
    }
    await guard(async () => {
      const match = await actions.createMatch(roundId, a, b)
      setNewMatch(false)
      navigate(`/partidas/${match.id}`)
    })
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
                      label={`Tirar ${player.full_name} da rodada`}
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
          { value: 'partidas', label: 'Partidas' },
          { value: 'premios', label: 'Prêmios' },
        ]}
      />

      <div className="mt-5 space-y-6 pb-24">
        {error && <Note tone="error">{error}</Note>}

        {tab === 'presenca' && (
          <>
            <Card className="p-4">
              <p className="mb-3 text-center text-sm text-muted">
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
              title="Times ainda não gerados"
              description={
                isAdmin
                  ? 'Gere as equipes a partir de quem confirmou presença.'
                  : 'O administrador ainda não montou as equipes.'
              }
              action={
                isAdmin ? (
                  <Button onClick={() => setConfirm('regenerar')}>
                    <IconShuffle className="size-5" /> Gerar times
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {teams.map((team) => {
                const squad = teamPlayers(snapshot, team.id)
                return (
                  <section key={team.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-4 w-1.5 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <h2 className="text-[15px] font-semibold text-ink">{team.name}</h2>
                      <span className="text-sm text-muted">{squad.length} jogadores</span>
                    </div>
                    <ListGroup>
                      {squad.map((player) => {
                        const entry = roundStats.get(player.id)
                        return (
                          <PlayerRow
                            key={player.id}
                            player={player}
                            to={`/jogadores/${player.id}`}
                            subtitle={
                              player.position === 'goleiro'
                                ? `Goleiro · ${entry?.goalsAgainst ?? 0} sofridos`
                                : `${entry?.goals ?? 0} gols · ${entry?.assists ?? 0} assistências`
                            }
                          />
                        )
                      })}
                    </ListGroup>
                  </section>
                )
              })}

              <ShareRound round={round} kind="escalacao" />

              {isAdmin && !closed && (
                <Button variant="secondary" block onClick={() => setConfirm('regenerar')} disabled={busy}>
                  <IconShuffle className="size-5" /> Gerar times novamente
                </Button>
              )}

              {isAdmin && (
                <Button variant="quiet" block destructive onClick={() => setConfirm('excluir')}>
                  Excluir rodada
                </Button>
              )}
            </>
          ))}

        {tab === 'partidas' && (
          <>
            {isAdmin && !closed && teams.length >= 2 && (
              <Button block onClick={() => setNewMatch(true)} disabled={busy}>
                <IconPlus className="size-5" /> Nova partida
              </Button>
            )}

            {matches.length === 0 ? (
              <EmptyState
                title="Nenhuma partida ainda"
                description={
                  teams.length === 0
                    ? 'Gere os times antes de começar as partidas.'
                    : isAdmin
                      ? 'Crie a primeira partida da rodada.'
                      : 'A rodada ainda não começou.'
                }
              />
            ) : (
              <ListGroup>
                {matches.map((match) => {
                  const home = teams.find((team) => team.id === match.team_a_id)
                  const away = teams.find((team) => team.id === match.team_b_id)
                  return (
                    <ListRow
                      key={match.id}
                      to={`/partidas/${match.id}`}
                      chevron
                      title={`${home?.name ?? '—'} × ${away?.name ?? '—'}`}
                      subtitle={`Partida ${match.sequence}`}
                      trailing={
                        <span className="flex items-center gap-2">
                          {match.status === 'em_andamento' && <Tag tone="live">Ao vivo</Tag>}
                          <span className="text-lg font-semibold tabular-nums text-ink">
                            {match.score_a}–{match.score_b}
                          </span>
                        </span>
                      }
                    />
                  )
                })}
              </ListGroup>
            )}
          </>
        )}

        {tab === 'premios' && (
          <>
            <AwardsCard snapshot={snapshot} roundId={roundId} />
            {matches.length > 0 && <ShareRound round={round} kind="resultado" />}
          </>
        )}
      </div>

      {isAdmin && !closed && teams.length === 0 && lists.confirmed.length > 0 && (
        <ActionBar>
          <Button size="lg" block onClick={() => setConfirm('regenerar')} disabled={busy}>
            <IconShuffle className="size-5" /> Gerar times com {lists.confirmed.length} confirmados
          </Button>
        </ActionBar>
      )}

      {isAdmin && round.status === 'rascunho' && teams.length > 0 && (
        <ActionBar>
          <Button size="lg" block onClick={() => guard(() => actions.startRound(roundId))} disabled={busy}>
            Iniciar rodada
          </Button>
        </ActionBar>
      )}

      {isAdmin && round.status === 'em_andamento' && (
        <ActionBar>
          <Button size="lg" block variant="secondary" onClick={() => setConfirm('encerrar')} disabled={busy}>
            Encerrar rodada
          </Button>
        </ActionBar>
      )}

      <Modal open={addPlayer} title="Confirmar jogador" onClose={() => setAddPlayer(false)}>
        <p className="mb-3 text-sm text-muted">
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

      <Modal
        open={newMatch}
        title="Nova partida"
        onClose={() => setNewMatch(false)}
        footer={
          <Button size="lg" block onClick={createMatch} disabled={busy}>
            Começar partida
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Time da casa">
            <Select value={teamA || teams[0]?.id} onChange={(e) => setTeamA(e.target.value)}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time visitante">
            <Select value={teamB || teams[1]?.id} onChange={(e) => setTeamB(e.target.value)}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          {error && <Note tone="error">{error}</Note>}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm === 'regenerar'}
        title={teams.length === 0 ? 'Gerar times' : 'Gerar times novamente'}
        message={
          teams.length === 0
            ? `As equipes serão montadas com os ${lists.confirmed.length} jogadores que confirmaram presença, equilibrando pelo histórico de cada um.`
            : 'As equipes serão remontadas com quem está confirmado agora. As partidas já registradas nesta rodada serão apagadas.'
        }
        confirmLabel="Gerar"
        destructive={matches.length > 0}
        onConfirm={() => {
          setConfirm(null)
          guard(async () => {
            await actions.generateTeamsForRound(roundId, round.team_count)
            setTab('times')
          })
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === 'encerrar'}
        title="Encerrar rodada"
        message="As partidas em andamento serão finalizadas, os prêmios calculados e as estatísticas atualizadas."
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
        title="Excluir rodada"
        message="Toda a rodada será apagada: presenças, times, partidas, gols e prêmios."
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
