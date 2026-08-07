import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { IconChevronRight, IconPlus } from '../components/icons'
import { Badge, Card, EmptyState } from '../components/ui'
import { roundMatches, roundRoster } from '../domain/selectors'
import { formatDate } from '../lib/format'
import { useApp } from '../store/useApp'
import type { Round } from '../types'

const STATUS: Record<Round['status'], { label: string; tone: 'slate' | 'emerald' | 'amber' }> = {
  rascunho: { label: 'Rascunho', tone: 'slate' },
  em_andamento: { label: 'Em andamento', tone: 'emerald' },
  encerrada: { label: 'Encerrada', tone: 'amber' },
}

export function RoundsPage() {
  const { snapshot, isAdmin } = useApp()
  const rounds = [...snapshot.rounds].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <PageHeader
        title="Rodadas"
        subtitle={`${rounds.length} no histórico`}
        action={
          isAdmin ? (
            <Link
              to="/rodadas/nova"
              className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-500 text-slate-950"
              aria-label="Nova rodada"
            >
              <IconPlus className="size-6" />
            </Link>
          ) : undefined
        }
      />

      {rounds.length === 0 ? (
        <EmptyState
          title="Nenhuma rodada ainda"
          description={
            isAdmin
              ? 'Crie a primeira rodada, escolha os jogadores e gere os times.'
              : 'O administrador ainda não criou rodadas.'
          }
        />
      ) : (
        <div className="space-y-2">
          {rounds.map((round) => {
            const matches = roundMatches(snapshot, round.id)
            const goals = matches.reduce(
              (total, match) => total + match.score_a + match.score_b,
              0,
            )
            return (
              <Link key={round.id} to={`/rodadas/${round.id}`}>
                <Card className="flex items-center gap-3">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-lg leading-none font-bold text-slate-100">
                      {round.date.slice(8, 10)}
                    </p>
                    <p className="text-[11px] text-slate-500 uppercase">
                      {formatDate(round.date).slice(3, 5)}/{round.date.slice(2, 4)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-100">{round.title}</p>
                      <Badge tone={STATUS[round.status].tone}>{STATUS[round.status].label}</Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {roundRoster(snapshot, round.id).length} jogadores · {matches.length}{' '}
                      partidas · {goals} gols
                    </p>
                  </div>
                  <IconChevronRight className="size-5 shrink-0 text-slate-500" />
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
