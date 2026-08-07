import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { IconPlus } from '../components/icons'
import { EmptyState, ListGroup, ListRow, Tag } from '../components/ui'
import { roundMatches, roundRoster } from '../domain/selectors'
import { formatDate } from '../lib/format'
import { useApp } from '../store/useApp'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Bloco de data à esquerda da linha — leitura mais rápida que a data escrita. */
function DateBlock({ date }: { date: string }) {
  const month = Number(date.slice(5, 7)) - 1
  return (
    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control bg-fill">
      <span className="text-base leading-none font-semibold text-ink">{date.slice(8, 10)}</span>
      <span className="mt-0.5 text-[11px] leading-none text-muted">{MONTHS[month] ?? ''}</span>
    </span>
  )
}

export function RoundsPage() {
  const { snapshot, isAdmin } = useApp()
  const rounds = [...snapshot.rounds].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Page
      title="Rodadas"
      subtitle={rounds.length > 0 ? `${rounds.length} no histórico` : undefined}
      profile
      action={
        isAdmin ? (
          <Link
            to="/rodadas/nova"
            aria-label="Nova rodada"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"
          >
            <IconPlus className="size-6" />
          </Link>
        ) : undefined
      }
    >
      {rounds.length === 0 ? (
        <EmptyState
          title="Nenhuma rodada ainda"
          description={
            isAdmin
              ? 'Toque em + para criar a primeira rodada.'
              : 'O administrador ainda não criou rodadas.'
          }
        />
      ) : (
        <ListGroup>
          {rounds.map((round) => {
            const matches = roundMatches(snapshot, round.id)
            const goals = matches.reduce((total, m) => total + m.score_a + m.score_b, 0)
            return (
              <ListRow
                key={round.id}
                to={`/rodadas/${round.id}`}
                chevron
                leading={<DateBlock date={round.date} />}
                title={round.title}
                subtitle={
                  matches.length > 0
                    ? `${roundRoster(snapshot, round.id).length} jogadores · ${matches.length} partidas · ${goals} gols`
                    : `${roundRoster(snapshot, round.id).length} jogadores · ${formatDate(round.date)}`
                }
                trailing={
                  round.status !== 'encerrada' ? (
                    <Tag tone={round.status === 'em_andamento' ? 'live' : 'neutral'}>
                      {round.status === 'em_andamento' ? 'Ao vivo' : 'Rascunho'}
                    </Tag>
                  ) : undefined
                }
              />
            )
          })}
        </ListGroup>
      )}
    </Page>
  )
}
