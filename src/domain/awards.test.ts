import { describe, expect, it } from 'vitest'
import { computeRoundAwards, losingTeam } from './awards'
import { baseScenario, makeEvent, makeRoundPlayer } from './testing'

/**
 * No cenário base o Time A (p1, p2, gk1) vence o Time B (p3, p4, gk2) por
 * 3 a 1, então o pior jogador tem de sair do Time B.
 */
describe('computeRoundAwards', () => {
  it('elege o jogador com mais participações em gols', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').jogador_rodada).toEqual(['p1'])
  })

  it('premia o goleiro menos vazado', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').goleiro_menos_vazado).toEqual(['gk1'])
  })

  it('não inclui goleiros na disputa de jogador da rodada', () => {
    const snapshot = baseScenario()
    snapshot.events.push(makeEvent('m1', 'tA', 'gk1'), makeEvent('m1', 'tA', 'gk1'))
    snapshot.matches[0].score_a = 5

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual(['p1'])
    expect(awards.pior_jogador).not.toContain('gk1')
  })

  it('devolve todos os empatados no jogador da rodada', () => {
    const snapshot = baseScenario()
    snapshot.events.push(makeEvent('m1', 'tB', 'p3'), makeEvent('m1', 'tB', 'p4', 'p3'))
    snapshot.matches[0].score_b = 3

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada.sort()).toEqual(['p1', 'p3'])
  })

  it('não elege jogador da rodada quando ninguém participou de gols', () => {
    const snapshot = baseScenario()
    snapshot.events = []
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 0

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada).toEqual([])
  })
})

describe('pior jogador — sai do time derrotado', () => {
  it('escolhe quem menos participou de gols no time que perdeu', () => {
    // No Time B, p3 fez um gol e p4 não fez nada.
    expect(computeRoundAwards(baseScenario(), 'r1').pior_jogador).toEqual(['p4'])
  })

  it('nunca escolhe alguém do time vencedor, mesmo sem participação', () => {
    const snapshot = baseScenario()
    // p2 perde as participações: passa a ser o único zerado da rodada, mas
    // está no time que ganhou.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tB', 'p3'),
    ]

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.pior_jogador).not.toContain('p2')
    expect(awards.pior_jogador).toEqual(['p4'])
  })

  it('devolve todos os empatados dentro do time perdedor', () => {
    const snapshot = baseScenario()
    // Ninguém do Time B participa de gol: p3 e p4 empatam em zero.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p2'),
    ]
    snapshot.matches[0].score_b = 0

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador.sort()).toEqual(['p3', 'p4'])
  })

  it('não premia ninguém quando a partida termina empatada', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 1

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).toEqual([])
  })

  it('ignora quem foi inscrito mas não entrou em campo', () => {
    const snapshot = baseScenario()
    snapshot.players.push({ ...snapshot.players[0], id: 'p9', username: 'p9' })
    snapshot.roundPlayers.push(makeRoundPlayer('r1', 'p9', null))

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).not.toContain('p9')
  })
})

describe('losingTeam', () => {
  it('aponta o time derrotado da rodada', () => {
    expect(losingTeam(baseScenario(), 'r1')).toBe('tB')
  })

  it('não aponta ninguém no empate', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].score_b = 3
    expect(losingTeam(snapshot, 'r1')).toBeNull()
  })

  it('ignora partidas ainda em andamento', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].status = 'em_andamento'
    expect(losingTeam(snapshot, 'r1')).toBeNull()
  })
})
