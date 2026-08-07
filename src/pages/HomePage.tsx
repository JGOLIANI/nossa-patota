import { Link, useNavigate } from 'react-router-dom'
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
import { highlightRound, roundMatches, roundRoster } from '../domain/selectors'
import { firstName, formatDate, formatWeekday, percent } from '../lib/format'
import { useApp } from '../store/useApp'

export function HomePage() {
  const { snapshot, currentPlayer, isAdmin, stats } = useApp()
  const navigate = useNavigate()

  const round = highlightRound(snapshot)
  const myStats = currentPlayer ? stats.get(currentPlayer.id) : undefined
  const isKeeper = currentPlayer?.position === 'goleiro'

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
                  <h3 className="truncate text-lg font-semibold text-ink">{round.title}</h3>
                  <p className="mt-0.5 text-sm text-muted">
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

              <p className="mt-3 text-sm text-muted">
                {roundRoster(snapshot, round.id).length} jogadores ·{' '}
                {roundMatches(snapshot, round.id).length} partidas
              </p>

              <Button
                size="lg"
                block
                className="mt-4"
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
                {isKeeper ? (
                  <>
                    <Stat label="Gols sofridos" value={myStats.goalsAgainst} />
                    <Stat label="Sem sofrer" value={myStats.cleanSheets} />
                  </>
                ) : (
                  <>
                    <Stat label="Gols" value={myStats.goals} />
                    <Stat label="Assistências" value={myStats.assists} />
                  </>
                )}
              </StatRow>
              <p className="mt-3.5 border-t border-line pt-3 text-center text-[13px] text-muted">
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
