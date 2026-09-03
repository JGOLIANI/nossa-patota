import { describe, expect, it } from 'vitest'
import {
  canVote,
  computeRoundAwards,
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
 * 3 a 1. Craque e Bagre concorrem entre todos os que jogaram — o placar não
 * decide mais quem pode levar cada um.
 */
describe('computeRoundAwards', () => {
  it('elege quem mais participou de gols', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').jogador_rodada).toBe('p1')
  })

  it('elege quem menos participou de gols', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').pior_jogador).toBe('p4')
  })

  it('premia o goleiro menos vazado', () => {
    expect(computeRoundAwards(baseScenario(), 'r1').goleiro_menos_vazado).toBe('gk1')
  })

  it('deixa o craque sair do time derrotado', () => {
    const snapshot = baseScenario()
    // p3 marca mais dois e passa p1: o Time B perdeu de 4 a 3, mas quem
    // carregou a partida foi ele.
    snapshot.events.push(makeEvent('m1', 'tB', 'p3'), makeEvent('m1', 'tB', 'p3'))
    snapshot.matches[0].score_b = 3
    snapshot.matches[0].score_a = 4

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada).toBe('p3')
  })

  it('deixa o bagre sair do time vencedor', () => {
    const snapshot = baseScenario()
    // p1 faz os três sozinho e o Time B ainda marca com p3 e p4: quem passou
    // a partida sem tocar em nada foi p2, do time que venceu.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tB', 'p3', 'p4'),
    ]

    expect(computeRoundAwards(snapshot, 'r1').pior_jogador).toBe('p2')
  })

  it('deixa o goleiro fora da conta de participações dos prêmios de linha', () => {
    const snapshot = baseScenario()
    // gk1 e gk2 terminam zerados em gols e assistências, como todo goleiro:
    // a estatística não fala deles, e o Bagre continua saindo na linha.
    const bagre = tallyAward(snapshot, 'r1', 'pior_jogador')
    expect(bagre.winner).toBe('p4')
    expect(bagre.entries.find((entry) => entry.playerId === 'gk1')!.statScore).toBe(0.5)
    expect(
      tallyAward(snapshot, 'r1', 'jogador_rodada').entries.find(
        (entry) => entry.playerId === 'gk1',
      )!.statScore,
    ).toBe(0.5)
  })

  it('não elege melhor jogador quando o vencedor não participou de gols', () => {
    const snapshot = baseScenario()
    // Time A vence só com gol contra: ninguém do time participou de gol.
    snapshot.events = [makeEvent('m1', 'tA', 'p3', null, true)]
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 0

    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada).toBeNull()
  })

  it('elege um só quando dois empatam nas participações', () => {
    const snapshot = baseScenario()
    // p1 e p2 terminam com as mesmas participações no time vencedor: dois
    // gols e uma assistência cada.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1', 'p2'),
      makeEvent('m1', 'tA', 'p2', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p2'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 4

    const winner = computeRoundAwards(snapshot, 'r1').jogador_rodada
    expect(['p1', 'p2']).toContain(winner)
    // E sempre o mesmo: a tela e o banco não podem discordar de quem levou.
    expect(computeRoundAwards(snapshot, 'r1').jogador_rodada).toBe(winner)
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
   * A guarda olha a partida inteira: premiar uma pelada em que ninguém tocou
   * em gol seria sortear um nome, e prêmio sorteado não diz nada de quem o
   * levou.
   */
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
    expect(awards.jogador_rodada).toBeNull()
    expect(awards.pior_jogador).toBeNull()
    // O paredão não depende de gol marcado, e continua saindo — e sai com um
    // nome só, porque o empate entre os dois goleiros é desfeito na cascata.
    expect(['gk1', 'gk2']).toContain(awards.goleiro_menos_vazado)
  })

  it('basta alguém ter participado para os prêmios voltarem a existir', () => {
    // No cenário base p1 lidera com três participações e p4 fica isolado no
    // zero: os dois prêmios saem.
    const awards = computeRoundAwards(baseScenario(), 'r1')
    expect(awards.jogador_rodada).toBe('p1')
    expect(awards.pior_jogador).toBe('p4')
  })
})

describe('empate no placar', () => {
  /**
   * O placar não separa mais nada: Craque e Bagre já olham a partida inteira
   * em qualquer resultado. O que o empate ainda decide é a disputa do
   * Paredão, e ela sai com um nome só.
   */
  it('elege um goleiro só quando ambos sofreram o mesmo', () => {
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

    expect(['gk1', 'gk2']).toContain(computeRoundAwards(snapshot, 'r1').goleiro_menos_vazado)
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
    expect(awards.jogador_rodada).toBe('gk1')
    // E some da disputa de goleiro menos vazado.
    expect(awards.goleiro_menos_vazado).toBe('gk2')
  })

  it('deixa o jogador de linha que foi para o gol disputar o prêmio de goleiro', () => {
    const snapshot = baseScenario()
    snapshot.roundPlayers.find((rp) => rp.player_id === 'gk1')!.position = 'linha'
    snapshot.roundPlayers.find((rp) => rp.player_id === 'p2')!.position = 'goleiro'

    const awards = computeRoundAwards(snapshot, 'r1')
    // O Time A sofreu 1 gol e o Time B sofreu 3: p2 leva.
    expect(awards.goleiro_menos_vazado).toBe('p2')
    expect(awards.jogador_rodada).not.toContain('p2')
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
    expect(tally.winner).toBe('p1')
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
    expect(tally.winner).toBe('p2')
  })

  it('a estatística ainda pesa: um voto isolado não derruba quem jogou muito mais', () => {
    const snapshot = closedScenario()
    // 1 voto para cada: a fatia empata, e a estatística desempata em p1.
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p3', 'p2'),
      makeVote('r1', 'jogador_rodada', 'p4', 'p1'),
    ]
    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBe('p1')
  })

  it('mistura voto e estatística nos pesos combinados', () => {
    const snapshot = closedScenario()
    snapshot.votes = [makeVote('r1', 'jogador_rodada', 'p3', 'p4')]
    const entries = tallyAward(snapshot, 'r1', 'jogador_rodada').entries
    const p1 = entries.find((entry) => entry.playerId === 'p1')!
    const p4 = entries.find((entry) => entry.playerId === 'p4')!

    // p1: nenhum voto, melhor estatística. p4: todo o voto, pior estatística.
    expect(p1.voteShare).toBe(0)
    expect(p1.statScore).toBe(1)
    expect(p1.score).toBeCloseTo(STAT_WEIGHT, 10)
    expect(p4.voteShare).toBe(1)
    expect(p4.statScore).toBe(0)
    expect(p4.score).toBeCloseTo(VOTE_WEIGHT, 10)
    expect(p4.score).toBeGreaterThan(p1.score)
  })

  it('descarta voto em quem não disputa aquele prêmio', () => {
    const snapshot = closedScenario()
    // "fora" confirmou presença mas não entrou em nenhum time: não concorre
    // a nada, e o voto nele não conta.
    snapshot.players.push(makePlayer('fora'))
    snapshot.roundPlayers.push(makeRoundPlayer('r1', 'fora', null))
    snapshot.votes = [
      makeVote('r1', 'jogador_rodada', 'p1', 'fora'),
      makeVote('r1', 'jogador_rodada', 'p2', 'fora'),
    ]
    const tally = tallyAward(snapshot, 'r1', 'jogador_rodada')
    expect(tally.totalVotes).toBe(0)
    expect(tally.winner).toBe('p1')
  })

  it('a patota também elege o goleiro, contra a estatística', () => {
    const snapshot = closedScenario()
    // gk1 sofreu 1 gol e gk2 sofreu 3, mas quem viu o jogo escolheu gk2 —
    // defesa não aparece no número de gols sofridos.
    snapshot.votes = [
      makeVote('r1', 'goleiro_menos_vazado', 'p1', 'gk2'),
      makeVote('r1', 'goleiro_menos_vazado', 'p2', 'gk2'),
      makeVote('r1', 'goleiro_menos_vazado', 'p3', 'gk2'),
    ]
    const tally = tallyAward(snapshot, 'r1', 'goleiro_menos_vazado')
    expect(tally.totalVotes).toBe(3)
    expect(tally.winner).toBe('gk2')
  })

  it('sem voto, o goleiro continua saindo pela estatística', () => {
    const tally = tallyAward(closedScenario(), 'r1', 'goleiro_menos_vazado')
    expect(tally.totalVotes).toBe(0)
    expect(tally.winner).toBe('gk1')
  })

  it('havendo voto, o prêmio sai mesmo sem ninguém ter participado de gol', () => {
    const snapshot = closedScenario()
    // Time A vence só com gol contra: ninguém do time somou participação.
    snapshot.events = [makeEvent('m1', 'tA', 'p3', null, true)]
    snapshot.matches[0].score_a = 1
    snapshot.matches[0].score_b = 0

    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBeNull()

    snapshot.votes = [makeVote('r1', 'jogador_rodada', 'p3', 'p2')]
    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBe('p2')
  })

  it('desempata pelo gol quando as participações empatam', () => {
    const snapshot = closedScenario()
    // Time A vence 2 a 1: p1 faz os dois, p2 dá as duas assistências. Os dois
    // terminam com duas participações, mas só um fez gol.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1', 'p2'),
      makeEvent('m1', 'tA', 'p1', 'p2'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 2
    snapshot.matches[0].score_b = 1

    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBe('p1')
  })

  it('empatado até no gol, leva quem menos ganhou o prêmio', () => {
    const snapshot = closedScenario()
    // 2 a 2, p1 e p3 com dois gols cada: empatam em tudo o que a partida diz.
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tB', 'p3'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 2
    snapshot.matches[0].score_b = 2
    // p1 já foi Craque duas vezes; p3, nenhuma.
    snapshot.awards = [
      { id: 'a1', round_id: 'r0', type: 'jogador_rodada', player_id: 'p1' },
      { id: 'a2', round_id: 'r00', type: 'jogador_rodada', player_id: 'p1' },
    ]

    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBe('p3')
  })

  it('a própria rodada não conta como histórico na hora de reapurar', () => {
    const snapshot = closedScenario()
    snapshot.events = [
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tA', 'p1'),
      makeEvent('m1', 'tB', 'p3'),
      makeEvent('m1', 'tB', 'p3'),
    ]
    snapshot.matches[0].score_a = 2
    snapshot.matches[0].score_b = 2

    const first = tallyAward(snapshot, 'r1', 'jogador_rodada').winner!
    // Reapurar depois de gravado não pode punir quem acabou de ganhar, senão
    // o vencedor trocaria a cada apuração.
    snapshot.awards = [
      { id: 'a1', round_id: 'r1', type: 'jogador_rodada', player_id: first },
    ]
    expect(tallyAward(snapshot, 'r1', 'jogador_rodada').winner).toBe(first)
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
