import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/Page'
import { IconPlus } from '../components/icons'
import {
  Button,
  ChipBar,
  EmptyState,
  ListGroup,
  ListRow,
  SectionHeader,
  Tag,
} from '../components/ui'
import { splitRounds, type RoundOrder } from '../domain/schedule'
import { roundEntries, roundMatches } from '../domain/selectors'
import { formatDate, plural } from '../lib/format'
import { useApp } from '../store/useApp'
import type { Round, Snapshot } from '../types'

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

function RoundRow({ snapshot, round }: { snapshot: Snapshot; round: Round }) {
  const matches = roundMatches(snapshot, round.id)
  const goals = matches.reduce((total, m) => total + m.score_a + m.score_b, 0)
  const players = roundEntries(snapshot, round.id).length

  return (
    <ListRow
      to={`/rodadas/${round.id}`}
      chevron
      leading={<DateBlock date={round.date} />}
      title={round.title}
      subtitle={
        matches.length > 0
          ? `${players} jogadores · ${plural(matches.length, 'partida')} · ${plural(goals, 'gol', 'gols')}`
          : `${players} jogadores · ${formatDate(round.date)}`
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
}

/**
 * Quantas partidas aparecem de uma vez.
 *
 * Uma patota com anos de acervo chega a centenas de partidas, e renderizar
 * todas de uma vez custa mais de um segundo num celular mediano — sem que
 * ninguém role até o fim. Meio ano por vez cobre o uso real.
 */
const PAGE_SIZE = 24

const ORDERS: Array<{ value: RoundOrder; label: string }> = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigas', label: 'Mais antigas' },
]

/**
 * Se a página passou da altura da tela.
 *
 * O controle de ordem só ganha função quando a lista deixa de caber: com
 * tudo à vista, inverter a ordem não muda nada do que se enxerga. Medir a
 * página em vez de contar linhas dispensa o número mágico — a mesma lista
 * cabe inteira num tablet e transborda num celular pequeno.
 *
 * A medida não oscila porque o controle só faz a página crescer: uma vez que
 * ela rola, mostrá-lo nunca a faz voltar a caber.
 */
function usePageScrolls(content: RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = useState(false)

  useEffect(() => {
    const node = content.current
    if (!node) return

    let frame = 0
    const measure = () => {
      frame = 0
      const doc = document.documentElement
      // Um pixel de folga: arredondamento de subpixel não é transbordo.
      setScrolls(doc.scrollHeight > doc.clientHeight + 1)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('resize', schedule)
    // A lista muda de altura ao carregar o acervo e ao mostrar mais; observar
    // o bloco de conteúdo cobre os dois casos. O `body` não serve: ele tem
    // altura fixa de uma tela e é o conteúdo que transborda dele.
    const observer = new ResizeObserver(schedule)
    observer.observe(node)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [content])

  return scrolls
}

export function RoundsPage() {
  const { snapshot, isAdmin } = useApp()
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [preferredOrder, setPreferredOrder] = useState<RoundOrder>('recentes')

  const content = useRef<HTMLDivElement>(null)
  const scrolls = usePageScrolls(content)
  // Sem o controle na tela, vale sempre a ordem padrão: ninguém fica preso a
  // uma escolha que não tem mais como desfazer.
  const order = scrolls ? preferredOrder : 'recentes'

  const { pending, played } = useMemo(
    () => splitRounds(snapshot.rounds, order),
    [snapshot.rounds, order],
  )

  // O limite é da tela inteira, não de cada grupo: o que interessa é quantas
  // linhas o celular precisa desenhar de uma vez.
  const pendingShown = pending.slice(0, limit)
  const playedShown = played.slice(0, Math.max(0, limit - pendingShown.length))
  const shown = pendingShown.length + playedShown.length
  const total = pending.length + played.length

  // Com um grupo só, o título da seção seria enfeite — a lista já é ele.
  const grouped = pending.length > 0 && played.length > 0

  const counts = [
    played.length > 0 ? plural(played.length, 'realizada', 'realizadas') : '',
    pending.length > 0 ? `${pending.length} em aberto` : '',
  ].filter(Boolean)

  return (
    <Page
      title="Partidas"
      subtitle={counts.length > 0 ? counts.join(' · ') : undefined}
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
      <div ref={content}>
        {total === 0 ? (
          <EmptyState
            title="Nenhuma partida ainda"
            description={
              isAdmin
                ? 'Toque em + para criar a primeira partida.'
                : 'O administrador ainda não criou partidas.'
            }
          />
        ) : (
          <div className="space-y-5">
            {scrolls && (
              <ChipBar
                value={order}
                options={ORDERS}
                onChange={(value) => {
                  setPreferredOrder(value)
                  setLimit(PAGE_SIZE)
                }}
              />
            )}

            {pendingShown.length > 0 && (
              <section>
                {grouped && <SectionHeader title="Em aberto" />}
                <ListGroup>
                  {pendingShown.map((round) => (
                    <RoundRow key={round.id} snapshot={snapshot} round={round} />
                  ))}
                </ListGroup>
              </section>
            )}

            {playedShown.length > 0 && (
              <section>
                {grouped && <SectionHeader title="Realizadas" />}
                <ListGroup>
                  {playedShown.map((round) => (
                    <RoundRow key={round.id} snapshot={snapshot} round={round} />
                  ))}
                </ListGroup>
              </section>
            )}

            {shown < total && (
              <Button
                variant="secondary"
                block
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
              >
                Mostrar mais {Math.min(PAGE_SIZE, total - shown)}
              </Button>
            )}
          </div>
        )}
      </div>
    </Page>
  )
}
