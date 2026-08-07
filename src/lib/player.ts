import type { Player } from '../types'

/**
 * Texto de apoio padrão de um jogador nas listas.
 *
 * Antes essas informações eram etiquetas coloridas ao lado do nome; em uma
 * lista de catorze pessoas viravam ruído. Como texto discreto, continuam
 * disponíveis sem competir com o que importa.
 */
export function playerCaption(player: Player, extra?: string): string {
  const parts = [player.position === 'goleiro' ? 'Goleiro' : 'Linha']
  if (player.player_type === 'visitante') parts.push('visitante')
  if (player.status === 'inativo') parts.push('inativo')
  if (extra) parts.push(extra)
  return parts.join(' · ')
}
