import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AwardsCard } from '../components/AwardsCard'
import { ConfirmDialog, Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { PlayerRow } from '../components/PlayerRow'
import { IconChevronRight, IconPlus, IconShuffle, IconTrash } from '../components/icons'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Segmented,
  Select,
  StatTile,
} from '../components/ui'
import { computeStats } from '../domain/stats'
import { findRound, roundMatches, roundRoster, roundTeams, teamPlayers } from '../domain/selectors'
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
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newMatch, setNewMatch] = useState(false)

  const round = findRound(snapshot, roundId)
  const teams = roundTeams(snapshot, roundId)
  const matches = roundMatches(snapshot, roundId)
  const roster = roundRoster(snapshot, roundId)
  const roundStats = useMemo(() => computeStats(snapshot, { roundId }), [snapshot, roundId])

  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')

  if (!round) {
    return (
      <>
        <PageHeader title="Rodada" back />
        <EmptyState title="Rodada não encontrada" />
      </>
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
    <div className="pb-20">
      <PageHeader
        title={round.title}
        subtitle={`${formatWeekday(round.date)} · ${formatDate(round.date)}`}
        back
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-900 text-red-300"
              aria-label="Excluir rodada"
            >
              <IconTrash className="size-5" />
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile label="Jogadores" value={roster.length} />
        <StatTile label="Times" value={teams.length} />
        <StatTile label="Partidas" value={matches.length} />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Badge tone={closed ? 'amber' : round.status === 'em_andamento' ? 'emerald' : 'slate'}>
          {closed ? 'Encerrada' : round.status === 'em_andamento' ? 'Em andamento' : 'Rascunho'}
        </Badge>
        {isAdmin && round.status === 'rascunho' && (
          <Button size="sm" onClick={() => guard(() => actions.startRound(roundId))} disabled={busy}>
            Iniciar rodada
          </Button>
        )}
        {isAdmin && round.status === 'em_andamento' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmClose(true)}
            disabled={busy}
          >
            Encerrar rodada
          </Button>
        )}
      </div>

      <ErrorText>{error}</ErrorText>

      <div className="my-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'times', label: 'Times' },
            { value: 'partidas', label: 'Partidas' },
            { value: 'premios', label: 'Prêmios' },
          ]}
        />
      </div>

      {tab === 'times' && (
        <div className="space-y-4">
          {isAdmin && !closed && (
            <Button
              variant="secondary"
              block
              onClick={() => setConfirmRegenerate(true)}
              disabled={busy}
            >
              <IconShuffle className="size-5" /> Gerar times novamente
            </Button>
          )}

          {teams.length === 0 ? (
            <EmptyState
              title="Times ainda não gerados"
              description="Use o botão acima para montar equipes equilibradas."
            />
          ) : (
            teams.map((team) => {
              const squad = teamPlayers(snapshot, team.id)
              return (
                <section key={team.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: team.color }}
                      aria-hidden="true"
                    />
                    <h2 className="font-bold text-slate-100">{team.name}</h2>
                    <span className="text-xs text-slate-500">{squad.length} jogadores</span>
                  </div>
                  <div className="space-y-2">
                    {squad.map((player) => {
                      const entry = roundStats.get(player.id)
                      return (
                        <PlayerRow
                          key={player.id}
                          player={player}
                          to={`/jogadores/${player.id}`}
                          subtitle={
                            player.position === 'goleiro'
                              ? `${entry?.goalsAgainst ?? 0} gols sofridos na rodada`
                              : `${entry?.goals ?? 0} gols · ${entry?.assists ?? 0} assist. na rodada`
                          }
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>
      )}

      {tab === 'partidas' && (
        <div className="space-y-3">
          {isAdmin && !closed && teams.length >= 2 && (
            <Button block onClick={() => setNewMatch(true)} disabled={busy}>
              <IconPlus className="size-5" /> Nova partida
            </Button>
          )}

          {matches.length === 0 ? (
            <EmptyState
              title="Nenhuma partida registrada"
              description={
                isAdmin ? 'Crie a primeira partida da rodada.' : 'A rodada ainda não começou.'
              }
            />
          ) : (
            matches.map((match) => {
              const home = teams.find((team) => team.id === match.team_a_id)
              const away = teams.find((team) => team.id === match.team_b_id)
              return (
                <Link key={match.id} to={`/partidas/${match.id}`}>
                  <Card className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">Partida {match.sequence}</p>
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {home?.name ?? '—'} <span className="text-slate-500">x</span>{' '}
                        {away?.name ?? '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold tabular-nums">
                        {match.score_a} <span className="text-slate-600">-</span> {match.score_b}
                      </p>
                      {match.status === 'em_andamento' && (
                        <Badge tone="emerald">Ao vivo</Badge>
                      )}
                    </div>
                    <IconChevronRight className="size-5 shrink-0 text-slate-500" />
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}

      {tab === 'premios' && <AwardsCard snapshot={snapshot} roundId={roundId} />}

      <Modal
        open={newMatch}
        title="Nova partida"
        onClose={() => setNewMatch(false)}
        footer={
          <Button block onClick={createMatch} disabled={busy}>
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
          <ErrorText>{error}</ErrorText>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Gerar times novamente"
        message="As equipes serão remontadas com base nas estatísticas atuais. As partidas já registradas nesta rodada serão apagadas."
        confirmLabel="Gerar novamente"
        onConfirm={() => {
          setConfirmRegenerate(false)
          guard(() => actions.generateTeamsForRound(roundId, round.team_count))
        }}
        onCancel={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        open={confirmClose}
        title="Encerrar rodada"
        message="As partidas em andamento serão finalizadas, os prêmios calculados e as estatísticas atualizadas."
        confirmLabel="Encerrar"
        onConfirm={() => {
          setConfirmClose(false)
          guard(async () => {
            await actions.closeRound(roundId)
            setTab('premios')
          })
        }}
        onCancel={() => setConfirmClose(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir rodada"
        message="Toda a rodada será apagada: times, partidas, gols e prêmios. As estatísticas dos jogadores serão recalculadas sem ela."
        confirmLabel="Excluir"
        onConfirm={() => {
          setConfirmDelete(false)
          guard(async () => {
            await actions.deleteRound(roundId)
            navigate('/rodadas', { replace: true })
          })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
