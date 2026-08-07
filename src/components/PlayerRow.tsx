import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import type { Player } from '../types'
import { Avatar } from './Avatar'
import { Badge } from './ui'

export function PlayerRow({
  player,
  subtitle,
  right,
  rank,
  to,
  onClick,
  selected,
  className,
}: {
  player: Player
  subtitle?: ReactNode
  right?: ReactNode
  rank?: number
  to?: string
  onClick?: () => void
  selected?: boolean
  className?: string
}) {
  const content = (
    <>
      {rank !== undefined && (
        <span
          className={cn(
            'w-6 shrink-0 text-center text-sm font-bold tabular-nums',
            rank === 1 ? 'text-amber-300' : rank <= 3 ? 'text-slate-300' : 'text-slate-500',
          )}
        >
          {rank}
        </span>
      )}
      <Avatar player={player} size="md" />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-slate-100">{player.full_name}</span>
          {player.position === 'goleiro' && (
            <Badge tone="sky" className="shrink-0">
              GOL
            </Badge>
          )}
          {player.player_type === 'visitante' && (
            <Badge tone="violet" className="shrink-0">
              VIS
            </Badge>
          )}
          {player.status === 'inativo' && (
            <Badge tone="slate" className="shrink-0">
              Inativo
            </Badge>
          )}
        </span>
        {subtitle && <span className="block truncate text-xs text-slate-400">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </>
  )

  const base = cn(
    'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 transition',
    selected
      ? 'border-emerald-500/60 bg-emerald-500/10'
      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={base}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    )
  }
  return <div className={base}>{content}</div>
}
