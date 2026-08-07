import { cn } from '../lib/cn'
import { initials } from '../lib/format'
import type { Player } from '../types'

const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-20 text-xl',
  xl: 'size-28 text-3xl',
}

/** Cor estável por jogador, para quem ainda não enviou foto. */
function toneOf(seed: string): string {
  const tones = [
    'bg-emerald-500/20 text-emerald-300',
    'bg-sky-500/20 text-sky-300',
    'bg-violet-500/20 text-violet-300',
    'bg-amber-500/20 text-amber-300',
    'bg-rose-500/20 text-rose-300',
    'bg-teal-500/20 text-teal-300',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return tones[hash % tones.length]
}

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
        alt={player.full_name}
        loading="lazy"
        className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        SIZES[size],
        toneOf(player.id || player.full_name),
        className,
      )}
    >
      {initials(player.full_name)}
    </span>
  )
}
