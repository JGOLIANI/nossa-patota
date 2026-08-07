import type {
  Award,
  Match,
  MatchEvent,
  Player,
  PlayerPosition,
  Round,
  RoundPlayer,
  Snapshot,
  Team,
} from '../types'

/**
 * Índices derivados do snapshot.
 *
 * As telas pedem "os jogadores desta rodada" uma vez por linha da lista, e
 * sem índice cada pedido varre o histórico inteiro — numa patota com anos de
 * acervo isso vira milhões de iterações por render. O índice é montado uma
 * vez por snapshot e fica guardado em um `WeakMap`: como cada recarga produz
 * um objeto novo, o cache se invalida sozinho e nunca serve dado velho.
 */
interface SnapshotIndex {
  playersById: Map<string, Player>
  roundPlayersByRound: Map<string, RoundPlayer[]>
  roundPlayersByTeam: Map<string, RoundPlayer[]>
  matchesByRound: Map<string, Match[]>
  teamsByRound: Map<string, Team[]>
  eventsByMatch: Map<string, MatchEvent[]>
  awardsByRound: Map<string, Award[]>
  roundsById: Map<string, Round>
  teamsById: Map<string, Team>
  matchesById: Map<string, Match>
}

const cache = new WeakMap<Snapshot, SnapshotIndex>()

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function buildIndex(snapshot: Snapshot): SnapshotIndex {
  const index: SnapshotIndex = {
    playersById: new Map(snapshot.players.map((player) => [player.id, player])),
    roundPlayersByRound: new Map(),
    roundPlayersByTeam: new Map(),
    matchesByRound: new Map(),
    teamsByRound: new Map(),
    eventsByMatch: new Map(),
    awardsByRound: new Map(),
    roundsById: new Map(snapshot.rounds.map((round) => [round.id, round])),
    teamsById: new Map(snapshot.teams.map((team) => [team.id, team])),
    matchesById: new Map(snapshot.matches.map((match) => [match.id, match])),
  }

  for (const rp of snapshot.roundPlayers) {
    push(index.roundPlayersByRound, rp.round_id, rp)
    if (rp.team_id) push(index.roundPlayersByTeam, rp.team_id, rp)
  }
  for (const match of snapshot.matches) push(index.matchesByRound, match.round_id, match)
  for (const team of snapshot.teams) push(index.teamsByRound, team.round_id, team)
  for (const event of snapshot.events) push(index.eventsByMatch, event.match_id, event)
  for (const award of snapshot.awards) push(index.awardsByRound, award.round_id, award)

  for (const list of index.matchesByRound.values()) list.sort((a, b) => a.sequence - b.sequence)
  for (const list of index.teamsByRound.values()) list.sort((a, b) => a.position - b.position)
  for (const list of index.eventsByMatch.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  return index
}

function indexOf(snapshot: Snapshot): SnapshotIndex {
  let index = cache.get(snapshot)
  if (!index) {
    index = buildIndex(snapshot)
    cache.set(snapshot, index)
  }
  return index
}

export function playerMap(snapshot: Snapshot): Map<string, Player> {
  return indexOf(snapshot).playersById
}

export function findPlayer(snapshot: Snapshot, playerId: string | null): Player | null {
  if (!playerId) return null
  return indexOf(snapshot).playersById.get(playerId) ?? null
}

export function findRound(snapshot: Snapshot, roundId: string): Round | null {
  return indexOf(snapshot).roundsById.get(roundId) ?? null
}

export function findMatch(snapshot: Snapshot, matchId: string): Match | null {
  return indexOf(snapshot).matchesById.get(matchId) ?? null
}

export function findTeam(snapshot: Snapshot, teamId: string): Team | null {
  return indexOf(snapshot).teamsById.get(teamId) ?? null
}

export function roundTeams(snapshot: Snapshot, roundId: string): Team[] {
  return indexOf(snapshot).teamsByRound.get(roundId) ?? []
}

export function roundMatches(snapshot: Snapshot, roundId: string): Match[] {
  return indexOf(snapshot).matchesByRound.get(roundId) ?? []
}

/** Linhas de presença da rodada, sem passar pelo histórico inteiro. */
export function roundEntries(snapshot: Snapshot, roundId: string): RoundPlayer[] {
  return indexOf(snapshot).roundPlayersByRound.get(roundId) ?? []
}

export function roundRoster(snapshot: Snapshot, roundId: string): Player[] {
  const index = indexOf(snapshot)
  return (index.roundPlayersByRound.get(roundId) ?? [])
    .map((rp) => index.playersById.get(rp.player_id))
    .filter((player): player is Player => Boolean(player))
}

export function teamPlayers(snapshot: Snapshot, teamId: string): Player[] {
  const index = indexOf(snapshot)
  return (index.roundPlayersByTeam.get(teamId) ?? [])
    .map((rp) => index.playersById.get(rp.player_id))
    .filter((player): player is Player => Boolean(player))
    .sort((a, b) => {
      if (a.position !== b.position) return a.position === 'goleiro' ? -1 : 1
      return a.full_name.localeCompare(b.full_name)
    })
}

export function matchEvents(snapshot: Snapshot, matchId: string): MatchEvent[] {
  return indexOf(snapshot).eventsByMatch.get(matchId) ?? []
}

export function roundAwards(snapshot: Snapshot, roundId: string): Award[] {
  return indexOf(snapshot).awardsByRound.get(roundId) ?? []
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

/**
 * Posição que o jogador ocupou numa rodada. Cai na posição do cadastro
 * quando a rodada não diz nada.
 */
export function positionInRound(
  snapshot: Snapshot,
  roundId: string,
  playerId: string,
): PlayerPosition {
  const index = indexOf(snapshot)
  const row = index.roundPlayersByRound
    .get(roundId)
    ?.find((rp) => rp.player_id === playerId)
  if (row?.position) return row.position
  return index.playersById.get(playerId)?.position ?? 'linha'
}

export function playerAwards(snapshot: Snapshot, playerId: string): Award[] {
  return snapshot.awards.filter((award) => award.player_id === playerId)
}
