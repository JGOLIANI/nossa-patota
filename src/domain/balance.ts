import type { Player } from '../types'
import { emptyStats, type MatchLogEntry, type PlayerStats, recentForm } from './stats'

/**
 * Pesos do algoritmo de balanceamento. Somados formam a nota final do
 * jogador; alterar os valores muda o critério sem tocar no algoritmo.
 */
export interface BalanceWeights {
  level: number
  pointsPct: number
  goalsPerMatch: number
  assistsPerMatch: number
  participationsPerMatch: number
  wins: number
  losses: number
  recentForm: number
}

export const DEFAULT_WEIGHTS: BalanceWeights = {
  level: 0.25,
  pointsPct: 0.15,
  goalsPerMatch: 0.15,
  assistsPerMatch: 0.1,
  participationsPerMatch: 0.1,
  wins: 0.05,
  losses: 0.05,
  recentForm: 0.15,
}

export interface RatingInput {
  player: Player
  stats: PlayerStats
  /** Aproveitamento nas últimas partidas (0 a 1). */
  form: number
}

interface Metric {
  key: keyof BalanceWeights
  value: (input: RatingInput) => number
  /** Métricas em que "menor é melhor" são invertidas após a normalização. */
  invert?: boolean
  /** Métricas que só fazem sentido para quem já jogou. */
  needsMatches: boolean
}

const METRICS: Metric[] = [
  { key: 'level', value: (i) => i.player.level, needsMatches: false },
  { key: 'pointsPct', value: (i) => i.stats.pointsPct, needsMatches: true },
  { key: 'goalsPerMatch', value: (i) => i.stats.goalsPerMatch, needsMatches: true },
  { key: 'assistsPerMatch', value: (i) => i.stats.assistsPerMatch, needsMatches: true },
  {
    key: 'participationsPerMatch',
    value: (i) => i.stats.participationsPerMatch,
    needsMatches: true,
  },
  { key: 'wins', value: (i) => i.stats.wins, needsMatches: true },
  { key: 'losses', value: (i) => i.stats.losses, invert: true, needsMatches: true },
  { key: 'recentForm', value: (i) => i.form, needsMatches: true },
]

/** Normalizador min-max; devolve 0.5 quando não há variação no grupo. */
function normalizer(values: number[]): (value: number) => number {
  if (values.length === 0) return () => 0.5
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return () => 0.5
  return (value) => (value - min) / (max - min)
}

/** PRNG determinístico: mesma semente, mesmos times. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFromString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Nota de 0 a 100 de cada jogador, relativa ao grupo avaliado.
 * Quem ainda não jogou recebe valor neutro nas métricas históricas,
 * evitando que estreantes fiquem sempre no fim da fila.
 */
export function computeRatings(
  inputs: RatingInput[],
  weights: BalanceWeights = DEFAULT_WEIGHTS,
): Map<string, number> {
  const experienced = inputs.filter((input) => input.stats.played > 0)
  const scales = new Map<keyof BalanceWeights, (value: number) => number>()
  for (const metric of METRICS) {
    const pool = metric.needsMatches ? experienced : inputs
    scales.set(metric.key, normalizer(pool.map(metric.value)))
  }

  const totalWeight = METRICS.reduce((sum, metric) => sum + (weights[metric.key] ?? 0), 0)
  const ratings = new Map<string, number>()

  for (const input of inputs) {
    let score = 0
    for (const metric of METRICS) {
      const weight = weights[metric.key] ?? 0
      if (weight === 0) continue
      let normalized: number
      if (metric.needsMatches && input.stats.played === 0) {
        normalized = 0.5
      } else {
        normalized = scales.get(metric.key)!(metric.value(input))
        if (metric.invert) normalized = 1 - normalized
      }
      score += weight * normalized
    }
    ratings.set(input.player.id, totalWeight > 0 ? (score / totalWeight) * 100 : 50)
  }

  return ratings
}

export interface BalancedTeam {
  /** Índice do time na rodada (0, 1, 2...). */
  index: number
  playerIds: string[]
  total: number
  average: number
}

export interface BalanceResult {
  teams: BalancedTeam[]
  ratings: Map<string, number>
  /** Diferença entre a maior e a menor média — quanto menor, mais equilibrado. */
  spread: number
}

function spreadOf(teams: BalancedTeam[]): number {
  const averages = teams.map((team) => team.average)
  return Math.max(...averages) - Math.min(...averages)
}

function recalc(team: BalancedTeam, ratings: Map<string, number>): void {
  team.total = team.playerIds.reduce((sum, id) => sum + (ratings.get(id) ?? 0), 0)
  team.average = team.playerIds.length > 0 ? team.total / team.playerIds.length : 0
}

export interface GenerateTeamsInput {
  players: Player[]
  stats: Map<string, PlayerStats>
  logs?: Map<string, MatchLogEntry[]>
  teamCount: number
  weights?: BalanceWeights
  seed?: number
}

/**
 * Distribui os participantes em times equilibrados.
 *
 * 1. calcula a nota de cada jogador;
 * 2. espalha os goleiros (no máximo um por time enquanto houver times sem);
 * 3. distribui os jogadores de linha, sempre para o time mais fraco;
 * 4. refina trocando pares de jogadores de linha enquanto isso reduzir a
 *    diferença entre as médias dos times.
 */
export function generateTeams(input: GenerateTeamsInput): BalanceResult {
  const teamCount = Math.max(1, Math.floor(input.teamCount))
  const weights = input.weights ?? DEFAULT_WEIGHTS
  const random = mulberry32(input.seed ?? 1)

  const ratingInputs: RatingInput[] = input.players.map((player) => {
    const stats = input.stats.get(player.id) ?? emptyStats(player.id)
    return { player, stats, form: recentForm(input.logs?.get(player.id) ?? []) }
  })

  const ratings = computeRatings(ratingInputs, weights)
  // Ruído mínimo e determinístico apenas para desempatar notas idênticas,
  // dando variedade aos times entre rodadas diferentes.
  const sortKeys = new Map<string, number>()
  for (const [id, rating] of ratings) sortKeys.set(id, rating + random() * 1e-6)

  const teams: BalancedTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    index,
    playerIds: [],
    total: 0,
    average: 0,
  }))

  const base = Math.floor(input.players.length / teamCount)
  const remainder = input.players.length % teamCount
  const targetSize = teams.map((_, index) => base + (index < remainder ? 1 : 0))

  const byRating = (a: Player, b: Player) => (sortKeys.get(b.id) ?? 0) - (sortKeys.get(a.id) ?? 0)
  const keepers = input.players.filter((p) => p.position === 'goleiro').sort(byRating)
  const line = input.players.filter((p) => p.position !== 'goleiro').sort(byRating)

  const keeperCount = new Array(teamCount).fill(0)
  for (const keeper of keepers) {
    const candidates = teams.filter((team) => team.playerIds.length < targetSize[team.index])
    const pool = candidates.length > 0 ? candidates : teams
    const fewestKeepers = Math.min(...pool.map((team) => keeperCount[team.index]))
    const target = pool
      .filter((team) => keeperCount[team.index] === fewestKeepers)
      .sort((a, b) => a.total - b.total)[0]
    target.playerIds.push(keeper.id)
    keeperCount[target.index] += 1
    recalc(target, ratings)
  }

  for (const player of line) {
    const candidates = teams.filter((team) => team.playerIds.length < targetSize[team.index])
    const pool = candidates.length > 0 ? candidates : teams
    const target = [...pool].sort(
      (a, b) => a.total - b.total || a.playerIds.length - b.playerIds.length,
    )[0]
    target.playerIds.push(player.id)
    recalc(target, ratings)
  }

  // Refinamento: troca de jogadores de linha entre times.
  const isLine = new Set(line.map((player) => player.id))
  let improved = true
  let guard = 0
  while (improved && guard < 200) {
    improved = false
    guard += 1
    let best = spreadOf(teams)

    for (let i = 0; i < teams.length && !improved; i += 1) {
      for (let j = i + 1; j < teams.length && !improved; j += 1) {
        for (let a = 0; a < teams[i].playerIds.length && !improved; a += 1) {
          const playerA = teams[i].playerIds[a]
          if (!isLine.has(playerA)) continue
          for (let b = 0; b < teams[j].playerIds.length; b += 1) {
            const playerB = teams[j].playerIds[b]
            if (!isLine.has(playerB)) continue

            teams[i].playerIds[a] = playerB
            teams[j].playerIds[b] = playerA
            recalc(teams[i], ratings)
            recalc(teams[j], ratings)
            const candidate = spreadOf(teams)

            if (candidate < best - 1e-9) {
              best = candidate
              improved = true
              break
            }
            teams[i].playerIds[a] = playerA
            teams[j].playerIds[b] = playerB
            recalc(teams[i], ratings)
            recalc(teams[j], ratings)
          }
        }
      }
    }
  }

  for (const team of teams) {
    team.playerIds.sort((a, b) => (ratings.get(b) ?? 0) - (ratings.get(a) ?? 0))
  }

  return { teams, ratings, spread: spreadOf(teams) }
}
