import { describe, expect, it } from 'vitest'
import {
  canVote,
  computeRoundAwards,
  roundOutcome,
  tallyAward,
  votesByVoter,
  voterTurnout,
  votingDeadline,
  votingState,
} from './awards'
import { STAT_WEIGHT, VOTE_WEIGHT } from '../types'
import { baseScenario, makeEvent, makePlayer, makeRoundPlayer, makeVote } from './testing'

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
   * A guarda é a mesma dos dois lados do placar. Sem ela a Bagre da Rodada ia
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

/**
 * A urna: quem vota, até quando, e como o voto se mistura com a estatística.
 *
 * O cenário base é sempre o mesmo — Time A (p1, p2, gk1) 3 × 1 Time B (p3,
 * p4, gk2), com p1 em 3 participações e p2 em 2 —, então o que muda de um
 * teste para o outro é só a urna.
 */
describe('votação dos prêmios', () => {
  const opened = '2026-01-10T22:00:00.000Z'
  /** Duas horas depois do encerramento: dentro das 16 horas. */
  const during = new Date('2026-01-11T00:00:00.000Z')
  /** Vinte horas depois: a urna já fechou. */
  const after = new Date('2026-01-11T18:00:00.000Z')

  function closedScenario() {
    const snapshot = baseScenario()
    snapshot.rounds[0].closed_at = opened
    return snapshot
  }

  it('a urna só abre quando a partida é encerrada', () => {
    const snapshot = baseScenario()
    snapshot.rounds[0].status = 'em_andamento'
    snapshot.rounds[0].closed_at = null
    expect(votingState(snapshot.rounds[0], during)).toBe('nao-comecou')
  })

  it('fica aberta por 16 horas depois do encerramento', () => {
    const round = closedScenario().rounds[0]
    expect(votingDeadline(round)?.toISOString()).toBe('2026-01-11T14:00:00.000Z')
    expect(votingState(round, during)).toBe('aberta')
    expect(votingState(round, after)).toBe('encerrada')
  })

  it('a apuração fecha a urna antes do prazo', () => {
    const round = closedScenario().rounds[0]
    expect(votingState(round, during)).toBe('aberta')

    // É o que o administrador faz ao encerrar antes: apurar é encerrar.
    round.awards_settled_at = '2026-01-11T00:30:00.000Z'
    expect(votingState(round, during)).toBe('encerrada')
  })

  it('vota quem foi escalado, e só ele', () => {
    const snapshot = closedScenario()
    // Quem confirmou mas ficou fora dos times não entra na urna.
    snapshot.players.push(makePlayer('fora'))
    snapshot.roundPlayers.push(makeRoundPlayer('r1', 'fora', null))

    expect(canVote(snapshot, 'r1', 'p1')).toBe(true)
    expect(canVote(snapshot, 'r1', 'fora')).toBe(false)
    expect(canVote(snapshot, 'r1', 'ninguem')).toBe(false)
  })

  it('sem voto nenhum, decide a estatística — o critério antigo', () => {
    const snapshot = closedScenario()
    const tally = tallyAward(snapshot, 'r1', 'jogador_rodada')
    expect(tally.totalVotes).toBe(0)
    expect(tally.winners).toEqual(['p1'])
  })

  it('o voto vira a eleição contra a estatística', () => {
    const snapshot = closedScenario()
    // p1 lidera as participações (3 contra 2), mas a patota escolheu p2.
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p3', 'p2'),
      makeVote('r1', 'jogador_rodada', 'p4', 'p2'),
      makeVote('r1', 'jogador_rodada', 'gk1', 'p2'),
      makeVote('r1', 'jogador_rodada', 'gk2', 'p1'),
    ]
    const tally = tallyAward(snapshot, 'r1', 'jogador_rodada')
    expect(tally.totalVotes).toBe(4)
    expect(tally.winners).toEqual(['p2'])
  })

  it('a estatística ainda pesa: um voto isolado não derruba quem jogou muito mais', () => {
    const snapshot = closedScenario()
    // 1 voto para cada: a fatia empata, e a estatística desempata em p1.
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p3', 'p2'),
      makeVote('r1', 'jogador_rodada', 'p4', 'p1'),
    ]
    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winners).toEqual(['p1'])
  })

  it('mistura voto e estatística nos pesos combinados', () => {
    const snapshot = closedScenario()
    snapshot.votes = [makeVote('r1', 'jogador_rodada', 'p3', 'p2')]
    const entries = tallyAward(snapshot, 'r1', 'jogador_rodada').entries
    const p1 = entries.find((entry) => entry.playerId === 'p1')!
    const p2 = entries.find((entry) => entry.playerId === 'p2')!

    // p1: nenhum voto, melhor estatística. p2: todo o voto, pior estatística.
    expect(p1.voteShare).toBe(0)
    expect(p1.statScore).toBe(1)
    expect(p1.score).toBeCloseTo(STAT_WEIGHT, 10)
    expect(p2.voteShare).toBe(1)
    expect(p2.statScore).toBe(0)
    expect(p2.score).toBeCloseTo(VOTE_WEIGHT, 10)
    expect(p2.score).toBeGreaterThan(p1.score)
  })

  it('descarta voto em quem não disputa aquele prêmio', () => {
    const snapshot = closedScenario()
    // p3 é do time perdedor: não concorre a Craque, e o voto nele não conta.
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p1', 'p3'),
      makeVote('r1', 'jogador_rodada', 'p2', 'p3'),
    ]
    const tally = tallyAward(snapshot, 'r1', 'jogador_rodada')
    expect(tally.totalVotes).toBe(0)
    expect(tally.winners).toEqual(['p1'])
  })

  it('havendo voto, o prêmio sai mesmo sem ninguém ter participado de gol', () => {
    const snapshot = closedScenario()
    // Time A vence só com gol contra: ninguém do time somou participação.
    snapshot.events = [makeEvent('m1', 'tA', 'p3', null, true)]
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 0

    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winners).toEqual([])

    snapshot.votes = [makeVote('r1', 'jogador_rodada', 'p3', 'p2')]
    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winners).toEqual(['p2'])
  })

  it('conta quem já votou, sem contar o mesmo eleitor duas vezes', () => {
    const snapshot = closedScenario()
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p3', 'p1'),
      makeVote('r1', 'pior_jogador', 'p3', 'p4'),
      makeVote('r1', 'jogador_rodada', 'p4', 'p2'),
    ]
    expect(voterTurnout(snapshot, 'r1')).toEqual({ voted: 2, total: 6 })
  })

  it('lembra em quem cada um votou', () => {
    const snapshot = closedScenario()
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p3', 'p1'),
      makeVote('r1', 'pior_jogador', 'p3', 'p4'),
    ]
    expect(votesByVoter(snapshot, 'r1', 'p3')).toEqual({
      jogador_rodada: 'p1',
      pior_jogador: 'p4',
    })
    expect(votesByVoter(snapshot, 'r1', 'p4')).toEqual({})
  })
})
