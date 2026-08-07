import { readableInk } from './color'
import { initials } from './format'

/**
 * Cartões de imagem para o grupo do WhatsApp.
 *
 * Tudo é desenhado em canvas, sem nenhuma biblioteca: o resultado é um PNG
 * pronto para o `navigator.share`, ou para download quando o aparelho não
 * suporta compartilhar arquivos.
 */

const WIDTH = 1080
const HEIGHT = 1350
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export interface LineupPlayer {
  name: string
  position: 'goleiro' | 'linha'
}

export interface LineupTeam {
  name: string
  color: string
  players: LineupPlayer[]
}

export interface CardHeader {
  title: string
  subtitle: string
}

function canvas(): { ctx: CanvasRenderingContext2D; el: HTMLCanvasElement } {
  const el = document.createElement('canvas')
  el.width = WIDTH
  el.height = HEIGHT
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('Este navegador não consegue gerar a imagem.')
  return { ctx, el }
}

function toBlob(el: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    el.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
      'image/png',
    )
  })
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}

/** Quebra o texto em até `maxLines` linhas; a última recebe reticências. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length === maxLines - 1) break
  }

  if (lines.length < maxLines && current) {
    lines.push(lines.length === maxLines - 1 ? fitText(ctx, current, maxWidth) : current)
  }

  const consumed = lines.join(' ')
  if (consumed.length < text.length && lines.length > 0) {
    lines[lines.length - 1] = fitText(
      ctx,
      `${lines[lines.length - 1]} ${text.slice(consumed.length).trim()}`,
      maxWidth,
    )
  }
  return lines
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawHeader(ctx: CanvasRenderingContext2D, header: CardHeader): void {
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, WIDTH, 190)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 58px ${FONT}`
  ctx.fillText(fitText(ctx, header.title, WIDTH - 120), 60, 92)

  ctx.fillStyle = '#93a2b5'
  ctx.font = `400 34px ${FONT}`
  ctx.fillText(fitText(ctx, header.subtitle, WIDTH - 120), 60, 146)
}

function drawFooter(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, HEIGHT - 90, WIDTH, 90)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#5f6d80'
  ctx.font = `600 30px ${FONT}`
  ctx.fillText('NOSSA PATOTA', WIDTH / 2, HEIGHT - 34)
}

/** Campo de futsal, com as marcações principais. */
function drawPitch(ctx: CanvasRenderingContext2D, top: number, height: number): void {
  ctx.fillStyle = '#0e7a45'
  ctx.fillRect(0, top, WIDTH, height)

  // Faixas alternadas, para dar textura de gramado.
  ctx.fillStyle = 'rgba(255,255,255,0.035)'
  const stripe = height / 8
  for (let index = 0; index < 8; index += 2) {
    ctx.fillRect(0, top + index * stripe, WIDTH, stripe)
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 4

  const margin = 40
  ctx.strokeRect(margin, top + margin, WIDTH - margin * 2, height - margin * 2)

  // Linha e círculo centrais.
  ctx.beginPath()
  ctx.moveTo(margin, top + height / 2)
  ctx.lineTo(WIDTH - margin, top + height / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(WIDTH / 2, top + height / 2, 110, 0, Math.PI * 2)
  ctx.stroke()

  // Áreas.
  const areaWidth = 380
  const areaHeight = 150
  ctx.strokeRect(WIDTH / 2 - areaWidth / 2, top + margin, areaWidth, areaHeight)
  ctx.strokeRect(
    WIDTH / 2 - areaWidth / 2,
    top + height - margin - areaHeight,
    areaWidth,
    areaHeight,
  )
}

/** Distribui os jogadores de linha em até três fileiras equilibradas. */
function rowsFor(count: number): number[] {
  if (count <= 0) return []
  if (count <= 3) return [count]
  if (count <= 6) return [Math.ceil(count / 2), Math.floor(count / 2)]
  const perRow = Math.ceil(count / 3)
  return [perRow, perRow, count - perRow * 2].filter((size) => size > 0)
}

function drawPlayerToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  color: string,
  isKeeper: boolean,
): void {
  const radius = 42

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (isKeeper) {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.fillStyle = readableInk(color)
  ctx.font = `700 32px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials(name), x, y + 1)
  ctx.textBaseline = 'alphabetic'

  // Nome em cartela escura, para ler sobre qualquer tom de verde.
  const label = name.split(/\s+/)[0]
  ctx.font = `600 26px ${FONT}`
  const width = ctx.measureText(label).width + 24
  ctx.fillStyle = 'rgba(8,16,26,0.72)'
  roundedRect(ctx, x - width / 2, y + radius + 12, width, 38, 19)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, x, y + radius + 38)
}

/**
 * Escalação no estilo dos jogos de videogame: o campo visto de cima, cada
 * time em um lado, os goleiros destacados com um anel branco.
 */
export async function drawLineupCard(
  header: CardHeader,
  teams: LineupTeam[],
): Promise<Blob> {
  const { ctx, el } = canvas()

  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawHeader(ctx, header)

  const pitchTop = 190
  const pitchHeight = HEIGHT - 190 - 90
  drawPitch(ctx, pitchTop, pitchHeight)

  const bandHeight = pitchHeight / teams.length

  teams.forEach((team, index) => {
    const bandTop = pitchTop + index * bandHeight
    // O primeiro time joga "para cima": o goleiro fica na borda externa.
    const mirrored = index % 2 === 1

    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(8,16,26,0.72)'
    const nameWidth = (() => {
      ctx.font = `700 30px ${FONT}`
      return ctx.measureText(team.name).width + 40
    })()
    roundedRect(ctx, 60, bandTop + 18, nameWidth, 46, 23)
    ctx.fill()
    ctx.fillStyle = team.color
    ctx.beginPath()
    ctx.arc(84, bandTop + 41, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 30px ${FONT}`
    ctx.fillText(team.name, 104, bandTop + 51)

    const keepers = team.players.filter((player) => player.position === 'goleiro')
    const line = team.players.filter((player) => player.position !== 'goleiro')

    const usableTop = bandTop + 96
    const usableHeight = bandHeight - 120
    const rows = rowsFor(line.length)
    const totalRows = rows.length + (keepers.length > 0 ? 1 : 0)
    const rowGap = usableHeight / Math.max(totalRows, 1)

    let cursor = 0
    const placeRow = (names: LineupPlayer[], rowIndex: number) => {
      const y = usableTop + rowGap * (rowIndex + 0.5)
      const slot = WIDTH / (names.length + 1)
      names.forEach((player, position) => {
        drawPlayerToken(
          ctx,
          slot * (position + 1),
          y,
          player.name,
          team.color,
          player.position === 'goleiro',
        )
      })
    }

    const sequence: LineupPlayer[][] = []
    let taken = 0
    for (const size of rows) {
      sequence.push(line.slice(taken, taken + size))
      taken += size
    }
    if (keepers.length > 0) {
      if (mirrored) sequence.push(keepers)
      else sequence.unshift(keepers)
    }

    for (const group of sequence) {
      placeRow(group, cursor)
      cursor += 1
    }
  })

  drawFooter(ctx)
  return toBlob(el)
}

export interface MatchLine {
  home: string
  away: string
  homeColor: string
  awayColor: string
  scoreHome: number
  scoreAway: number
}

export interface AwardLine {
  label: string
  names: string[]
}

/** Resumo da rodada: placares, destaques e artilharia do dia. */
export async function drawRoundCard(
  header: CardHeader,
  matches: MatchLine[],
  awards: AwardLine[],
  scorers: Array<{ name: string; goals: number }>,
): Promise<Blob> {
  const { ctx, el } = canvas()

  ctx.fillStyle = '#0f1720'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawHeader(ctx, header)

  let y = 250

  const section = (title: string) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#6ee7a8'
    ctx.font = `700 28px ${FONT}`
    ctx.fillText(title.toUpperCase(), 60, y)
    y += 46
  }

  if (matches.length > 0) {
    section('Resultados')
    for (const match of matches.slice(0, 6)) {
      ctx.fillStyle = '#1a2430'
      roundedRect(ctx, 60, y - 12, WIDTH - 120, 88, 20)
      ctx.fill()

      ctx.fillStyle = match.homeColor
      ctx.beginPath()
      ctx.arc(100, y + 32, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = match.awayColor
      ctx.beginPath()
      ctx.arc(WIDTH - 100, y + 32, 12, 0, Math.PI * 2)
      ctx.fill()

      ctx.font = `600 32px ${FONT}`
      ctx.fillStyle = '#e8edf4'
      ctx.textAlign = 'left'
      ctx.fillText(fitText(ctx, match.home, 300), 130, y + 44)
      ctx.textAlign = 'right'
      ctx.fillText(fitText(ctx, match.away, 300), WIDTH - 130, y + 44)

      ctx.textAlign = 'center'
      ctx.font = `700 42px ${FONT}`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`${match.scoreHome} – ${match.scoreAway}`, WIDTH / 2, y + 46)

      y += 104
    }
    y += 20
  }

  const visibleAwards = awards.filter((award) => award.names.length > 0)
  if (visibleAwards.length > 0) {
    section('Destaques')
    for (const award of visibleAwards) {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#93a2b5'
      ctx.font = `400 28px ${FONT}`
      ctx.fillText(award.label, 60, y)
      ctx.fillStyle = '#ffffff'
      ctx.font = `600 36px ${FONT}`
      const lines = wrapText(ctx, award.names.join(', '), WIDTH - 120, 2)
      lines.forEach((line, index) => ctx.fillText(line, 60, y + 44 + index * 44))
      y += 96 + (lines.length - 1) * 44
    }
    y += 12
  }

  if (scorers.length > 0 && y < HEIGHT - 260) {
    section('Artilharia da rodada')
    for (const scorer of scorers.slice(0, 5)) {
      if (y > HEIGHT - 150) break
      ctx.textAlign = 'left'
      ctx.fillStyle = '#e8edf4'
      ctx.font = `500 32px ${FONT}`
      ctx.fillText(fitText(ctx, scorer.name, WIDTH - 260), 60, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#6ee7a8'
      ctx.font = `700 32px ${FONT}`
      ctx.fillText(`${scorer.goals}`, WIDTH - 60, y)
      y += 54
    }
  }

  drawFooter(ctx)
  return toBlob(el)
}

/**
 * Compartilha a imagem. Onde o aparelho não suporta enviar arquivos —
 * a maioria dos navegadores de desktop — cai para download.
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  text: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (cause) {
      // Cancelar o menu de compartilhamento não é erro.
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
