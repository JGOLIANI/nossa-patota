import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AwardsCard } from '../components/AwardsCard'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { IconPlus, IconShuffle } from '../components/icons'
import {
  ActionBar,
  Button,
  EmptyState,
  Field,
  ListGroup,
  ListRow,
  Note,
  Select,
  Tabs,
  Tag,
} from '../components/ui'
import { findRound, roundMatches, roundRoster, roundTeams, teamPlayers } from '../domain/selectors'
import { computeStats } from '../domain/stats'
import { formatDate, formatWeekday } from '../lib/format'
import { useApp } from '../store/useApp'

type Tab = 'times' | 'partidas' | 'premios'

export function RoundDetailPage() {
  const { roundId = '' } = useParams()
  const navigate = useNavigate()
  const { snapshot, isAdmin, actions } = useApp()

  const [tab, setTab] = useState<Tab>('times')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'regenerar' | 'encerrar' | 'excluir' | null>(null)
  const [newMatch, setNewMatch] = useState(false)
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')

  const round = findRound(snapshot, roundId)
  const teams = roundTeams(snapshot, roundId)
  const matches = roundMatches(snapshot, roundId)
  const roster = roundRoster(snapshot, roundId)
  const roundStats = useMemo(() => computeStats(snapshot, { roundId }), [snapshot, roundId])

  if (!round) {
    return (
      <Page title="Rodada" back>
        <EmptyState title="Rodada não encontrada" />
      </Page>
    )
  }

  const closed = round.status === 'encerrada'

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

  return (
    <Page
      title={round.title}
      subtitle={
        <>
          {formatWeekday(round.date)}, {formatDate(round.date)} · {roster.length} jogadores ·{' '}
          {matches.length} partidas
        </>
      }
      back
      action={
        round.status !== 'rascunho' ? (
          <Tag tone={closed ? 'done' : 'live'}>{closed ? 'Encerrada' : 'Ao vivo'}</Tag>
        ) : (
          <Tag>Rascunho</Tag>
        )
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'times', label: 'Times' },
          { value: 'partidas', label: 'Partidas' },
          { value: 'premios', label: 'Prêmios' },
        ]}
      />

      <div className="mt-5 space-y-5 pb-20">
        {error && <Note tone="error">{error}</Note>}

        {tab === 'times' &&
          (teams.length === 0 ? (
            <EmptyState
              title="Times ainda não gerados"
              description="Gere as equipes para começar a rodada."
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
                  isAdmin ? 'Crie a primeira partida da rodada.' : 'A rodada ainda não começou.'
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

        {tab === 'premios' && <AwardsCard snapshot={snapshot} roundId={roundId} />}
      </div>

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
        title="Gerar times novamente"
        message="As equipes serão remontadas com as estatísticas atuais. As partidas já registradas nesta rodada serão apagadas."
        confirmLabel="Gerar"
        destructive={matches.length > 0}
        onConfirm={() => {
          setConfirm(null)
          guard(() => actions.generateTeamsForRound(roundId, round.team_count))
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
        message="Toda a rodada será apagada: times, partidas, gols e prêmios. As estatísticas dos jogadores serão recalculadas sem ela."
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
