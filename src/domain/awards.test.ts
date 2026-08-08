import { describe, expect, it } from 'vitest'
import { computeRoundAwards, roundOutcome } from './awards'
import { baseScenario, makeEvent, makeRoundPlayer } from './testing'

/**
 * No cenário base o Time A (p1, p2, gk1) vence o Time B (p3, p4, gk2) por
 * 3 a 1. Os prêmios de linha são simétricos: o melhor sai de quem venceu, o
 * pior de quem perdeu.
 */
describe('computeRoundAwards', () => {
  it('elege o melhor entre os vencedores', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').jogador_rodada).toEqual(['p1'])
  })

  it('elege o pior entre os derrotados', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').pior_jogador).toEqual(['p4'])
  })

  it('premia o goleiro menos vazado', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').goleiro_menos_vazado).toEqual(['gk1'])
  })

  it('não deixa o time perdedor levar o prêmio de melhor', () => {
    const snapshot = baseScenario()
    // p3 marca duas vezes e passa p1 em participações, mas perdeu o jogo.
    snapshot.events.push(makeEvent('m1', 'tB', 'p3'), makeEvent('m1', 'tB', 'p3'))
    snapshot.matches[0].score_b = 3
    snapshot.matches[0].score_a = 4

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual(['p1'])
    expect(awards.pior_jogador).toEqual(['p4'])
  })

  it('não elege melhor jogador quando o vencedor não participou de gols', () => {
    const snapshot = baseScenario()
    // Time A vence só com gol contra: ninguém do time participou de gol.
    snapshot.events = [makeEvent('m1', 'tA', 'p3', null, true)]
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 0

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada).toEqual([])
  })

  it('devolve todos os empatados dentro de cada prêmio', () => {
    const snapshot = baseScenario()
    // p1 e p2 terminam com as mesmas participações no time vencedor.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1', 'p2'),
      makeEvent('m1', 'tA', 'p2', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p2'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 4

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada.sort()).toEqual(['p1', 'p2'])
  })

  it('ignora quem foi inscrito mas não entrou em campo', () => {
    const snapshot = baseScenario()
    snapshot.players.push({ ...snapshot.players[0], id: 'p9', username: 'p9' })
    snapshot.roundPlayers.push(makeRoundPlayer('r1', 'p9', null))

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).not.toContain('p9')
  })
})

describe('sem participação em gol não há o que premiar', () => {
  /**
   * A guarda é a mesma dos dois lados do placar. Sem ela a Bola Murcha ia
   * para o time perdedor inteiro numa derrota sem gols — um prêmio que cabe
   * em todo mundo não diz nada sobre ninguém.
   */
  it('derrota sem nenhum gol do time não elege bola murcha', () => {
    const snapshot = baseScenario()
    // Só o Time A marca: p3 e p4 terminam a partida em zero participações.
    snapshot.events = snapshot.events.filter((event) => event.team_id === 'tA')
    snapshot.matches[0].score_b = 0

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.pior_jogador).toEqual([])
    // O outro lado marcou, então o craque continua saindo normalmente.
    expect(awards.jogador_rodada).toEqual(['p1'])
  })

  it('empate em que ninguém participou de gol não elege nenhum dos dois', () => {
    const snapshot = baseScenario()
    // 1 a 1, os dois gols contra: ninguém pontua de nenhum lado.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p3', null, true),
      makeEvent('m1', 'tB', 'p1', null, true),
    ]
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 1

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual([])
    expect(awards.pior_jogador).toEqual([])
    // O paredão não depende de gol marcado, e continua saindo.
    expect(awards.goleiro_menos_vazado.sort()).toEqual(['gk1', 'gk2'])
  })

  it('basta um do lado ter participado para o prêmio voltar a existir', () => {
    const snapshot = baseScenario()
    // Time B perde de 3 a 1, e o gol dele foi de p3: p4 fica isolado no zero.
    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).toEqual(['p4'])
  })
})

describe('empate — os dois prêmios olham a rodada inteira', () => {
  function drawn() {
    const snapshot = baseScenario()
    // 2 a 2: p1 marca os dois do Time A, p3 os dois do Time B.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tB', 'p3'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 2
    snapshot.matches[0].score_b = 2
    return snapshot
  }

  it('busca o melhor nos dois times', () => {
    expect(computeRoundAwards(drawn(), 'r1').jogador_rodada.sort()).toEqual(['p1', 'p3'])
  })

  it('busca o pior nos dois times', () => {
    expect(computeRoundAwards(drawn(), 'r1').pior_jogador.sort()).toEqual(['p2', 'p4'])
  })

  it('premia os dois goleiros quando ambos sofreram o mesmo', () => {
    expect(computeRoundAwards(drawn(), 'r1').goleiro_menos_vazado.sort()).toEqual(['gk1', 'gk2'])
  })
})

describe('goleiro que joga na linha', () => {
  it('disputa os prêmios de linha quando a rodada o coloca na linha', () => {
    const snapshot = baseScenario()
    // gk1 vira jogador de linha nesta rodada e faz quatro gols, passando as
    // três participações de p1.
    const row = snapshot.roundPlayers.find((rp) => rp.player_id === 'gk1')!
    row.position = 'linha'
    for (let goal = 0; goal < 4; goal += 1) {
      snapshot.events.push(makeEvent('m1', 'tA', 'gk1'))
    }
    snapshot.matches[0].score_a = 7

    const awards = computeRoundAwards(snapshot, 'r1')
    expect(awards.jogador_rodada).toEqual(['gk1'])
    // E some da disputa de goleiro menos vazado.
    expect(awards.goleiro_menos_vazado).toEqual(['gk2'])
  })

  it('deixa o jogador de linha que foi para o gol disputar o prêmio de goleiro', () => {
    const snapshot = baseScenario()
    snapshot.roundPlayers.find((rp) => rp.player_id === 'gk1')!.position = 'linha'
    snapshot.roundPlayers.find((rp) => rp.player_id === 'p2')!.position = 'goleiro'

    const awards = computeRoundAwards(snapshot, 'r1')
    // O Time A sofreu 1 gol e o Time B sofreu 3: p2 leva.
    expect(awards.goleiro_menos_vazado).toEqual(['p2'])
    expect(awards.jogador_rodada).not.toContain('p2')
  })
})

describe('roundOutcome', () => {
  it('aponta vencedor e derrotado', () => {
    expect(roundOutcome(baseScenario(), 'r1')).toEqual({
      winner: 'tA',
      loser: 'tB',
      draw: false,
    })
  })

  it('marca empate quando os times terminam iguais', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].score_b = 3
    expect(roundOutcome(snapshot, 'r1')).toEqual({ winner: null, loser: null, draw: true })
  })

  it('ignora partidas ainda em andamento', () => {
    const snapshot = baseScenario()
    snapshot.matches[0].status = 'em_andamento'
    expect(roundOutcome(snapshot, 'r1').draw).toBe(false)
    expect(roundOutcome(snapshot, 'r1').winner).toBeNull()
  })
})
