import { describe, expect, it } from 'vitest'
import { missingRoundDates, nextOccurrences, roundTitle, upcomingRound } from './schedule'
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
    expect(roundTitle('2026-08-07')).toBe('Rodada de 07/08')
  })
})
