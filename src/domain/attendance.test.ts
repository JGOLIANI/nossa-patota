import { describe, expect, it } from 'vitest'
import {
  attendanceLists,
  planResponse,
  rebalanceWaitlist,
  type AttendanceRow,
} from './attendance'
import type { Attendance } from '../types'

function row(playerId: string, attendance: Attendance, minute: number): AttendanceRow {
  return {
    player_id: playerId,
    attendance,
    responded_at: `2026-08-07T20:${String(minute).padStart(2, '0')}:00.000Z`,
  }
}

const NOW = '2026-08-07T21:00:00.000Z'

describe('attendanceLists', () => {
  it('ordena cada lista pela hora da resposta', () => {
    const rows = [row('c', 'confirmado', 3), row('a', 'confirmado', 1), row('b', 'espera', 2)]
    const lists = attendanceLists(rows)
    expect(lists.confirmed.map((r) => r.player_id)).toEqual(['a', 'c'])
    expect(lists.waiting.map((r) => r.player_id)).toEqual(['b'])
  })
})

describe('planResponse — confirmar', () => {
  it('confirma quando ainda há vaga', () => {
    const rows = [row('a', 'confirmado', 1)]
    expect(planResponse(rows, 'novo', 'confirmado', 4, NOW)).toEqual([
      { player_id: 'novo', attendance: 'confirmado', responded_at: NOW },
    ])
  })

  it('manda para a lista de espera quando as vagas acabaram', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'confirmado', 2)]
    expect(planResponse(rows, 'novo', 'confirmado', 2, NOW)).toEqual([
      { player_id: 'novo', attendance: 'espera', responded_at: NOW },
    ])
  })

  it('não limita vagas quando o máximo é zero', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'confirmado', 2)]
    expect(planResponse(rows, 'novo', 'confirmado', 0, NOW)[0].attendance).toBe('confirmado')
  })

  it('não faz nada se o jogador já confirmou', () => {
    const rows = [row('a', 'confirmado', 1)]
    expect(planResponse(rows, 'a', 'confirmado', 10, NOW)).toEqual([])
  })

  it('não tira ninguém da espera para reconfirmar', () => {
    const rows = [row('a', 'espera', 1)]
    expect(planResponse(rows, 'a', 'confirmado', 10, NOW)).toEqual([])
  })

  it('quem desistiu e volta entra no fim da fila', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'confirmado', 2), row('c', 'fora', 3)]
    expect(planResponse(rows, 'c', 'confirmado', 2, NOW)).toEqual([
      { player_id: 'c', attendance: 'espera', responded_at: NOW },
    ])
  })
})

describe('planResponse — desistir', () => {
  it('libera a vaga e promove o primeiro da espera', () => {
    const rows = [
      row('a', 'confirmado', 1),
      row('b', 'confirmado', 2),
      row('c', 'espera', 3),
      row('d', 'espera', 4),
    ]
    expect(planResponse(rows, 'a', 'fora', 2, NOW)).toEqual([
      { player_id: 'a', attendance: 'fora', responded_at: NOW },
      { player_id: 'c', attendance: 'confirmado' },
    ])
  })

  it('não promove ninguém quando quem sai estava na espera', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'espera', 2), row('c', 'espera', 3)]
    expect(planResponse(rows, 'b', 'fora', 1, NOW)).toEqual([
      { player_id: 'b', attendance: 'fora', responded_at: NOW },
    ])
  })

  it('não promove ninguém quando a espera está vazia', () => {
    const rows = [row('a', 'confirmado', 1)]
    expect(planResponse(rows, 'a', 'fora', 4, NOW)).toEqual([
      { player_id: 'a', attendance: 'fora', responded_at: NOW },
    ])
  })

  it('não faz nada se o jogador já estava fora', () => {
    const rows = [row('a', 'fora', 1)]
    expect(planResponse(rows, 'a', 'fora', 4, NOW)).toEqual([])
  })

  it('deixa desistir quem nunca tinha respondido', () => {
    expect(planResponse([], 'a', 'fora', 4, NOW)).toEqual([
      { player_id: 'a', attendance: 'fora', responded_at: NOW },
    ])
  })
})

describe('rebalanceWaitlist', () => {
  it('promove apenas até preencher as vagas livres', () => {
    const rows = [
      row('a', 'confirmado', 1),
      row('b', 'espera', 2),
      row('c', 'espera', 3),
      row('d', 'espera', 4),
    ]
    expect(rebalanceWaitlist(rows, 3)).toEqual([
      { player_id: 'b', attendance: 'confirmado' },
      { player_id: 'c', attendance: 'confirmado' },
    ])
  })

  it('esvazia a espera quando o limite de vagas é removido', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'espera', 2)]
    expect(rebalanceWaitlist(rows, 0)).toEqual([{ player_id: 'b', attendance: 'confirmado' }])
  })

  it('não promove ninguém com a rodada lotada', () => {
    const rows = [row('a', 'confirmado', 1), row('b', 'espera', 2)]
    expect(rebalanceWaitlist(rows, 1)).toEqual([])
  })
})
