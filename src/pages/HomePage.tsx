import { Link, useNavigate } from 'react-router-dom'
import { AttendanceControl } from '../components/AttendanceControl'
import { AwardsCard } from '../components/AwardsCard'
import { Page } from '../components/Page'
import { IconPlus } from '../components/icons'
import {
  Button,
  Card,
  EmptyState,
  SectionHeader,
  SectionLink,
  Stat,
  StatRow,
  Tag,
} from '../components/ui'
import { attendanceSummary } from '../domain/attendance'
import { upcomingRound } from '../domain/schedule'
import { highlightRound, roundEntries, roundMatches } from '../domain/selectors'
import { firstName, formatDate, formatWeekday, percent, todayISO } from '../lib/format'
import { useApp } from '../store/useApp'

export function HomePage() {
  const { snapshot, currentPlayer, isAdmin, stats } = useApp()
  const navigate = useNavigate()

  // A próxima rodada em aberto é o que interessa; só quando não há nenhuma
  // é que a tela cai para a última encerrada.
  const round = upcomingRound(snapshot.rounds, todayISO()) ?? highlightRound(snapshot)
  const myStats = currentPlayer ? stats.get(currentPlayer.id) : undefined
  const playedInGoal = (myStats?.keeperMatches ?? 0) > 0

  const lastClosed = [...snapshot.rounds]
    .filter((item) => item.status === 'encerrada')
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <Page title={currentPlayer ? `Olá, ${firstName(currentPlayer.full_name)}` : 'Nossa Patota'} profile>
      <div className="space-y-7">
        <section>
          <SectionHeader
            title="Rodada"
            action={snapshot.rounds.length > 0 ? <SectionLink to="/rodadas">histórico</SectionLink> : undefined}
          />

          {round ? (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-title3 text-ink">{round.title}</h3>
                  <p className="mt-0.5 text-subhead text-muted">
                    {formatWeekday(round.date)}, {formatDate(round.date)}
                  </p>
                </div>
                <Tag tone={round.status === 'em_andamento' ? 'live' : 'neutral'}>
                  {round.status === 'em_andamento'
                    ? 'Em andamento'
                    : round.status === 'encerrada'
                      ? 'Encerrada'
                      : 'Rascunho'}
                </Tag>
              </div>

              {round.location && (
                <p className="mt-1 text-subhead text-muted">
                  {round.start_time} · {round.location}
                </p>
              )}

              <p className="mt-3 text-subhead text-muted">
                {round.status === 'encerrada'
                  ? `${roundMatches(snapshot, round.id).length} partidas disputadas`
                  : attendanceSummary(roundEntries(snapshot, round.id), round.max_players)}
              </p>

              {round.status !== 'encerrada' && (
                <div className="mt-4">
                  <AttendanceControl round={round} />
                </div>
              )}

              <Button
                size="lg"
                variant={round.status === 'encerrada' ? 'primary' : 'secondary'}
                block
                className="mt-2"
                onClick={() => navigate(`/rodadas/${round.id}`)}
              >
                {round.status === 'encerrada' ? 'Ver resultados' : 'Abrir rodada'}
              </Button>
            </Card>
          ) : (
            <EmptyState
              title="Nenhuma rodada ainda"
              description={
                isAdmin
                  ? 'Crie a primeira rodada, escolha quem vai jogar e o sistema monta os times.'
                  : 'Assim que o administrador criar a próxima rodada, ela aparece aqui.'
              }
              action={
                isAdmin ? (
                  <Link to="/rodadas/nova">
                    <Button size="lg">
                      <IconPlus className="size-5" /> Criar rodada
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          )}
        </section>

        {currentPlayer && myStats && (
          <section>
            <SectionHeader
              title="Seus números"
              action={<SectionLink to={`/jogadores/${currentPlayer.id}`}>detalhes</SectionLink>}
            />
            <Card className="p-4">
              <StatRow>
                <Stat label="Jogos" value={myStats.played} />
                <Stat label="Vitórias" value={myStats.wins} tone="win" />
                <Stat label="Gols" value={myStats.goals} />
                {playedInGoal ? (
                  <Stat label="Sofridos" value={myStats.goalsAgainst} />
                ) : (
                  <Stat label="Assistências" value={myStats.assists} />
                )}
              </StatRow>
              <p className="hairline-top mt-3.5 pt-3 text-center text-footnote text-muted">
                Aproveitamento de {percent(myStats.pointsPct)}
              </p>
            </Card>
          </section>
        )}

        {lastClosed && (
          <section>
            <SectionHeader
              title="Destaques"
              action={<SectionLink to={`/rodadas/${lastClosed.id}`}>a rodada</SectionLink>}
            />
            <AwardsCard snapshot={snapshot} roundId={lastClosed.id} />
          </section>
        )}
      </div>
    </Page>
  )
}
