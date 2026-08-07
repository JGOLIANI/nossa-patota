import { describe, expect, it } from 'vitest'
import { computeStats, playerHistory, recentForm, computeMatchLogs } from './stats'
import {
  baseScenario,
  makeEvent,
  makeMatch,
  makePlayer,
  makeRound,
  makeRoundPlayer,
  makeSnapshot,
  makeTeam,
} from './testing'

describe('computeStats', () => {
  const stats = computeStats(baseScenario())

  it('conta gols, assistências e participações do jogador de linha', () => {
    const p1 = stats.get('p1')!
    expect(p1.goals).toBe(2)
    expect(p1.assists).toBe(1)
    expect(p1.participations).toBe(3)
    expect(p1.played).toBe(1)
    expect(p1.wins).toBe(1)
    expect(p1.losses).toBe(0)
    expect(p1.pointsPct).toBe(100)
  })

  it('registra derrota e zera participações de quem não pontuou', () => {
    const p4 = stats.get('p4')!
    expect(p4.played).toBe(1)
    expect(p4.losses).toBe(1)
    expect(p4.participations).toBe(0)
    expect(p4.pointsPct).toBe(0)
  })

  it('calcula gols sofridos e jogos sem sofrer gol dos goleiros', () => {
    expect(stats.get('gk1')!.goalsAgainst).toBe(1)
    expect(stats.get('gk1')!.cleanSheets).toBe(0)
    expect(stats.get('gk2')!.goalsAgainst).toBe(3)
    expect(stats.get('gk2')!.losses).toBe(1)
  })

  it('calcula médias por partida', () => {
    const p1 = stats.get('p1')!
    expect(p1.goalsPerMatch).toBe(2)
    expect(p1.assistsPerMatch).toBe(1)
    expect(p1.participationsPerMatch).toBe(3)
    expect(stats.get('gk2')!.goalsAgainstPerMatch).toBe(3)
  })
})

describe('regras de contagem', () => {
  it('não credita gol contra ao autor, mas mantém o placar', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].score_a = 4
    snapshot.events.push(makeEvent('m1', 'tA', 'p3', null, true))

    const stats = computeStats(snapshot)
    expect(stats.get('p3')!.goals).toBe(1)
    expect(stats.get('gk2')!.goalsAgainst).toBe(4)
  })

  it('ignora partidas em andamento', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].status = 'em_andamento'
    const stats = computeStats(snapshot)
    expect(stats.get('p1')!.played).toBe(0)
    expect(stats.get('p1')!.goals).toBe(0)
  })

  it('considera empate como 1 ponto no aproveitamento', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 1
    const stats = computeStats(snapshot)
    expect(stats.get('p1')!.draws).toBe(1)
    expect(stats.get('p1')!.pointsPct).toBeCloseTo(33.33, 1)
  })

  it('filtra estatísticas por rodada', () => {
    const snapshot = baseScenario()
    snapshot.rounds.push(makeRound('r2', { date: '2026-01-17' }))
    snapshot.teams.push(makeTeam('tC', 'r2', 0), makeTeam('tD', 'r2', 1))
    snapshot.roundPlayers.push(
      makeRoundPlayer('r2', 'p1', 'tC'),
      makeRoundPlayer('r2', 'p3', 'tD'),
    )
    snapshot.matches.push(
      makeMatch('m2', {
        round_id: 'r2',
        team_a_id: 'tC',
        team_b_id: 'tD',
        score_a: 0,
        score_b: 2,
      }),
    )

    expect(computeStats(snapshot).get('p1')!.played).toBe(2)
    expect(computeStats(snapshot, { roundId: 'r2' }).get('p1')!.played).toBe(1)
    expect(computeStats(snapshot, { roundId: 'r2' }).get('p1')!.losses).toBe(1)
  })
})

describe('histórico', () => {
  it('devolve as partidas da mais recente para a mais antiga', () => {
    const snapshot = makeSnapshot({
      players: [makePlayer('p1')],
      rounds: [
        makeRound('r1', { date: '2026-01-03' }),
        makeRound('r2', { date: '2026-01-10' }),
      ],
      teams: [makeTeam('t1', 'r1', 0), makeTeam('t2', 'r1', 1), makeTeam('t3', 'r2', 0), makeTeam('t4', 'r2', 1)],
      roundPlayers: [makeRoundPlayer('r1', 'p1', 't1'), makeRoundPlayer('r2', 'p1', 't3')],
      matches: [
        makeMatch('m1', { round_id: 'r1', team_a_id: 't1', team_b_id: 't2', score_a: 2, score_b: 0 }),
        makeMatch('m2', { round_id: 'r2', team_a_id: 't3', team_b_id: 't4', score_a: 0, score_b: 1 }),
      ],
    })

    const history = playerHistory(snapshot, 'p1')
    expect(history.map((entry) => entry.matchId)).toEqual(['m2', 'm1'])
    expect(history[0].result).toBe('D')
    expect(history[1].result).toBe('V')
  })

  it('mede o desempenho recente nas últimas partidas', () => {
    const snapshot = baseScenario()
    const logs = computeMatchLogs(snapshot)
    expect(recentForm(logs.get('p1')!)).toBe(1)
    expect(recentForm(logs.get('p3')!)).toBe(0)
    expect(recentForm([])).toBe(0)
  })
})
