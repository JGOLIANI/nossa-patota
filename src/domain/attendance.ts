import { playerMap, roundEntries } from './selectors'
import type { Attendance, Player, RoundPlayer, Snapshot } from '../types'

/**
 * Confirmação de presença.
 *
 * O jogador responde sozinho ao convite da rodada. Quando as vagas acabam,
 * quem confirma entra na lista de espera; se alguém desiste, o primeiro da
 * espera assume a vaga automaticamente — a ordem é sempre a da confirmação,
 * nunca a da lista de jogadores.
 */

export interface AttendanceRow {
  player_id: string
  attendance: Attendance
  responded_at: string
}

export interface AttendanceChange {
  player_id: string
  attendance: Attendance
  /** Só é preenchido quando a resposta muda a posição na fila. */
  responded_at?: string
}

function byResponse(a: AttendanceRow, b: AttendanceRow): number {
  return a.responded_at.localeCompare(b.responded_at)
}

export interface AttendanceLists {
  confirmed: AttendanceRow[]
  waiting: AttendanceRow[]
  out: AttendanceRow[]
}

/** Separa as respostas em confirmados, lista de espera e desistências. */
export function attendanceLists(rows: AttendanceRow[]): AttendanceLists {
  return {
    confirmed: rows.filter((row) => row.attendance === 'confirmado').sort(byResponse),
    waiting: rows.filter((row) => row.attendance === 'espera').sort(byResponse),
    out: rows.filter((row) => row.attendance === 'fora').sort(byResponse),
  }
}

/** `max <= 0` significa rodada sem limite de vagas. */
function hasRoom(confirmedCount: number, max: number): boolean {
  return max <= 0 || confirmedCount < max
}

/**
 * Calcula o efeito de uma resposta, sem aplicá-la.
 *
 * Devolve todas as linhas que precisam mudar: a do próprio jogador e, quando
 * uma vaga é liberada, a de quem sobe da lista de espera.
 */
export function planResponse(
  rows: AttendanceRow[],
  playerId: string,
  wants: 'confirmado' | 'fora',
  max: number,
  now: string,
): AttendanceChange[] {
  const current = rows.find((row) => row.player_id === playerId)
  const others = rows.filter((row) => row.player_id !== playerId)
  const lists = attendanceLists(others)
  const changes: AttendanceChange[] = []

  if (wants === 'fora') {
    if (current?.attendance === 'fora') return []
    changes.push({ player_id: playerId, attendance: 'fora', responded_at: now })

    // A vaga só abre se quem saiu realmente ocupava uma.
    if (current?.attendance === 'confirmado' && lists.waiting.length > 0) {
      const promoted = lists.waiting[0]
      changes.push({ player_id: promoted.player_id, attendance: 'confirmado' })
    }
    return changes
  }

  if (current?.attendance === 'confirmado' || current?.attendance === 'espera') return []

  // Quem já respondeu antes volta para o fim da fila, não para o lugar antigo.
  const attendance: Attendance = hasRoom(lists.confirmed.length, max) ? 'confirmado' : 'espera'
  return [{ player_id: playerId, attendance, responded_at: now }]
}

/**
 * Reavalia a fila inteira depois de o administrador mexer nas vagas ou
 * remover alguém à mão. Promove da espera enquanto houver lugar.
 */
export function rebalanceWaitlist(rows: AttendanceRow[], max: number): AttendanceChange[] {
  if (max <= 0) {
    return rows
      .filter((row) => row.attendance === 'espera')
      .map((row) => ({ player_id: row.player_id, attendance: 'confirmado' as const }))
  }

  const lists = attendanceLists(rows)
  const free = max - lists.confirmed.length
  if (free <= 0) return []

  return lists.waiting
    .slice(0, free)
    .map((row) => ({ player_id: row.player_id, attendance: 'confirmado' as const }))
}

/** Jogadores que confirmaram presença numa rodada, na ordem da confirmação. */
export function confirmedPlayers(snapshot: Snapshot, roundId: string): Player[] {
  const byId = playerMap(snapshot)
  return roundEntries(snapshot, roundId)
    .filter((rp) => rp.attendance === 'confirmado')
    .sort((a, b) => a.responded_at.localeCompare(b.responded_at))
    .map((rp) => byId.get(rp.player_id))
    .filter((player) => player !== undefined)
}

/** Resposta de um jogador específico, ou `null` se ele ainda não respondeu. */
export function attendanceOf(
  rows: RoundPlayer[],
  roundId: string,
  playerId: string,
): Attendance | null {
  return (
    rows.find((row) => row.round_id === roundId && row.player_id === playerId)?.attendance ?? null
  )
}

/** Resumo curto do estado das confirmações, para cabeçalhos. */
export function attendanceSummary(
  rows: Array<{ attendance: string }>,
  maxPlayers: number,
): string {
  const confirmed = rows.filter((row) => row.attendance === 'confirmado').length
  const waiting = rows.filter((row) => row.attendance === 'espera').length
  const base = maxPlayers > 0 ? `${confirmed}/${maxPlayers} confirmados` : `${confirmed} confirmados`
  return waiting > 0 ? `${base} · ${waiting} na espera` : base
}
