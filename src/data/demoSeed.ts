import { computeRoundAwards } from '../domain/awards'
import { nextOccurrences, roundTitle } from '../domain/schedule'
import { generateTeams } from '../domain/balance'
import { computeMatchLogs, computeStats } from '../domain/stats'
import { scoreFromEvents } from '../domain/score'
import type { Match, MatchEvent, Player, Snapshot } from '../types'
import { DEFAULT_SETTINGS, TEAM_PRESETS } from '../types'

/** PRNG determinístico para que a demonstração seja sempre a mesma. */
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

interface SeedPlayer {
  name: string
  username: string
  position?: 'goleiro' | 'linha'
  level: number
  type?: 'mensalista' | 'visitante'
  foot?: 'direita' | 'esquerda' | 'ambidestro'
  role?: 'admin' | 'jogador'
}

const SEED_PLAYERS: SeedPlayer[] = [
  { name: 'Administrador da Patota', username: 'admin', level: 3, role: 'admin' },
  { name: 'Bruno Paredão', username: 'bruno', position: 'goleiro', level: 4 },
  { name: 'Carlão Luvas', username: 'carlao', position: 'goleiro', level: 3 },
  { name: 'Diego Canhota', username: 'diego', level: 5, foot: 'esquerda' },
  { name: 'Eduardo Pivô', username: 'eduardo', level: 4 },
  { name: 'Fábio Ala', username: 'fabio', level: 4, foot: 'esquerda' },
  { name: 'Gustavo Fixo', username: 'gustavo', level: 3 },
  { name: 'Henrique Veloz', username: 'henrique', level: 4, foot: 'ambidestro' },
  { name: 'Igor Artilheiro', username: 'igor', level: 5 },
  { name: 'João Garçom', username: 'joao', level: 3 },
  { name: 'Kleber Muralha', username: 'kleber', level: 2 },
  { name: 'Lucas Driblador', username: 'lucas', level: 4 },
  { name: 'Marcelo Raçudo', username: 'marcelo', level: 2 },
  { name: 'Nando Visitante', username: 'nando', level: 3, type: 'visitante' },
]

const ROUND_DATES = ['2026-07-10', '2026-07-17', '2026-07-24']

/**
 * Gera uma patota fictícia completa (jogadores, rodadas, partidas, gols e
 * premiações) para que o modo demonstração já abra com conteúdo real.
 */
export function createDemoSnapshot(): Snapshot {
  const random = prng(20260807)

  const players: Player[] = SEED_PLAYERS.map((seed, index) => ({
    id: `demo-player-${index + 1}`,
    user_id: `demo-player-${index + 1}`,
    username: seed.username,
    full_name: seed.name,
    photo_url: null,
    player_type: seed.type ?? 'mensalista',
    dominant_foot: seed.foot ?? 'direita',
    position: seed.position ?? 'linha',
    status: 'ativo',
    role: seed.role ?? 'jogador',
    level: seed.level,
    created_at: '2026-06-01T12:00:00.000Z',
  }))

  const snapshot: Snapshot = {
    players,
    rounds: [],
    teams: [],
    roundPlayers: [],
    matches: [],
    events: [],
    awards: [],
    settings: { ...DEFAULT_SETTINGS, weekday: 5, location: 'Quadra do Zé', max_players: 14 },
  }

  let eventSeq = 0

  ROUND_DATES.forEach((date, roundIndex) => {
    const roundId = `demo-round-${roundIndex + 1}`
    // O visitante só aparece na última rodada.
    const participants = players.filter(
      (player) => player.player_type === 'mensalista' || roundIndex === ROUND_DATES.length - 1,
    )

    const balance = generateTeams({
      players: participants,
      stats: computeStats(snapshot),
      logs: computeMatchLogs(snapshot),
      teamCount: 2,
      seed: roundIndex + 1,
    })

    snapshot.rounds.push({
      id: roundId,
      date,
      title: `Rodada de ${date.slice(8, 10)}/${date.slice(5, 7)}`,
      start_time: '20:00',
      location: 'Quadra do Zé',
      team_count: 2,
      max_players: 14,
      status: 'encerrada',
      created_at: `${date}T18:00:00.000Z`,
      closed_at: `${date}T22:00:00.000Z`,
    })

    balance.teams.forEach((team, teamIndex) => {
      const preset = TEAM_PRESETS[teamIndex % TEAM_PRESETS.length]
      const teamId = `${roundId}-team-${teamIndex}`
      snapshot.teams.push({
        id: teamId,
        round_id: roundId,
        position: teamIndex,
        name: preset.name,
        color: preset.color,
      })
      for (const playerId of team.playerIds) {
        snapshot.roundPlayers.push({
          id: `${roundId}-${playerId}`,
          round_id: roundId,
          player_id: playerId,
          team_id: teamId,
          attendance: 'confirmado',
          responded_at: `${date}T12:00:00.000Z`,
        })
      }
    })

    const teamIds = snapshot.teams
      .filter((team) => team.round_id === roundId)
      .map((team) => team.id)

    const lineByTeam = new Map(
      teamIds.map((teamId) => [
        teamId,
        snapshot.roundPlayers
          .filter((rp) => rp.team_id === teamId)
          .map((rp) => players.find((p) => p.id === rp.player_id)!)
          .filter((player) => player.position === 'linha'),
      ]),
    )

    for (let matchIndex = 0; matchIndex < 2; matchIndex += 1) {
      const match: Match = {
        id: `${roundId}-match-${matchIndex + 1}`,
        round_id: roundId,
        sequence: matchIndex + 1,
        team_a_id: teamIds[0],
        team_b_id: teamIds[1],
        score_a: 0,
        score_b: 0,
        status: 'encerrada',
        created_at: `${date}T19:0${matchIndex}:00.000Z`,
        ended_at: `${date}T19:3${matchIndex}:00.000Z`,
      }

      const events: MatchEvent[] = []
      for (const teamId of teamIds) {
        const squad = lineByTeam.get(teamId) ?? []
        const goals = Math.floor(random() * 5)
        for (let goal = 0; goal < goals; goal += 1) {
          const scorer = squad[Math.floor(random() * squad.length)]
          const assistCandidates = squad.filter((player) => player.id !== scorer.id)
          const withAssist = random() > 0.4 && assistCandidates.length > 0
          eventSeq += 1
          events.push({
            id: `demo-event-${eventSeq}`,
            match_id: match.id,
            team_id: teamId,
            scorer_id: scorer.id,
            assist_id: withAssist
              ? assistCandidates[Math.floor(random() * assistCandidates.length)].id
              : null,
            own_goal: false,
            created_at: `${date}T19:1${matchIndex}:0${goal}.000Z`,
          })
        }
      }

      snapshot.events.push(...events)
      const score = scoreFromEvents(match, events)
      match.score_a = score.score_a
      match.score_b = score.score_b
      snapshot.matches.push(match)
    }

    const awards = computeRoundAwards(snapshot, roundId)
    for (const [type, playerIds] of Object.entries(awards)) {
      for (const playerId of playerIds) {
        snapshot.awards.push({
          id: `${roundId}-award-${type}-${playerId}`,
          round_id: roundId,
          type: type as never,
          player_id: playerId,
        })
      }
    }
  })

  // Uma rodada futura em aberto, para que a demonstração já mostre a
  // confirmação de presença funcionando.
  const today = new Date()
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nextDate = nextOccurrences(5, todayISO, 1)[0]

  snapshot.rounds.push({
    id: 'demo-round-next',
    date: nextDate,
    title: roundTitle(nextDate),
    start_time: '20:00',
    location: 'Quadra do Zé',
    team_count: 2,
    max_players: 14,
    status: 'rascunho',
    created_at: `${nextDate}T08:00:00.000Z`,
    closed_at: null,
  })

  // Nove já confirmaram; o administrador ainda não respondeu, de propósito.
  players
    .filter((player) => player.username !== 'admin' && player.player_type === 'mensalista')
    .slice(0, 9)
    .forEach((player, index) => {
      snapshot.roundPlayers.push({
        id: `demo-next-${player.id}`,
        round_id: 'demo-round-next',
        player_id: player.id,
        team_id: null,
        attendance: 'confirmado',
        responded_at: `${nextDate}T09:${String(index).padStart(2, '0')}:00.000Z`,
      })
    })

  return snapshot
}
