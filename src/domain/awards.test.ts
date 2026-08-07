import { describe, expect, it } from 'vitest'
import { computeRoundAwards } from './awards'
import { baseScenario, makeEvent } from './testing'

describe('computeRoundAwards', () => {
  it('elege o jogador com mais participações em gols', () => {
    const awards = computeRoundAwards(baseScenario(), 'r1')
    expect(awards.jogador_rodada).toEqual(['p1'])
  })

  it('lista os jogadores de linha sem nenhuma participação em gol', () => {
    const awards = computeRoundAwards(baseScenario(), 'r1')
    expect(awards.pior_jogador).toEqual(['p4'])
  })

  it('premia o goleiro menos vazado', () => {
    const awards = computeRoundAwards(baseScenario(), 'r1')
    expect(awards.goleiro_menos_vazado).toEqual(['gk1'])
  })

  it('não inclui goleiros na disputa de jogador da rodada', () => {
    const snapshot = baseScenario()
    // Goleiro com muitas participações continua fora da premiação de linha.
    snapshot.events.push(makeEvent('m1', 'tA', 'gk1'), makeEvent('m1', 'tA', 'gk1'))
    snapshot.matches[0].score_a = 5

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual(['p1'])
    expect(awards.pior_jogador).not.toContain('gk1')
  })

  it('devolve todos os empatados', () => {
    const snapshot = baseScenario()
    // p3 passa a ter 3 participações, empatando com p1.
    snapshot.events.push(
      makeEvent('m1', 'tB', 'p3'),
      makeEvent('m1', 'tB', 'p4', 'p3'),
    )
    snapshot.matches[0].score_b = 3

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada.sort()).toEqual(['p1', 'p3'])
    // Com o placar empatado, os dois goleiros dividem o prêmio.
    snapshot.matches[0].score_a = 3
    expect(computeRoundAwards(snapshot, 'r1').goleiro_menos_vazado.sort()).toEqual(['gk1', 'gk2'])
  })

  it('não elege jogador da rodada quando ninguém participou de gols', () => {
    const snapshot = baseScenario()
    snapshot.events = []
    snapshot.matches[0].score_a = 0
    snapshot.matches[0].score_b = 0

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual([])
    expect(awards.pior_jogador.sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(awards.goleiro_menos_vazado.sort()).toEqual(['gk1', 'gk2'])
  })

  it('ignora quem foi inscrito mas não entrou em campo', () => {
    const snapshot = baseScenario()
    snapshot.players.push({ ...snapshot.players[0], id: 'p9', username: 'p9' })
    snapshot.roundPlayers.push({
      id: 'r1-p9',
      round_id: 'r1',
      player_id: 'p9',
      team_id: null,
    })

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).not.toContain('p9')
  })
})
