import type { Player } from '../types'

/**
 * Nome de usuário sugerido a partir do nome completo: `Igor Santos` vira
 * `igor.santos`. Acentos são removidos e só sobram letras, números e ponto,
 * porque o usuário vira o endereço de login.
 */
export function suggestUsername(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9.]/g, '')
}

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
