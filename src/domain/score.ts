import type { Match, MatchEvent } from '../types'

/**
 * O placar é sempre derivado dos eventos registrados — inclusive gols contra,
 * que contam para o time beneficiado. Assim não existe placar divergente do
 * histórico de gols.
 */
export function scoreFromEvents(
  match: Pick<Match, 'id' | 'team_a_id' | 'team_b_id'>,
  events: MatchEvent[],
): { score_a: number; score_b: number } {
  let scoreA = 0
  let scoreB = 0
  for (const event of events) {
    if (event.match_id !== match.id) continue
    if (event.team_id === match.team_a_id) scoreA += 1
    else if (event.team_id === match.team_b_id) scoreB += 1
  }
  return { score_a: scoreA, score_b: scoreB }
}
