import { Link } from 'react-router-dom'
import { AwardsCard } from '../components/AwardsCard'
import { PlayerRow } from '../components/PlayerRow'
import { IconBall, IconChevronRight, IconPlus, IconSettings } from '../components/icons'
import { Badge, Button, Card, EmptyState, SectionTitle, StatTile } from '../components/ui'
import { buildRankings } from '../domain/rankings'
import { highlightRound, playerMap, roundMatches, roundRoster } from '../domain/selectors'
import { formatDate, formatWeekday, percent } from '../lib/format'
import { firstName } from '../lib/format'
import { useApp } from '../store/useApp'
import type { Round } from '../types'

const STATUS_LABEL: Record<Round['status'], { text: string; tone: 'amber' | 'emerald' | 'slate' }> =
  {
    rascunho: { text: 'Rascunho', tone: 'slate' },
    em_andamento: { text: 'Em andamento', tone: 'emerald' },
    encerrada: { text: 'Encerrada', tone: 'amber' },
  }

export function HomePage() {
  const { snapshot, currentPlayer, isAdmin, stats } = useApp()
  const round = highlightRound(snapshot)
  const myStats = currentPlayer ? stats.get(currentPlayer.id) : undefined
  const rankings = buildRankings(snapshot)
  const scorers = rankings.find((list) => list.key === 'artilheiro')
  const byId = playerMap(snapshot)

  const lastClosed = [...snapshot.rounds]
    .filter((item) => item.status === 'encerrada')
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Olá,</p>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {currentPlayer ? firstName(currentPlayer.full_name) : 'jogador'}
          </h1>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-900 text-slate-300"
            aria-label="Administração"
          >
            <IconSettings className="size-5" />
          </Link>
        )}
      </header>

      <section>
        <SectionTitle>Rodada em destaque</SectionTitle>
        {round ? (
          <Link to={`/rodadas/${round.id}`} className="block">
            <Card className="flex items-center gap-3">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <IconBall className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-slate-100">{round.title}</p>
                  <Badge tone={STATUS_LABEL[round.status].tone}>
                    {STATUS_LABEL[round.status].text}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {formatWeekday(round.date)} · {formatDate(round.date)} ·{' '}
                  {roundRoster(snapshot, round.id).length} jogadores ·{' '}
                  {roundMatches(snapshot, round.id).length} partidas
                </p>
              </div>
              <IconChevronRight className="size-5 shrink-0 text-slate-500" />
            </Card>
          </Link>
        ) : (
          <EmptyState
            title="Nenhuma rodada criada"
            description={
              isAdmin
                ? 'Crie a primeira rodada para começar a registrar as partidas.'
                : 'Aguarde o administrador criar a próxima rodada.'
            }
            action={
              isAdmin ? (
                <Link to="/rodadas/nova">
                  <Button>
                    <IconPlus className="size-5" /> Nova rodada
                  </Button>
                </Link>
              ) : undefined
            }
          />
        )}
      </section>

      {currentPlayer && myStats && (
        <section>
          <SectionTitle
            action={
              <Link to={`/jogadores/${currentPlayer.id}`} className="text-xs text-emerald-400">
                ver perfil
              </Link>
            }
          >
            Seus números
          </SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            <StatTile label="Jogos" value={myStats.played} />
            <StatTile label="Vitórias" value={myStats.wins} />
            {currentPlayer.position === 'goleiro' ? (
              <>
                <StatTile label="Sofridos" value={myStats.goalsAgainst} />
                <StatTile label="S/ sofrer" value={myStats.cleanSheets} />
              </>
            ) : (
              <>
                <StatTile label="Gols" value={myStats.goals} />
                <StatTile label="Assist." value={myStats.assists} />
              </>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            Aproveitamento de {percent(myStats.pointsPct)}
          </p>
        </section>
      )}

      {lastClosed && (
        <section>
          <SectionTitle
            action={
              <Link to={`/rodadas/${lastClosed.id}`} className="text-xs text-emerald-400">
                ver rodada
              </Link>
            }
          >
            Prêmios de {formatDate(lastClosed.date)}
          </SectionTitle>
          <AwardsCard snapshot={snapshot} roundId={lastClosed.id} />
        </section>
      )}

      {scorers && scorers.entries.length > 0 && (
        <section>
          <SectionTitle
            action={
              <Link to="/rankings" className="text-xs text-emerald-400">
                todos
              </Link>
            }
          >
            Artilharia
          </SectionTitle>
          <div className="space-y-2">
            {scorers.entries.slice(0, 3).map((entry, index) => {
              const player = byId.get(entry.playerId)
              if (!player) return null
              return (
                <PlayerRow
                  key={entry.playerId}
                  player={player}
                  rank={index + 1}
                  to={`/jogadores/${player.id}`}
                  right={
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {entry.display}
                    </span>
                  }
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
