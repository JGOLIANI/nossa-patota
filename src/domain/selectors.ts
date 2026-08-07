import type { Award, Match, MatchEvent, Player, Round, Snapshot, Team } from '../types'

export function playerMap(snapshot: Snapshot): Map<string, Player> {
  return new Map(snapshot.players.map((player) => [player.id, player]))
}

export function findPlayer(snapshot: Snapshot, playerId: string | null): Player | null {
  if (!playerId) return null
  return snapshot.players.find((player) => player.id === playerId) ?? null
}

export function findRound(snapshot: Snapshot, roundId: string): Round | null {
  return snapshot.rounds.find((round) => round.id === roundId) ?? null
}

export function findMatch(snapshot: Snapshot, matchId: string): Match | null {
  return snapshot.matches.find((match) => match.id === matchId) ?? null
}

export function findTeam(snapshot: Snapshot, teamId: string): Team | null {
  return snapshot.teams.find((team) => team.id === teamId) ?? null
}

export function roundTeams(snapshot: Snapshot, roundId: string): Team[] {
  return snapshot.teams
    .filter((team) => team.round_id === roundId)
    .sort((a, b) => a.position - b.position)
}

export function roundMatches(snapshot: Snapshot, roundId: string): Match[] {
  return snapshot.matches
    .filter((match) => match.round_id === roundId)
    .sort((a, b) => a.sequence - b.sequence)
}

export function roundRoster(snapshot: Snapshot, roundId: string): Player[] {
  const byId = playerMap(snapshot)
  return snapshot.roundPlayers
    .filter((rp) => rp.round_id === roundId)
    .map((rp) => byId.get(rp.player_id))
    .filter((player): player is Player => Boolean(player))
}

export function teamPlayers(snapshot: Snapshot, teamId: string): Player[] {
  const byId = playerMap(snapshot)
  return snapshot.roundPlayers
    .filter((rp) => rp.team_id === teamId)
    .map((rp) => byId.get(rp.player_id))
    .filter((player): player is Player => Boolean(player))
    .sort((a, b) => {
      if (a.position !== b.position) return a.position === 'goleiro' ? -1 : 1
      return a.full_name.localeCompare(b.full_name)
    })
}

export function matchEvents(snapshot: Snapshot, matchId: string): MatchEvent[] {
  return snapshot.events
    .filter((event) => event.match_id === matchId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function roundAwards(snapshot: Snapshot, roundId: string): Award[] {
  return snapshot.awards.filter((award) => award.round_id === roundId)
}

/** Rodada em destaque: a que está em andamento, senão o rascunho mais novo, senão a última encerrada. */
export function highlightRound(snapshot: Snapshot): Round | null {
  const byDate = [...snapshot.rounds].sort((a, b) => b.date.localeCompare(a.date))
  return (
    byDate.find((round) => round.status === 'em_andamento') ??
    byDate.find((round) => round.status === 'rascunho') ??
    byDate[0] ??
    null
  )
}

export function playerAwards(snapshot: Snapshot, playerId: string): Award[] {
  return snapshot.awards.filter((award) => award.player_id === playerId)
}
