import type { Match, MatchEvent, Player, Round, RoundPlayer, Snapshot, Team } from '../types'
import { DEFAULT_SETTINGS } from '../types'

/**
 * Gerador de histórico sintético, usado apenas pelos benchmarks.
 *
 * Reproduz a forma real dos dados — uma rodada por semana, dois times, uma
 * partida, gols distribuídos entre os presentes — para que as medições
 * respondam à pergunta que interessa: até que tamanho de patota as contas
 * feitas no celular continuam instantâneas.
 */

function prng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BenchScale {
  /** Jogadores cadastrados na patota. */
  players: number
  /** Rodadas no histórico (uma por semana). */
  rounds: number
  /** Quantos comparecem por rodada. */
  perRound: number
}

/** Tamanhos de referência, do grupo de amigos ao clube com anos de acervo. */
export const SCALES: Record<string, BenchScale> = {
  pequena: { players: 14, rounds: 12, perRound: 10 },
  media: { players: 30, rounds: 104, perRound: 14 },
  grande: { players: 60, rounds: 260, perRound: 20 },
  gigante: { players: 120, rounds: 520, perRound: 24 },
}

export function makeSnapshot(scale: BenchScale, seed = 7): Snapshot {
  const random = prng(seed)

  const players: Player[] = Array.from({ length: scale.players }, (_, index) => ({
    id: `p${index}`,
    user_id: `u${index}`,
    username: `jogador${index}`,
    full_name: `Jogador Número ${index}`,
    photo_url: null,
    player_type: 'mensalista',
    dominant_foot: 'direita',
    // Um goleiro a cada seis jogadores, como numa patota de verdade.
    position: index % 6 === 0 ? 'goleiro' : 'linha',
    status: 'ativo',
    role: index === 0 ? 'admin' : 'jogador',
    level: 1 + Math.floor(random() * 5),
    created_at: '2020-01-01T00:00:00.000Z',
  }))

  const rounds: Round[] = []
  const teams: Team[] = []
  const roundPlayers: RoundPlayer[] = []
  const matches: Match[] = []
  const events: MatchEvent[] = []

  const start = new Date('2020-01-03T12:00:00')

  for (let index = 0; index < scale.rounds; index += 1) {
    const day = new Date(start)
    day.setDate(start.getDate() + index * 7)
    const date = day.toISOString().slice(0, 10)
    const roundId = `r${index}`

    rounds.push({
      id: roundId,
      date,
      title: `Rodada ${index + 1}`,
      start_time: '20:00',
      location: 'Quadra',
      team_count: 2,
      max_players: scale.perRound,
      status: 'encerrada',
      created_at: `${date}T18:00:00.000Z`,
      closed_at: `${date}T22:00:00.000Z`,
    })

    const teamIds = [0, 1].map((position) => {
      const id = `${roundId}-t${position}`
      teams.push({
        id,
        round_id: roundId,
        position,
        name: position === 0 ? 'Time Verde' : 'Time Azul',
        color: position === 0 ? '#22c55e' : '#3b82f6',
      })
      return id
    })

    // Quem joga muda a cada rodada, girando pela lista de cadastrados.
    const squad: Player[] = []
    for (let slot = 0; slot < scale.perRound; slot += 1) {
      squad.push(players[(index * 3 + slot) % players.length])
    }

    const lineByTeam = new Map<string, Player[]>([
      [teamIds[0], []],
      [teamIds[1], []],
    ])

    squad.forEach((player, slot) => {
      const teamId = teamIds[slot % 2]
      roundPlayers.push({
        id: `${roundId}-${player.id}`,
        round_id: roundId,
        player_id: player.id,
        team_id: teamId,
        attendance: 'confirmado',
        responded_at: `${date}T10:00:00.000Z`,
        position: player.position,
      })
      if (player.position === 'linha') lineByTeam.get(teamId)!.push(player)
    })

    const match: Match = {
      id: `${roundId}-m`,
      round_id: roundId,
      sequence: 1,
      team_a_id: teamIds[0],
      team_b_id: teamIds[1],
      score_a: 0,
      score_b: 0,
      status: 'encerrada',
      created_at: `${date}T20:00:00.000Z`,
      ended_at: `${date}T21:00:00.000Z`,
    }

    teamIds.forEach((teamId, side) => {
      const line = lineByTeam.get(teamId)!
      if (line.length === 0) return
      const goals = Math.floor(random() * 6)
      for (let goal = 0; goal < goals; goal += 1) {
        const scorer = line[Math.floor(random() * line.length)]
        const assist = line[Math.floor(random() * line.length)]
        events.push({
          id: `${roundId}-e${side}-${goal}`,
          match_id: match.id,
          team_id: teamId,
          scorer_id: scorer.id,
          assist_id: assist.id === scorer.id ? null : assist.id,
          own_goal: false,
          created_at: `${date}T20:${String(goal).padStart(2, '0')}:00.000Z`,
        })
      }
      if (side === 0) match.score_a = goals
      else match.score_b = goals
    })

    matches.push(match)
  }

  return {
    players,
    rounds,
    teams,
    roundPlayers,
    matches,
    events,
    awards: [],
    settings: DEFAULT_SETTINGS,
  }
}

/** Contagem de linhas do snapshot, para relatar o tamanho medido. */
export function describeSnapshot(snapshot: Snapshot): string {
  return [
    `${snapshot.players.length} jogadores`,
    `${snapshot.rounds.length} rodadas`,
    `${snapshot.matches.length} partidas`,
    `${snapshot.events.length} gols`,
    `${snapshot.roundPlayers.length} presenças`,
  ].join(' · ')
}
