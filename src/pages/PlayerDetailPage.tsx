import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PageHeader'
import { PlayerFormModal } from '../components/PlayerFormModal'
import { IconEdit } from '../components/icons'
import { Badge, Card, EmptyState, SectionTitle, StatTile } from '../components/ui'
import { awardCounts } from '../domain/awards'
import { findRound } from '../domain/selectors'
import { playerHistory } from '../domain/stats'
import { formatDate, percent } from '../lib/format'
import { useApp } from '../store/useApp'
import { AWARD_LABELS, type AwardType } from '../types'

const FOOT_LABEL = {
  direita: 'Destro',
  esquerda: 'Canhoto',
  ambidestro: 'Ambidestro',
}

const RESULT_TONE = {
  V: 'bg-emerald-500/15 text-emerald-300',
  E: 'bg-slate-700 text-slate-300',
  D: 'bg-red-500/15 text-red-300',
}

export function PlayerDetailPage() {
  const { playerId } = useParams()
  const { snapshot, stats, isAdmin } = useApp()
  const [editing, setEditing] = useState(false)

  const player = snapshot.players.find((item) => item.id === playerId)
  if (!player) {
    return (
      <>
        <PageHeader title="Jogador" back />
        <EmptyState title="Jogador não encontrado" />
      </>
    )
  }

  const entry = stats.get(player.id)!
  const history = playerHistory(snapshot, player.id).slice(0, 10)
  const awards = awardCounts(snapshot, player.id)
  const isKeeper = player.position === 'goleiro'

  return (
    <div>
      <PageHeader
        title="Perfil"
        back
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-900 text-slate-300"
              aria-label="Editar jogador"
            >
              <IconEdit className="size-5" />
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-col items-center text-center">
        <Avatar player={player} size="xl" />
        <h2 className="mt-3 text-xl font-bold">{player.full_name}</h2>
        <p className="text-sm text-slate-400">@{player.username}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Badge tone={player.player_type === 'mensalista' ? 'emerald' : 'violet'}>
            {player.player_type === 'mensalista' ? 'Mensalista' : 'Visitante'}
          </Badge>
          <Badge tone="sky">{isKeeper ? 'Goleiro' : 'Jogador de linha'}</Badge>
          <Badge>{FOOT_LABEL[player.dominant_foot]}</Badge>
          <Badge tone={player.status === 'ativo' ? 'emerald' : 'slate'}>
            {player.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <section className="mt-6">
        <SectionTitle>Números</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Jogos" value={entry.played} />
          <StatTile label="Vitórias" value={entry.wins} />
          <StatTile label="Derrotas" value={entry.losses} />
          {isKeeper ? (
            <>
              <StatTile label="Sofridos" value={entry.goalsAgainst} />
              <StatTile label="Sem sofrer" value={entry.cleanSheets} />
              <StatTile
                label="Média sofr."
                value={entry.goalsAgainstPerMatch.toFixed(2).replace('.', ',')}
              />
            </>
          ) : (
            <>
              <StatTile label="Gols" value={entry.goals} />
              <StatTile label="Assistências" value={entry.assists} />
              <StatTile label="Particip." value={entry.participations} />
            </>
          )}
          <StatTile label="Empates" value={entry.draws} />
          <StatTile label="Aproveit." value={percent(entry.pointsPct)} />
          <StatTile
            label={isKeeper ? 'Jogos' : 'Gols/jogo'}
            value={
              isKeeper ? entry.played : entry.goalsPerMatch.toFixed(2).replace('.', ',')
            }
          />
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Premiações</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(AWARD_LABELS) as AwardType[]).map((type) => (
            <StatTile key={type} label={AWARD_LABELS[type]} value={awards[type]} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Últimas partidas</SectionTitle>
        {history.length === 0 ? (
          <EmptyState title="Ainda não jogou nenhuma partida" />
        ) : (
          <div className="space-y-2">
            {history.map((item) => {
              const round = findRound(snapshot, item.roundId)
              return (
                <Link key={item.matchId} to={`/rodadas/${item.roundId}`}>
                  <Card className="flex items-center gap-3 py-3">
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-xl text-sm font-bold ${RESULT_TONE[item.result]}`}
                    >
                      {item.result}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {item.scoreFor} x {item.scoreAgainst}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {round ? `${round.title} · ${formatDate(round.date)}` : '—'}
                      </p>
                    </div>
                    {!isKeeper && (item.goals > 0 || item.assists > 0) && (
                      <span className="shrink-0 text-xs text-slate-300">
                        {item.goals > 0 && `${item.goals}G`}
                        {item.goals > 0 && item.assists > 0 && ' · '}
                        {item.assists > 0 && `${item.assists}A`}
                      </span>
                    )}
                    {isKeeper && item.scoreAgainst === 0 && <Badge tone="sky">Não sofreu</Badge>}
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {editing && <PlayerFormModal player={player} onClose={() => setEditing(false)} />}
    </div>
  )
}
