import type { AwardType, Snapshot } from '../types'
import { computeStats, type PlayerStats } from './stats'

export interface RoundAwards {
  /** Maior número de participações em gols entre os jogadores de linha. */
  jogador_rodada: string[]
  /** Jogadores de linha que terminaram a rodada sem nenhuma participação em gol. */
  pior_jogador: string[]
  /** Goleiro(s) que sofreram menos gols na rodada. */
  goleiro_menos_vazado: string[]
}

export const EMPTY_AWARDS: RoundAwards = {
  jogador_rodada: [],
  pior_jogador: [],
  goleiro_menos_vazado: [],
}

function bestBy(
  entries: PlayerStats[],
  value: (stats: PlayerStats) => number,
  direction: 'max' | 'min',
): string[] {
  if (entries.length === 0) return []
  const values = entries.map(value)
  const target = direction === 'max' ? Math.max(...values) : Math.min(...values)
  return entries.filter((entry) => value(entry) === target).map((entry) => entry.playerId)
}

/**
 * Calcula os destaques de uma rodada. Empates são sempre devolvidos por
 * completo — cabe à interface decidir como exibir.
 */
export function computeRoundAwards(snapshot: Snapshot, roundId: string): RoundAwards {
  const stats = computeStats(snapshot, { roundId })
  const positionOf = new Map(snapshot.players.map((p) => [p.id, p.position]))

  const participants = snapshot.roundPlayers
    .filter((rp) => rp.round_id === roundId && rp.team_id)
    .map((rp) => stats.get(rp.player_id))
    .filter((entry): entry is PlayerStats => Boolean(entry) && entry!.played > 0)

  const line = participants.filter((entry) => positionOf.get(entry.playerId) === 'linha')
  const keepers = participants.filter((entry) => positionOf.get(entry.playerId) === 'goleiro')

  const topLine = bestBy(line, (s) => s.participations, 'max')
  const bestParticipations = line.length
    ? Math.max(...line.map((entry) => entry.participations))
    : 0

  return {
    // Se ninguém participou de gol algum, não há jogador da rodada.
    jogador_rodada: bestParticipations > 0 ? topLine : [],
    pior_jogador: line.filter((entry) => entry.participations === 0).map((entry) => entry.playerId),
    goleiro_menos_vazado: bestBy(keepers, (s) => s.goalsAgainst, 'min'),
  }
}

/** Conta quantas vezes cada jogador recebeu cada prêmio ao longo da história. */
export function awardCounts(snapshot: Snapshot, playerId: string): Record<AwardType, number> {
  const counts: Record<AwardType, number> = {
    jogador_rodada: 0,
    pior_jogador: 0,
    goleiro_menos_vazado: 0,
  }
  for (const award of snapshot.awards) {
    if (award.player_id === playerId) counts[award.type] += 1
  }
  return counts
}
