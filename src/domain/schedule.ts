import type { PatotaSettings, Round } from '../types'

/**
 * Agenda da patota.
 *
 * A rodada de futsal é um compromisso fixo — toda sexta às 20h na mesma
 * quadra. Em vez de o administrador criar uma rodada por semana, ele
 * descreve o compromisso uma vez e o sistema mantém as próximas sempre
 * criadas, prontas para receber confirmação de presença.
 */

/** Datas são tratadas ao meio-dia local, o que evita virar o dia por fuso. */
function parseISO(date: string): Date {
  return new Date(`${date.slice(0, 10)}T12:00:00`)
}

function toISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * As próximas `count` datas que caem no dia da semana informado, a partir de
 * `fromISO` (inclusive, quando `fromISO` já é o dia certo).
 */
export function nextOccurrences(weekday: number, fromISO: string, count: number): string[] {
  if (count <= 0) return []
  const target = ((Math.trunc(weekday) % 7) + 7) % 7
  const start = parseISO(fromISO)
  const first = new Date(start)
  first.setDate(start.getDate() + ((target - start.getDay() + 7) % 7))

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first)
    date.setDate(first.getDate() + index * 7)
    return toISO(date)
  })
}

/**
 * Quais rodadas ainda faltam criar para cobrir as próximas semanas.
 * Devolve apenas as datas que ainda não existem, então pode ser chamada
 * quantas vezes for preciso sem duplicar nada.
 */
export function missingRoundDates(
  settings: PatotaSettings,
  rounds: Array<Pick<Round, 'date'>>,
  todayISO: string,
): string[] {
  if (settings.weeks_ahead <= 0) return []
  const existing = new Set(rounds.map((round) => round.date.slice(0, 10)))
  return nextOccurrences(settings.weekday, todayISO, settings.weeks_ahead).filter(
    (date) => !existing.has(date),
  )
}

/** A próxima rodada a acontecer: a mais antiga que ainda não foi encerrada. */
export function upcomingRound<T extends Pick<Round, 'date' | 'status'>>(
  rounds: T[],
  todayISO: string,
): T | null {
  return (
    [...rounds]
      .filter((round) => round.status !== 'encerrada' && round.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}

/** Título padrão de uma rodada, derivado da data. */
export function roundTitle(dateISO: string): string {
  const [, month, day] = dateISO.slice(0, 10).split('-')
  return `Partida de ${day}/${month}`
}
