import { describe, expect, it } from 'vitest'
import {
  liveRound,
  missingRoundDates,
  nextOccurrences,
  roundTitle,
  staleRoundIds,
  upcomingRound,
} from './schedule'
import { makeRound } from './testing'
import { DEFAULT_SETTINGS } from '../types'

describe('nextOccurrences', () => {
  it('inclui o próprio dia quando ele já é o dia da patota', () => {
    // 2026-08-07 é uma sexta-feira.
    expect(nextOccurrences(5, '2026-08-07', 3)).toEqual([
      '2026-08-07',
      '2026-08-14',
      '2026-08-21',
    ])
  })

  it('avança para o próximo dia da semana quando a data está no meio', () => {
    // 2026-08-10 é uma segunda; a próxima sexta é dia 14.
    expect(nextOccurrences(5, '2026-08-10', 2)).toEqual(['2026-08-14', '2026-08-21'])
  })

  it('atravessa a virada de mês e de ano', () => {
    expect(nextOccurrences(3, '2026-12-28', 2)).toEqual(['2026-12-30', '2027-01-06'])
  })

  it('devolve vazio quando não se pede nenhuma data', () => {
    expect(nextOccurrences(5, '2026-08-07', 0)).toEqual([])
  })
})

describe('missingRoundDates', () => {
  const settings = { ...DEFAULT_SETTINGS, weekday: 5, weeks_ahead: 4 }

  it('sugere todas as datas quando não existe nenhuma rodada', () => {
    expect(missingRoundDates(settings, [], '2026-08-07')).toEqual([
      '2026-08-07',
      '2026-08-14',
      '2026-08-21',
      '2026-08-28',
    ])
  })

  it('ignora as datas que já têm rodada criada', () => {
    const existing = [{ date: '2026-08-07' }, { date: '2026-08-21' }]
    expect(missingRoundDates(settings, existing, '2026-08-07')).toEqual([
      '2026-08-14',
      '2026-08-28',
    ])
  })

  it('não sugere nada quando tudo já está criado', () => {
    const existing = ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'].map((date) => ({
      date,
    }))
    expect(missingRoundDates(settings, existing, '2026-08-07')).toEqual([])
  })

  it('respeita a desativação da criação automática', () => {
    expect(missingRoundDates({ ...settings, weeks_ahead: 0 }, [], '2026-08-07')).toEqual([])
  })
})

describe('upcomingRound', () => {
  const rounds = [
    { date: '2026-08-07', status: 'encerrada' as const },
    { date: '2026-08-14', status: 'rascunho' as const },
    { date: '2026-08-21', status: 'rascunho' as const },
  ]

  it('devolve a rodada aberta mais próxima', () => {
    expect(upcomingRound(rounds, '2026-08-08')?.date).toBe('2026-08-14')
  })

  it('ignora rodadas já encerradas', () => {
    expect(upcomingRound(rounds, '2026-08-07')?.date).toBe('2026-08-14')
  })

  it('devolve nulo quando não há rodada futura', () => {
    expect(upcomingRound(rounds, '2026-09-01')).toBeNull()
  })
})

describe('roundTitle', () => {
  it('nomeia a rodada pela data', () => {
    expect(roundTitle('2026-08-07')).toBe('Partida de 07/08')
  })
})


describe('staleRoundIds', () => {
  // 2026-08-14 e 2026-08-21 são sextas; 2026-08-12 e 2026-08-19, quartas.
  const rounds = [
    makeRound('sexta-passada', { date: '2026-08-07', status: 'rascunho' }),
    makeRound('sexta-1', { date: '2026-08-14', status: 'rascunho' }),
    makeRound('sexta-2', { date: '2026-08-21', status: 'rascunho' }),
    makeRound('quarta-1', { date: '2026-08-12', status: 'rascunho' }),
  ]
  const base = {
    rounds,
    answered: new Set<string>(),
    previousWeekday: 5,
    nextWeekday: 3,
    todayISO: '2026-08-08',
  }

  it('recolhe as rodadas futuras do dia que deixou de ser o da patota', () => {
    expect(staleRoundIds(base).sort()).toEqual(['sexta-1', 'sexta-2'])
  })

  it('não mexe em nada quando o dia continua o mesmo', () => {
    expect(staleRoundIds({ ...base, nextWeekday: 5 })).toEqual([])
  })

  it('poupa a rodada que já recebeu resposta de presença', () => {
    expect(staleRoundIds({ ...base, answered: new Set(['sexta-1']) })).toEqual(['sexta-2'])
  })

  it('poupa a rodada que já saiu do rascunho', () => {
    const started = rounds.map((round) =>
      round.id === 'sexta-2' ? { ...round, status: 'em_andamento' as const } : round,
    )
    expect(staleRoundIds({ ...base, rounds: started })).toEqual(['sexta-1'])
  })

  it('não apaga o passado nem o dia de hoje', () => {
    // 2026-08-14 é a sexta de hoje neste cenário.
    expect(staleRoundIds({ ...base, todayISO: '2026-08-14' })).toEqual(['sexta-2'])
  })

  it('mantém as rodadas do dia novo', () => {
    expect(staleRoundIds(base)).not.toContain('quarta-1')
  })
})

describe('liveRound', () => {
  it('encontra a partida de ontem que ninguém encerrou', () => {
    const rounds = [
      makeRound('ontem', { date: '2026-08-07', status: 'em_andamento' }),
      makeRound('semana-que-vem', { date: '2026-08-14', status: 'rascunho' }),
    ]
    expect(liveRound(rounds, '2026-08-08')?.id).toBe('ontem')
    // E é ela que a tela inicial precisa mostrar, à frente do rascunho.
    expect(upcomingRound(rounds, '2026-08-08')?.id).toBe('semana-que-vem')
  })

  it('ignora a partida futura com os times já sorteados', () => {
    const rounds = [makeRound('proxima', { date: '2026-08-14', status: 'em_andamento' })]
    expect(liveRound(rounds, '2026-08-08')).toBeNull()
  })

  it('prefere a mais recente quando há mais de uma em aberto', () => {
    const rounds = [
      makeRound('velha', { date: '2026-07-31', status: 'em_andamento' }),
      makeRound('nova', { date: '2026-08-07', status: 'em_andamento' }),
    ]
    expect(liveRound(rounds, '2026-08-08')?.id).toBe('nova')
  })

  it('devolve nulo sem nenhuma partida em andamento', () => {
    expect(liveRound([makeRound('r1', { status: 'encerrada' })], '2026-08-08')).toBeNull()
  })
})
