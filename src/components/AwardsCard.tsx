import { Link } from 'react-router-dom'
import { playerMap, roundAwards } from '../domain/selectors'
import type { AwardType, Snapshot } from '../types'
import { AWARD_LABELS } from '../types'
import { Avatar } from './Avatar'
import { IconGlove, IconGoldenBall, IconPuncturedBall } from './icons'
import { EmptyState, ListGroup } from './ui'

const ORDER: AwardType[] = ['jogador_rodada', 'goleiro_menos_vazado', 'pior_jogador']

const STYLES: Record<AwardType, { tone: string; Icon: typeof IconGlove }> = {
  jogador_rodada: { tone: 'text-gold', Icon: IconGoldenBall },
  goleiro_menos_vazado: { tone: 'text-brand', Icon: IconGlove },
  pior_jogador: { tone: 'text-muted', Icon: IconPuncturedBall },
}

export function AwardsCard({ snapshot, roundId }: { snapshot: Snapshot; roundId: string }) {
  const awards = roundAwards(snapshot, roundId)
  const byId = playerMap(snapshot)

  if (awards.length === 0) {
    return (
      <EmptyState
        title="Sem premiações ainda"
        description="Os destaques são calculados quando a partida é encerrada."
      />
    )
  }

  return (
    <ListGroup>
      {ORDER.map((type) => {
        const winners = awards
          .filter((award) => award.type === type)
          .map((award) => byId.get(award.player_id))
          .filter((player) => player !== undefined)
        if (winners.length === 0) return null

        const { tone, Icon } = STYLES[type]
        return (
          <div key={type} className="flex items-center gap-3 px-4 py-3">
            <Icon className={`size-6 shrink-0 ${tone}`} />
            <div className="min-w-0 flex-1">
              <p className="text-footnote text-muted">{AWARD_LABELS[type]}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {winners.map((player) => (
                  <Link
                    key={player.id}
                    to={`/jogadores/${player.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <Avatar player={player} size="sm" />
                    <span className="text-subhead font-medium text-ink">{player.full_name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </ListGroup>
  )
}
