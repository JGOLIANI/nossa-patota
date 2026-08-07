import type { Match, MatchEvent, Snapshot } from '../types'

export type MatchResult = 'V' | 'E' | 'D'

/** Uma linha do histórico: o que aconteceu com um jogador em uma partida. */
export interface MatchLogEntry {
  matchId: string
  roundId: string
  date: string
  sequence: number
  teamId: string
  opponentTeamId: string
  scoreFor: number
  scoreAgainst: number
  result: MatchResult
  goals: number
  assists: number
}

export interface PlayerStats {
  playerId: string
  played: number
  wins: number
  draws: number
  losses: number
  goals: number
  assists: number
  /** Gols + assistências. */
  participations: number
  /** Gols sofridos pelo time do jogador (métrica de goleiro). */
  goalsAgainst: number
  /** Partidas em que o time do jogador não sofreu gols. */
  cleanSheets: number
  /** Pontos no critério 3-1-0. */
  points: number
  /** Aproveitamento: pontos obtidos ÷ pontos disputados. */
  pointsPct: number
  winPct: number
  goalsPerMatch: number
  assistsPerMatch: number
  participationsPerMatch: number
  goalsAgainstPerMatch: number
}

export function emptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    participations: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    points: 0,
    pointsPct: 0,
    winPct: 0,
    goalsPerMatch: 0,
    assistsPerMatch: 0,
    participationsPerMatch: 0,
    goalsAgainstPerMatch: 0,
  }
}

/**
 * Somente partidas encerradas entram nas estatísticas — uma partida em
 * andamento ainda pode ter o placar corrigido pelo administrador.
 */
function isCounted(match: Match): boolean {
  return match.status === 'encerrada'
}

function groupEventsByMatch(events: MatchEvent[]): Map<string, MatchEvent[]> {
  const map = new Map<string, MatchEvent[]>()
  for (const event of events) {
    const list = map.get(event.match_id)
    if (list) list.push(event)
    else map.set(event.match_id, [event])
  }
  return map
}

/** teamId -> ids dos jogadores escalados naquele time. */
function groupPlayersByTeam(snapshot: Snapshot): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const rp of snapshot.roundPlayers) {
    if (!rp.team_id) continue
    const list = map.get(rp.team_id)
    if (list) list.push(rp.player_id)
    else map.set(rp.team_id, [rp.player_id])
  }
  return map
}

function resultFor(scoreFor: number, scoreAgainst: number): MatchResult {
  if (scoreFor > scoreAgainst) return 'V'
  if (scoreFor < scoreAgainst) return 'D'
  return 'E'
}

/**
 * Monta o histórico de todas as partidas para todos os jogadores.
 * Estatísticas e prêmios são derivados desta única passagem, garantindo
 * que todas as telas contem os mesmos números.
 */
export function computeMatchLogs(
  snapshot: Snapshot,
  options: { roundId?: string } = {},
): Map<string, MatchLogEntry[]> {
  const eventsByMatch = groupEventsByMatch(snapshot.events)
  const playersByTeam = groupPlayersByTeam(snapshot)
  const roundById = new Map(snapshot.rounds.map((r) => [r.id, r]))

  const matches = snapshot.matches
    .filter(isCounted)
    .filter((m) => !options.roundId || m.round_id === options.roundId)
    .sort((a, b) => {
      const dateA = roundById.get(a.round_id)?.date ?? ''
      const dateB = roundById.get(b.round_id)?.date ?? ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return a.sequence - b.sequence
    })

  const logs = new Map<string, MatchLogEntry[]>()
  const push = (playerId: string, entry: MatchLogEntry) => {
    const list = logs.get(playerId)
    if (list) list.push(entry)
    else logs.set(playerId, [entry])
  }

  for (const match of matches) {
    const round = roundById.get(match.round_id)
    const events = eventsByMatch.get(match.id) ?? []

    const goalsByPlayer = new Map<string, number>()
    const assistsByPlayer = new Map<string, number>()
    for (const event of events) {
      // Gol contra conta para o placar, mas não para a artilharia do autor.
      if (event.scorer_id && !event.own_goal) {
        goalsByPlayer.set(event.scorer_id, (goalsByPlayer.get(event.scorer_id) ?? 0) + 1)
      }
      if (event.assist_id) {
        assistsByPlayer.set(event.assist_id, (assistsByPlayer.get(event.assist_id) ?? 0) + 1)
      }
    }

    const sides: Array<{ teamId: string; opponentTeamId: string; for: number; against: number }> = [
      {
        teamId: match.team_a_id,
        opponentTeamId: match.team_b_id,
        for: match.score_a,
        against: match.score_b,
      },
      {
        teamId: match.team_b_id,
        opponentTeamId: match.team_a_id,
        for: match.score_b,
        against: match.score_a,
      },
    ]

    for (const side of sides) {
      for (const playerId of playersByTeam.get(side.teamId) ?? []) {
        push(playerId, {
          matchId: match.id,
          roundId: match.round_id,
          date: round?.date ?? '',
          sequence: match.sequence,
          teamId: side.teamId,
          opponentTeamId: side.opponentTeamId,
          scoreFor: side.for,
          scoreAgainst: side.against,
          result: resultFor(side.for, side.against),
          goals: goalsByPlayer.get(playerId) ?? 0,
          assists: assistsByPlayer.get(playerId) ?? 0,
        })
      }
    }
  }

  return logs
}

export function statsFromLogs(playerId: string, entries: MatchLogEntry[]): PlayerStats {
  const stats = emptyStats(playerId)
  for (const entry of entries) {
    stats.played += 1
    if (entry.result === 'V') stats.wins += 1
    else if (entry.result === 'E') stats.draws += 1
    else stats.losses += 1
    stats.goals += entry.goals
    stats.assists += entry.assists
    stats.goalsAgainst += entry.scoreAgainst
    if (entry.scoreAgainst === 0) stats.cleanSheets += 1
  }
  stats.participations = stats.goals + stats.assists
  stats.points = stats.wins * 3 + stats.draws
  if (stats.played > 0) {
    stats.pointsPct = (stats.points / (stats.played * 3)) * 100
    stats.winPct = (stats.wins / stats.played) * 100
    stats.goalsPerMatch = stats.goals / stats.played
    stats.assistsPerMatch = stats.assists / stats.played
    stats.participationsPerMatch = stats.participations / stats.played
    stats.goalsAgainstPerMatch = stats.goalsAgainst / stats.played
  }
  return stats
}

/**
 * Estatísticas acumuladas de todos os jogadores. Passe `roundId` para obter
 * apenas o desempenho dentro de uma rodada.
 */
export function computeStats(
  snapshot: Snapshot,
  options: { roundId?: string } = {},
): Map<string, PlayerStats> {
  const logs = computeMatchLogs(snapshot, options)
  const stats = new Map<string, PlayerStats>()
  for (const player of snapshot.players) {
    stats.set(player.id, statsFromLogs(player.id, logs.get(player.id) ?? []))
  }
  // Jogadores removidos ainda podem aparecer em históricos antigos.
  for (const [playerId, entries] of logs) {
    if (!stats.has(playerId)) stats.set(playerId, statsFromLogs(playerId, entries))
  }
  return stats
}

/** Histórico de um jogador, da partida mais recente para a mais antiga. */
export function playerHistory(snapshot: Snapshot, playerId: string): MatchLogEntry[] {
  const entries = computeMatchLogs(snapshot).get(playerId) ?? []
  return [...entries].reverse()
}

/** Aproveitamento (0 a 1) nas últimas `count` partidas — usado no balanceamento. */
export function recentForm(entries: MatchLogEntry[], count = 5): number {
  const recent = entries.slice(-count)
  if (recent.length === 0) return 0
  const points = recent.reduce(
    (total, entry) => total + (entry.result === 'V' ? 3 : entry.result === 'E' ? 1 : 0),
    0,
  )
  return points / (recent.length * 3)
}
