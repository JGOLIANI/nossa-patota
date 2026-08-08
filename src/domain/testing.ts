import type {
  Match,
  MatchEvent,
  Player,
  Round,
  RoundPlayer,
  Snapshot,
  Team,
} from '../types'
import { EMPTY_SNAPSHOT } from '../types'

/** Construtores usados pelos testes de domínio. */

export function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    user_id: null,
    username: id,
    full_name: id.toUpperCase(),
    photo_url: null,
    player_type: 'mensalista',
    dominant_foot: 'direita',
    position: 'linha',
    status: 'ativo',
    role: 'jogador',
    must_change_password: false,
    level: 3,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeRound(id: string, overrides: Partial<Round> = {}): Round {
  return {
    id,
    date: '2026-01-10',
    title: 'Rodada',
    start_time: '20:00',
    location: 'Quadra da vila',
    team_count: 2,
    max_players: 0,
    status: 'encerrada',
    created_at: '2026-01-10T00:00:00.000Z',
    closed_at: null,
    ...overrides,
  }
}

export function makeTeam(id: string, roundId: string, position: number): Team {
  return { id, round_id: roundId, position, name: `Time ${position + 1}`, color: '#000000' }
}

export function makeRoundPlayer(
  roundId: string,
  playerId: string,
  teamId: string | null,
  position: RoundPlayer['position'] = null,
): RoundPlayer {
  return {
    id: `${roundId}-${playerId}`,
    round_id: roundId,
    player_id: playerId,
    team_id: teamId,
    attendance: 'confirmado',
    responded_at: '2026-01-09T12:00:00.000Z',
    position,
  }
}

export function makeMatch(id: string, overrides: Partial<Match> & Pick<Match, 'round_id' | 'team_a_id' | 'team_b_id'>): Match {
  return {
    id,
    sequence: 1,
    score_a: 0,
    score_b: 0,
    status: 'encerrada',
    created_at: '2026-01-10T20:00:00.000Z',
    ended_at: '2026-01-10T20:10:00.000Z',
    ...overrides,
  }
}

let eventCounter = 0
export function makeEvent(
  matchId: string,
  teamId: string,
  scorerId: string | null,
  assistId: string | null = null,
  ownGoal = false,
): MatchEvent {
  eventCounter += 1
  return {
    id: `e${eventCounter}`,
    match_id: matchId,
    team_id: teamId,
    scorer_id: scorerId,
    assist_id: assistId,
    own_goal: ownGoal,
    created_at: '2026-01-10T20:05:00.000Z',
  }
}

export function makeSnapshot(partial: Partial<Snapshot>): Snapshot {
  return { ...EMPTY_SNAPSHOT, ...partial }
}

/**
 * Cenário compartilhado pelos testes:
 * Time A (p1, p2, gk1) 3 x 1 Time B (p3, p4, gk2).
 * Gols do A: p1 (assist. p2), p1, p2 (assist. p1). Gol do B: p3.
 */
export function baseScenario(): Snapshot {
  const players = [
    makePlayer('p1'),
    makePlayer('p2'),
    makePlayer('p3'),
    makePlayer('p4'),
    makePlayer('gk1', { position: 'goleiro' }),
    makePlayer('gk2', { position: 'goleiro' }),
  ]
  const round = makeRound('r1')
  const teamA = makeTeam('tA', 'r1', 0)
  const teamB = makeTeam('tB', 'r1', 1)
  const match = makeMatch('m1', {
    round_id: 'r1',
    team_a_id: 'tA',
    team_b_id: 'tB',
    score_a: 3,
    score_b: 1,
  })

  return makeSnapshot({
    players,
    rounds: [round],
    teams: [teamA, teamB],
    roundPlayers: [
      makeRoundPlayer('r1', 'p1', 'tA'),
      makeRoundPlayer('r1', 'p2', 'tA'),
      makeRoundPlayer('r1', 'gk1', 'tA'),
      makeRoundPlayer('r1', 'p3', 'tB'),
      makeRoundPlayer('r1', 'p4', 'tB'),
      makeRoundPlayer('r1', 'gk2', 'tB'),
    ],
    matches: [match],
    events: [
      makeEvent('m1', 'tA', 'p1', 'p2'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p2', 'p1'),
      makeEvent('m1', 'tB', 'p3'),
    ],
  })
}
