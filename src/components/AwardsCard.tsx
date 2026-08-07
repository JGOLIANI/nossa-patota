import { Link } from 'react-router-dom'
import { playerMap, roundAwards } from '../domain/selectors'
import type { AwardType, Snapshot } from '../types'
import { AWARD_LABELS } from '../types'
import { Avatar } from './Avatar'
import { IconGlove, IconMedal, IconTrash } from './icons'
import { Card, EmptyState } from './ui'

const ORDER: AwardType[] = ['jogador_rodada', 'goleiro_menos_vazado', 'pior_jogador']

const STYLES: Record<AwardType, { tone: string; Icon: typeof IconMedal }> = {
  jogador_rodada: { tone: 'text-amber-300', Icon: IconMedal },
  goleiro_menos_vazado: { tone: 'text-sky-300', Icon: IconGlove },
  pior_jogador: { tone: 'text-slate-400', Icon: IconTrash },
}

export function AwardsCard({ snapshot, roundId }: { snapshot: Snapshot; roundId: string }) {
  const awards = roundAwards(snapshot, roundId)
  const byId = playerMap(snapshot)

  if (awards.length === 0) {
    return (
      <EmptyState
        title="Sem premiações ainda"
        description="Os destaques são calculados quando a rodada é encerrada."
      />
    )
  }

  return (
    <div className="space-y-2">
      {ORDER.map((type) => {
        const winners = awards.filter((award) => award.type === type)
        if (winners.length === 0) return null
        const { tone, Icon } = STYLES[type]
        return (
          <Card key={type} className="flex items-center gap-3">
            <Icon className={`size-7 shrink-0 ${tone}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                {AWARD_LABELS[type]}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {winners.map((award) => {
                  const player = byId.get(award.player_id)
                  if (!player) return null
                  return (
                    <Link
                      key={award.id}
                      to={`/jogadores/${player.id}`}
                      className="flex items-center gap-1.5"
                    >
                      <Avatar player={player} size="sm" />
                      <span className="text-sm font-semibold text-slate-100">
                        {player.full_name}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
