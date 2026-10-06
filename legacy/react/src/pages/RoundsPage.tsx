import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { IconPlus } from '../components/icons'
import { Button, EmptyState, ListGroup, ListRow, Tag } from '../components/ui'
import { roundEntries, roundMatches } from '../domain/selectors'
import { formatDate, plural } from '../lib/format'
import { useApp } from '../store/useApp'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Bloco de data à esquerda da linha — leitura mais rápida que a data escrita. */
function DateBlock({ date }: { date: string }) {
  const month = Number(date.slice(5, 7)) - 1
  return (
    <span className="squircle flex size-11 shrink-0 flex-col items-center justify-center rounded-[13px] bg-fill">
      <span className="font-rounded text-callout leading-none font-semibold text-ink">
        {date.slice(8, 10)}
      </span>
      <span className="mt-0.5 text-caption2 leading-none text-muted uppercase">
        {MONTHS[month] ?? ''}
      </span>
    </span>
  )
}

/**
 * Quantas partidas aparecem de uma vez.
 *
 * Uma patota com anos de acervo chega a centenas de partidas, e renderizar
 * todas de uma vez custa mais de um segundo num celular mediano — sem que
 * ninguém role até o fim. Meio ano por vez cobre o uso real.
 */
const PAGE_SIZE = 24

export function RoundsPage() {
  const { snapshot, isAdmin } = useApp()
  const [limit, setLimit] = useState(PAGE_SIZE)

  const all = [...snapshot.rounds].sort((a, b) => b.date.localeCompare(a.date))
  const rounds = all.slice(0, limit)

  return (
    <Page
      title="Partidas"
      subtitle={all.length > 0 ? `${all.length} no histórico` : undefined}
      profile
      action={
        isAdmin ? (
          <Link
            to="/rodadas/nova"
            aria-label="Nova partida"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-brand transition duration-200 ease-ios active:scale-90 active:opacity-50"
          >
            <IconPlus className="size-6" />
          </Link>
        ) : undefined
      }
    >
      {all.length === 0 ? (
        <EmptyState
          title="Nenhuma partida ainda"
          description={
            isAdmin
              ? 'Toque em + para criar a primeira partida.'
              : 'O administrador ainda não criou partidas.'
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
                    ? `${roundEntries(snapshot, round.id).length} jogadores · ${plural(matches.length, 'partida')} · ${plural(goals, 'gol', 'gols')}`
                    : `${roundEntries(snapshot, round.id).length} jogadores · ${formatDate(round.date)}`
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

      {limit < all.length && (
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          Mostrar mais {Math.min(PAGE_SIZE, all.length - limit)}
        </Button>
      )}
    </Page>
  )
}
