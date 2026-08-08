import type { AwardType, PlayerPosition, Snapshot } from '../types'
import { roundEntries } from './selectors'
import { computeStats, type PlayerStats } from './stats'

export interface RoundAwards {
  /** Mais participações em gols, entre os jogadores de linha que venceram. */
  jogador_rodada: string[]
  /** Menos participações em gols, entre os jogadores de linha que perderam. */
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

export interface RoundOutcome {
  winner: string | null
  loser: string | null
  /** Verdadeiro quando não houve vencedor nem perdedor. */
  draw: boolean
}

/**
 * Como a rodada terminou.
 *
 * Com uma partida por rodada isso é apenas quem ganhou e quem perdeu. A
 * função também aguenta rodadas antigas com várias partidas, somando pontos
 * no critério 3-1-0; empate na ponta ou na lanterna equivale a empate.
 */
export function roundOutcome(snapshot: Snapshot, roundId: string): RoundOutcome {
  const matches = snapshot.matches.filter(
    (match) => match.round_id === roundId && match.status === 'encerrada',
  )
  if (matches.length === 0) return { winner: null, loser: null, draw: false }

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

  const ranked = [...points.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length < 2) return { winner: null, loser: null, draw: false }

  const first = ranked[0]
  const last = ranked[ranked.length - 1]
  if (first[1] === last[1]) return { winner: null, loser: null, draw: true }

  const tiedOnTop = ranked[1][1] === first[1]
  const tiedOnBottom = ranked[ranked.length - 2][1] === last[1]

  return {
    winner: tiedOnTop ? null : first[0],
    loser: tiedOnBottom ? null : last[0],
    draw: false,
  }
}

/**
 * Calcula os destaques de uma rodada.
 *
 * Os dois prêmios de linha são simétricos: o melhor sai de quem venceu e o
 * pior de quem perdeu. No empate não há de onde separar, então os dois olham
 * a rodada inteira. Empates dentro do próprio prêmio devolvem todos os
 * empatados — cabe à interface decidir como exibir.
 *
 * A posição considerada é a da rodada, não a do cadastro: o goleiro que foi
 * para a linha disputa os prêmios de linha, e quem assumiu o gol disputa o de
 * goleiro menos vazado.
 */
export function computeRoundAwards(snapshot: Snapshot, roundId: string): RoundAwards {
  const stats = computeStats(snapshot, { roundId })
  const registered = new Map(snapshot.players.map((p) => [p.id, p.position]))
  const rows = roundEntries(snapshot, roundId).filter((rp) => rp.team_id)

  const teamOf = new Map(rows.map((rp) => [rp.player_id, rp.team_id]))
  const positionOf = new Map<string, PlayerPosition>(
    rows.map((rp) => [rp.player_id, rp.position ?? registered.get(rp.player_id) ?? 'linha']),
  )

  const participants = rows
    .map((rp) => stats.get(rp.player_id))
    .filter((entry): entry is PlayerStats => Boolean(entry) && entry!.played > 0)

  const line = participants.filter((entry) => positionOf.get(entry.playerId) === 'linha')
  const keepers = participants.filter((entry) => positionOf.get(entry.playerId) === 'goleiro')

  const outcome = roundOutcome(snapshot, roundId)
  const fromTeam = (teamId: string | null) =>
    teamId ? line.filter((entry) => teamOf.get(entry.playerId) === teamId) : []

  // No empate os dois prêmios olham a rodada toda; fora dele, cada um fica
  // restrito ao seu lado do placar.
  const bestPool = outcome.draw ? line : fromTeam(outcome.winner)
  const worstPool = outcome.draw ? line : fromTeam(outcome.loser)

  /**
   * Sem nenhuma participação em gol no lado avaliado não há o que premiar.
   *
   * Vale para os dois prêmios de linha, que são simétricos: se todo mundo ali
   * está em zero, ninguém se destacou — nem para bem nem para mal. Sem esta
   * guarda a Bola Murcha ia para o time perdedor inteiro numa derrota sem
   * gols, e para quase todo mundo num empate magro; um prêmio que cabe em
   * sete dos dez jogadores não diz nada sobre nenhum deles.
   */
  const stood = (pool: PlayerStats[]) =>
    pool.length > 0 && Math.max(...pool.map((entry) => entry.participations)) > 0

  return {
    jogador_rodada: stood(bestPool) ? bestBy(bestPool, (s) => s.participations, 'max') : [],
    pior_jogador: stood(worstPool) ? bestBy(worstPool, (s) => s.participations, 'min') : [],
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
