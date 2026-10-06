import type { Player, Snapshot } from '../types'
import { computeRatings } from './balance'
import { computeMatchLogs, computeStats, recentForm, type PlayerStats } from './stats'
import { decimal, percent, plural } from '../lib/format'

export interface RankingEntry {
  playerId: string
  value: number
  display: string
}

export interface RankingList {
  key: string
  title: string
  description: string
  entries: RankingEntry[]
}

interface Options {
  /** Mínimo de partidas para entrar em rankings de média. */
  minMatches?: number
  /** Considera apenas rodadas a partir desta data (inclusive). */
  since?: string
}

function rank(
  players: Player[],
  stats: Map<string, PlayerStats>,
  value: (entry: PlayerStats) => number,
  display: (entry: PlayerStats) => string,
  direction: 'desc' | 'asc' = 'desc',
): RankingEntry[] {
  return players
    .map((player) => {
      const entry = stats.get(player.id)
      return entry ? { playerId: player.id, value: value(entry), display: display(entry) } : null
    })
    .filter((entry): entry is RankingEntry => entry !== null)
    .sort((a, b) => (direction === 'desc' ? b.value - a.value : a.value - b.value))
}

/**
 * Todos os rankings exibidos na tela de classificação. São recalculados a
 * partir das partidas encerradas, portanto se atualizam sozinhos ao fim de
 * cada rodada.
 */
export function buildRankings(snapshot: Snapshot, options: Options = {}): RankingList[] {
  const minMatches = options.minMatches ?? 1

  const filtered: Snapshot = options.since
    ? {
        ...snapshot,
        matches: snapshot.matches.filter((match) => {
          const round = snapshot.rounds.find((item) => item.id === match.round_id)
          return round ? round.date >= options.since! : false
        }),
      }
    : snapshot

  const stats = computeStats(filtered)
  const logs = computeMatchLogs(filtered)
  const active = snapshot.players.filter((player) => (stats.get(player.id)?.played ?? 0) > 0)
  // Gol é gol: o goleiro que sobe para a linha e marca entra na artilharia
  // como qualquer outro. O ranking de goleiro é que continua restrito a quem
  // realmente jogou debaixo das traves.
  const keepers = active.filter((player) => (stats.get(player.id)?.keeperMatches ?? 0) > 0)

  const qualified = (players: Player[]) =>
    players.filter((player) => (stats.get(player.id)?.played ?? 0) >= minMatches)

  const ratings = computeRatings(
    active.map((player) => ({
      player,
      stats: stats.get(player.id)!,
      form: recentForm(logs.get(player.id) ?? []),
    })),
  )

  const overall: RankingEntry[] = active
    .map((player) => ({
      playerId: player.id,
      value: ratings.get(player.id) ?? 0,
      display: decimal(ratings.get(player.id) ?? 0, 1),
    }))
    .sort((a, b) => b.value - a.value)

  return [
    {
      key: 'artilheiro',
      title: 'Artilharia',
      description: 'Gols marcados',
      entries: rank(active, stats, (s) => s.goals, (s) => String(s.goals)).filter(
        (entry) => entry.value > 0,
      ),
    },
    {
      key: 'assistencias',
      title: 'Assistências',
      description: 'Passes para gol',
      entries: rank(active, stats, (s) => s.assists, (s) => String(s.assists)).filter(
        (entry) => entry.value > 0,
      ),
    },
    {
      key: 'participacoes',
      title: 'Participações em gols',
      description: 'Gols + assistências',
      entries: rank(
        active,
        stats,
        (s) => s.participations,
        (s) => String(s.participations),
      ).filter((entry) => entry.value > 0),
    },
    {
      key: 'melhor_jogador',
      title: 'Melhor jogador',
      description: 'Nota geral calculada pelo desempenho',
      entries: overall,
    },
    {
      key: 'vitorias',
      title: 'Vitórias',
      description: 'Partidas vencidas',
      entries: rank(active, stats, (s) => s.wins, (s) => String(s.wins)).filter(
        (entry) => entry.value > 0,
      ),
    },
    {
      key: 'aproveitamento',
      title: 'Aproveitamento',
      description: `Pontos conquistados · mínimo de ${plural(minMatches, 'partida')}`,
      entries: rank(
        qualified(active),
        stats,
        (s) => s.pointsPct,
        (s) => percent(s.pointsPct),
      ),
    },
    {
      key: 'goleiro_menos_vazado',
      title: 'Goleiro menos vazado',
      description: 'Média de gols sofridos por partida como goleiro',
      entries: rank(
        keepers.filter((player) => (stats.get(player.id)?.keeperMatches ?? 0) >= minMatches),
        stats,
        (s) => s.goalsAgainstPerMatch,
        (s) => decimal(s.goalsAgainstPerMatch, 2),
        'asc',
      ),
    },
  ]
}
