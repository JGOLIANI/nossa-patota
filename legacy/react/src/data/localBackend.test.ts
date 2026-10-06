import { beforeEach, describe, expect, it } from 'vitest'
import { computeRoundAwards, votingState } from '../domain/awards'
import { scoreFromEvents } from '../domain/score'
import { computeStats } from '../domain/stats'
import { roundAwards, teamPlayers } from '../domain/selectors'

/**
 * Testes do backend de demonstração e da patota fictícia que ele semeia.
 *
 * O modo demonstração é a porta de entrada do aplicativo — quem chega sem
 * Supabase configurado vê esta patota — então ele merece o mesmo cuidado do
 * backend de verdade.
 */

class MemStorage {
  private map = new Map<string, string>()
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  clear() {
    this.map.clear()
  }
}

;(globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage()

const { localBackend: backend, resetDemoData } = await import('./localBackend')

const OPEN_ROUND = 'demo-round-next'

beforeEach(() => {
  localStorage.clear()
  resetDemoData()
})

describe('fetchAll não entrega as listas vivas do acervo', () => {
  it('a leitura anterior não enxerga o que foi gravado depois', async () => {
    const before = await backend.fetchAll()
    const count = before.events.length

    const match = before.matches[0]
    await backend.addEvent({
      match_id: match.id,
      team_id: match.team_a_id,
      scorer_id: null,
      assist_id: null,
      own_goal: false,
    })

    expect(before.events).toHaveLength(count)
    expect((await backend.fetchAll()).events).toHaveLength(count + 1)
  })

  /**
   * É o caminho de `addGoal`: o placar é recalculado somando o gol recém-criado
   * à lista que a tela já tinha. Com a lista viva o gol entrava duas vezes e o
   * placar subia de dois em dois.
   */
  it('o placar sobe de um em um a cada gol registrado', async () => {
    await backend.signIn('admin', '')
    const teams = [
      { name: 'A', color: '#111111', playerIds: ['demo-player-2'] },
      { name: 'B', color: '#222222', playerIds: ['demo-player-3'] },
    ]
    await backend.setRoundTeams(OPEN_ROUND, teams)
    const created = (await backend.fetchAll()).teams
      .filter((team) => team.round_id === OPEN_ROUND)
      .sort((a, b) => a.position - b.position)
    const match = await backend.createMatch(OPEN_ROUND, created[0].id, created[1].id)

    for (const expected of [1, 2, 3]) {
      const snapshot = await backend.fetchAll()
      const event = await backend.addEvent({
        match_id: match.id,
        team_id: created[0].id,
        scorer_id: 'demo-player-2',
        assist_id: null,
        own_goal: false,
      })
      await backend.updateMatch(match.id, scoreFromEvents(match, [...snapshot.events, event]))

      const saved = (await backend.fetchAll()).matches.find((item) => item.id === match.id)!
      expect(saved.score_a).toBe(expected)
      expect(saved.score_b).toBe(0)
    }
  })
})

describe('quem deixa de estar confirmado sai do time', () => {
  async function drawnRound() {
    await backend.signIn('admin', '')
    await backend.setRoundTeams(OPEN_ROUND, [
      { name: 'A', color: '#111111', playerIds: ['demo-player-2', 'demo-player-4'] },
      { name: 'B', color: '#222222', playerIds: ['demo-player-3', 'demo-player-5'] },
    ])
    return (await backend.fetchAll()).teams
      .filter((team) => team.round_id === OPEN_ROUND)
      .sort((a, b) => a.position - b.position)
  }

  it('desistir depois do sorteio tira o jogador da escalação', async () => {
    const teams = await drawnRound()
    await backend.signIn('diego', '') // demo-player-4, escalado no time A
    await backend.respondAttendance(OPEN_ROUND, 'fora')

    const snapshot = await backend.fetchAll()
    const row = snapshot.roundPlayers.find(
      (rp) => rp.round_id === OPEN_ROUND && rp.player_id === 'demo-player-4',
    )!
    expect(row.attendance).toBe('fora')
    expect(row.team_id).toBeNull()
    expect(teamPlayers(snapshot, teams[0].id).map((player) => player.id)).not.toContain(
      'demo-player-4',
    )
  })

  it('o desistente não conta a partida nas estatísticas', async () => {
    const teams = await drawnRound()
    const match = await backend.createMatch(OPEN_ROUND, teams[0].id, teams[1].id)
    await backend.updateMatch(match.id, { status: 'encerrada', score_a: 3, score_b: 0 })

    await backend.signIn('diego', '')
    await backend.respondAttendance(OPEN_ROUND, 'fora')

    const stats = computeStats(await backend.fetchAll(), { roundId: OPEN_ROUND })
    expect(stats.get('demo-player-4')!.played).toBe(0)
    expect(stats.get('demo-player-2')!.played).toBe(1)
  })

  it('o ajuste manual do administrador segue a mesma regra', async () => {
    await drawnRound()
    await backend.setAttendance(OPEN_ROUND, [
      { player_id: 'demo-player-5', attendance: 'espera' },
    ])
    const row = (await backend.fetchAll()).roundPlayers.find(
      (rp) => rp.round_id === OPEN_ROUND && rp.player_id === 'demo-player-5',
    )!
    expect(row.team_id).toBeNull()
  })
})

describe('uma partida por data', () => {
  it('recusa criar outra partida no mesmo dia', async () => {
    const date = (await backend.fetchAll()).rounds[0].date
    await expect(
      backend.createRound({
        date,
        title: 'Amistoso',
        start_time: '20:00',
        location: '',
        location_url: '',
        team_count: 2,
        max_players: 0,
      }),
    ).rejects.toThrow(/já existe uma partida/i)
  })
})

describe('código de entrada da patota', () => {
  it('sem código definido, o cadastro é dispensado de pedir um', async () => {
    await expect(backend.joinCodeRequired()).resolves.toEqual({ policy: 'dispensado' })
  })

  it('com código definido, passa a ser exigido', async () => {
    await backend.updateSettings({ join_code: 'PATOTA24' })
    await expect(backend.joinCodeRequired()).resolves.toEqual({ policy: 'exigido' })
  })

  it('só espaços em branco não valem como código', async () => {
    await backend.updateSettings({ join_code: '   ' })
    await expect(backend.joinCodeRequired()).resolves.toEqual({ policy: 'dispensado' })
  })
})

describe('patota fictícia', () => {
  it('toda partida já apurada tem premiação', async () => {
    const snapshot = await backend.fetchAll()
    const settled = snapshot.rounds.filter(
      (round) => round.status === 'encerrada' && round.awards_settled_at,
    )
    expect(settled.length).toBeGreaterThan(1)
    for (const round of settled) {
      expect(roundAwards(snapshot, round.id).length).toBeGreaterThan(0)
    }
  })

  it('a partida mais recente está em votação, ainda sem prêmio gravado', async () => {
    const snapshot = await backend.fetchAll()
    const voting = snapshot.rounds.filter((round) => votingState(round) === 'aberta')
    expect(voting).toHaveLength(1)
    expect(roundAwards(snapshot, voting[0].id)).toHaveLength(0)
    // Sem prêmio gravado, mas com quem premiar: a apuração já sabe o resultado.
    expect(computeRoundAwards(snapshot, voting[0].id).jogador_rodada).toBeTruthy()
  })

  it('o placar de cada partida bate com os gols registrados', async () => {
    const snapshot = await backend.fetchAll()
    for (const match of snapshot.matches) {
      expect(scoreFromEvents(match, snapshot.events)).toEqual({
        score_a: match.score_a,
        score_b: match.score_b,
      })
    }
  })
})
