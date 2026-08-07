import { describe, expect, it } from 'vitest'
import { computeRatings, generateTeams, seedFromString } from './balance'
import { emptyStats, type PlayerStats } from './stats'
import { makePlayer } from './testing'
import type { Player } from '../types'

function statsFor(playerId: string, overrides: Partial<PlayerStats>): PlayerStats {
  return { ...emptyStats(playerId), ...overrides }
}

/** 8 jogadores de linha com desempenho decrescente. */
function squad(): { players: Player[]; stats: Map<string, PlayerStats> } {
  const players: Player[] = []
  const stats = new Map<string, PlayerStats>()
  for (let i = 1; i <= 8; i += 1) {
    const id = `p${i}`
    players.push(makePlayer(id, { level: Math.max(1, 5 - Math.floor((i - 1) / 2)) }))
    stats.set(
      id,
      statsFor(id, {
        played: 10,
        wins: 10 - i,
        losses: i,
        goals: 20 - 2 * i,
        assists: 10 - i,
        participations: 30 - 3 * i,
        pointsPct: ((10 - i) * 3) / 30 * 100,
        goalsPerMatch: (20 - 2 * i) / 10,
        assistsPerMatch: (10 - i) / 10,
        participationsPerMatch: (30 - 3 * i) / 10,
      }),
    )
  }
  return { players, stats }
}

describe('computeRatings', () => {
  it('coloca o jogador sem histórico entre o melhor e o pior do grupo', () => {
    const players = [
      makePlayer('bom', { level: 3 }),
      makePlayer('ruim', { level: 3 }),
      makePlayer('novato', { level: 3 }),
    ]
    const ratings = computeRatings([
      {
        player: players[0],
        stats: statsFor('bom', {
          played: 10,
          wins: 9,
          losses: 1,
          goals: 20,
          assists: 10,
          participations: 30,
          pointsPct: 90,
          goalsPerMatch: 2,
          assistsPerMatch: 1,
          participationsPerMatch: 3,
        }),
        form: 1,
      },
      {
        player: players[1],
        stats: statsFor('ruim', { played: 10, wins: 0, losses: 10 }),
        form: 0,
      },
      { player: players[2], stats: emptyStats('novato'), form: 0 },
    ])

    expect(ratings.get('bom')!).toBeGreaterThan(ratings.get('novato')!)
    expect(ratings.get('novato')!).toBeGreaterThan(ratings.get('ruim')!)
  })

  it('devolve nota neutra quando todos são idênticos', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const ratings = computeRatings(
      players.map((player) => ({ player, stats: emptyStats(player.id), form: 0 })),
    )
    expect(ratings.get('a')).toBeCloseTo(50)
    expect(ratings.get('b')).toBeCloseTo(50)
  })
})

describe('generateTeams', () => {
  it('divide os jogadores em times do mesmo tamanho', () => {
    const { players, stats } = squad()
    const result = generateTeams({ players, stats, teamCount: 2, seed: 1 })

    expect(result.teams).toHaveLength(2)
    expect(result.teams.map((team) => team.playerIds.length)).toEqual([4, 4])
    expect(result.teams.flatMap((team) => team.playerIds).sort()).toEqual(
      players.map((p) => p.id).sort(),
    )
  })

  it('distribui tamanhos com diferença máxima de um jogador', () => {
    const { players, stats } = squad()
    const result = generateTeams({ players, stats, teamCount: 3, seed: 7 })
    const sizes = result.teams.map((team) => team.playerIds.length).sort()
    expect(sizes).toEqual([2, 3, 3])
  })

  it('espalha os goleiros, um por time', () => {
    const { players, stats } = squad()
    const keepers = [
      makePlayer('gk1', { position: 'goleiro' }),
      makePlayer('gk2', { position: 'goleiro' }),
    ]
    for (const keeper of keepers) stats.set(keeper.id, emptyStats(keeper.id))

    const result = generateTeams({
      players: [...players, ...keepers],
      stats,
      teamCount: 2,
      seed: 3,
    })

    for (const team of result.teams) {
      const count = team.playerIds.filter((id) => id.startsWith('gk')).length
      expect(count).toBe(1)
    }
  })

  it('mantém a diferença entre as médias dos times pequena', () => {
    const { players, stats } = squad()
    const result = generateTeams({ players, stats, teamCount: 2, seed: 42 })
    expect(result.spread).toBeLessThan(5)
  })

  it('é determinístico para a mesma semente', () => {
    const { players, stats } = squad()
    const a = generateTeams({ players, stats, teamCount: 2, seed: 99 })
    const b = generateTeams({ players, stats, teamCount: 2, seed: 99 })
    expect(a.teams.map((t) => t.playerIds)).toEqual(b.teams.map((t) => t.playerIds))
  })

  it('lida com um único time', () => {
    const { players, stats } = squad()
    const result = generateTeams({ players, stats, teamCount: 1, seed: 1 })
    expect(result.teams).toHaveLength(1)
    expect(result.teams[0].playerIds).toHaveLength(8)
    expect(result.spread).toBe(0)
  })

  it('gera a mesma semente para o mesmo texto', () => {
    expect(seedFromString('rodada-1')).toBe(seedFromString('rodada-1'))
    expect(seedFromString('rodada-1')).not.toBe(seedFromString('rodada-2'))
  })
})
