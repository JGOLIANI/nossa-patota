import type { AwardType, Snapshot } from '../types'
import { computeStats, type PlayerStats } from './stats'

export interface RoundAwards {
  /** Maior número de participações em gols entre os jogadores de linha. */
  jogador_rodada: string[]
  /** Menor número de participações em gols dentro do time que perdeu. */
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
 * O time que perdeu a rodada.
 *
 * Com uma partida por rodada isso é simplesmente quem tomou a virada. A
 * função também aguenta rodadas antigas com várias partidas, somando pontos
 * no critério 3-1-0; se houver empate na lanterna não existe um perdedor
 * único, e o prêmio de pior jogador fica sem dono.
 */
export function losingTeam(snapshot: Snapshot, roundId: string): string | null {
  const matches = snapshot.matches.filter(
    (match) => match.round_id === roundId && match.status === 'encerrada',
  )
  if (matches.length === 0) return null

  const points = new Map<string, number>()
  const add = (teamId: string, value: number) =>
    points.set(teamId, (points.get(teamId) ?? 0) + value)

  for (const match of matches) {
    add(match.team_a_id, 0)
    add(match.team_b_id, 0)
    if (match.score_a > match.score_b) add(match.team_a_id, 3)
    else if (match.score_b > match.score_a) add(match.team_b_id, 3)
    else {
      add(match.team_a_id, 1)
      add(match.team_b_id, 1)
    }
  }

  const ranked = [...points.entries()].sort((a, b) => a[1] - b[1])
  if (ranked.length < 2) return null
  // Empate na última colocação: ninguém é "o" perdedor.
  if (ranked[0][1] === ranked[1][1]) return null
  return ranked[0][0]
}

/**
 * Calcula os destaques de uma rodada. Empates são sempre devolvidos por
 * completo — cabe à interface decidir como exibir.
 */
export function computeRoundAwards(snapshot: Snapshot, roundId: string): RoundAwards {
  const stats = computeStats(snapshot, { roundId })
  const positionOf = new Map(snapshot.players.map((p) => [p.id, p.position]))
  const teamOf = new Map(
    snapshot.roundPlayers
      .filter((rp) => rp.round_id === roundId)
      .map((rp) => [rp.player_id, rp.team_id]),
  )

  const participants = snapshot.roundPlayers
    .filter((rp) => rp.round_id === roundId && rp.team_id)
    .map((rp) => stats.get(rp.player_id))
    .filter((entry): entry is PlayerStats => Boolean(entry) && entry!.played > 0)

  const line = participants.filter((entry) => positionOf.get(entry.playerId) === 'linha')
  const keepers = participants.filter((entry) => positionOf.get(entry.playerId) === 'goleiro')

  const bestParticipations = line.length
    ? Math.max(...line.map((entry) => entry.participations))
    : 0

  // O pior jogador sai do time derrotado: quem menos participou de gols entre
  // os jogadores de linha que perderam a rodada.
  const loser = losingTeam(snapshot, roundId)
  const losingLine = loser
    ? line.filter((entry) => teamOf.get(entry.playerId) === loser)
    : []

  return {
    // Se ninguém participou de gol algum, não há jogador da rodada.
    jogador_rodada: bestParticipations > 0 ? bestBy(line, (s) => s.participations, 'max') : [],
    pior_jogador: bestBy(losingLine, (s) => s.participations, 'min'),
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
