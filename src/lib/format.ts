const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })

/** Datas vêm do banco como `YYYY-MM-DD`; interpretá-las como UTC evita virar o dia. */
function toDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`)
}

export function formatDate(value: string): string {
  if (!value) return '—'
  return dateFormatter.format(toDate(value))
}

export function formatWeekday(value: string): string {
  if (!value) return ''
  const label = weekdayFormatter.format(toDate(value))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function todayISO(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

export function decimal(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',')
}

/** `1 partida`, `3 partidas` — o plural sai errado com frequência demais. */
export function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : many}`
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
