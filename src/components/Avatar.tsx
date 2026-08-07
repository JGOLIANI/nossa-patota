import { cn } from '../lib/cn'
import { initials } from '../lib/format'
import type { Player } from '../types'

const SIZES = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-xs',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
}

/**
 * Foto do jogador, ou as iniciais em um tom neutro.
 *
 * As iniciais são deliberadamente monocromáticas: uma cor por jogador deixava
 * as listas parecendo um arco-íris e competia com a cor dos times, que é a
 * única cor que realmente carrega informação nesta aplicação.
 */
export function Avatar({
  player,
  size = 'md',
  className,
}: {
  player: Pick<Player, 'full_name' | 'photo_url' | 'id'>
  size?: keyof typeof SIZES
  className?: string
}) {
  if (player.photo_url) {
    return (
      <img
        src={player.photo_url}
        alt=""
        loading="lazy"
        className={cn('shrink-0 rounded-full bg-fill object-cover', SIZES[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-fill font-semibold text-muted',
        SIZES[size],
        className,
      )}
    >
      {initials(player.full_name)}
    </span>
  )
}
