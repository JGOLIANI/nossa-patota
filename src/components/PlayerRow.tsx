import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import type { Player } from '../types'
import { Avatar } from './Avatar'
import { ListRow } from './ui'

/**
 * Linha de jogador. É só uma `ListRow` com o avatar já montado — a posição e
 * o tipo do jogador vão no texto de apoio em vez de virarem etiquetas
 * coloridas, que enchiam as listas de ruído.
 */
export function PlayerRow({
  player,
  subtitle,
  trailing,
  rank,
  to,
  onClick,
  selected,
  accent,
  chevron,
}: {
  player: Player
  subtitle?: ReactNode
  trailing?: ReactNode
  rank?: number
  to?: string
  onClick?: () => void
  selected?: boolean
  accent?: string
  chevron?: boolean
}) {
  return (
    <ListRow
      to={to}
      onClick={onClick}
      selected={selected}
      accent={accent}
      chevron={chevron}
      leading={
        <span className="flex shrink-0 items-center gap-3">
          {rank !== undefined && (
            <span
              className={cn(
                'w-5 text-center text-sm tabular-nums',
                rank <= 3 ? 'font-semibold text-ink' : 'text-faint',
              )}
            >
              {rank}
            </span>
          )}
          <Avatar player={player} size="md" />
        </span>
      }
      title={player.full_name}
      subtitle={subtitle}
      trailing={trailing}
    />
  )
}

