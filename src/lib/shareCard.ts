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
const HEIGHT = 1440
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export interface LineupPlayer {
  name: string
  position: 'goleiro' | 'linha'
  photoUrl?: string | null
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

/** Posições de futsal, em coordenadas relativas à metade do time. */
const SLOTS = {
  goleiro: { x: 0.5, y: 0.04 },
  fixo: { x: 0.5, y: 0.32 },
  alaEsquerda: { x: 0.19, y: 0.6 },
  alaDireita: { x: 0.81, y: 0.6 },
  pivo: { x: 0.5, y: 0.88 },
} as const

/**
 * Espaço mínimo entre duas fileiras: o token de cima, sua placa de nome e o
 * token de baixo. É este número que dita o tamanho da ficha e a altura do
 * cartão — sem ele os nomes desaparecem atrás do jogador seguinte.
 */
function rowPitch(radius: number): number {
  return radius * 2 + 8 + nameplateHeight(radius)
}

function nameplateHeight(radius: number): number {
  return nameplateFont(radius) + 14
}

function nameplateFont(radius: number): number {
  return Math.max(19, Math.round(radius * 0.5))
}

type SlotName = keyof typeof SLOTS

/**
 * Quais posições entram em campo conforme o tamanho do time.
 *
 * O futsal joga com cinco, então a escalação completa é goleiro, fixo, dois
 * alas e pivô. Com menos gente, tiram-se as posições de fora para dentro.
 */
const FORMATIONS: Record<number, SlotName[]> = {
  1: ['goleiro'],
  2: ['goleiro', 'pivo'],
  3: ['goleiro', 'alaEsquerda', 'alaDireita'],
  4: ['goleiro', 'fixo', 'alaEsquerda', 'alaDireita'],
  5: ['goleiro', 'fixo', 'alaEsquerda', 'alaDireita', 'pivo'],
}

const COURT_PLAYERS = 5

/** Carrega a foto do jogador; qualquer falha vira `null` e cai nas iniciais. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    // Sem CORS a imagem "suja" o canvas e o PNG não pode ser gerado. Se o
    // servidor não permitir, o carregamento falha e usamos as iniciais.
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

async function loadPhotos(teams: LineupTeam[]): Promise<Map<string, HTMLImageElement>> {
  const urls = new Set<string>()
  for (const team of teams) {
    for (const player of team.players) {
      if (player.photoUrl) urls.add(player.photoUrl)
    }
  }

  const loaded = await Promise.all(
    [...urls].map(async (url) => [url, await loadImage(url)] as const),
  )

  const map = new Map<string, HTMLImageElement>()
  for (const [url, image] of loaded) {
    if (image) map.set(url, image)
  }
  return map
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Quadra de futsal: piso de madeira, meia-lua nas áreas e círculo central. */
function drawCourt(ctx: CanvasRenderingContext2D, court: Rect): void {
  const { x, y, width, height } = court

  ctx.fillStyle = '#b8793f'
  ctx.fillRect(x, y, width, height)

  // Tábuas do piso.
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'
  ctx.lineWidth = 2
  for (let plank = x + 34; plank < x + width; plank += 34) {
    ctx.beginPath()
    ctx.moveTo(plank, y)
    ctx.lineTo(plank, y + height)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = 5

  const pad = 26
  const left = x + pad
  const right = x + width - pad
  const top = y + pad
  const bottom = y + height - pad
  const middle = y + height / 2

  ctx.strokeRect(left, top, right - left, bottom - top)

  ctx.beginPath()
  ctx.moveTo(left, middle)
  ctx.lineTo(right, middle)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x + width / 2, middle, 78, 0, Math.PI * 2)
  ctx.stroke()

  // Meia-lua das áreas e a pequena baliza, em cada extremidade.
  const areaRadius = 132
  const goalWidth = 150

  ctx.beginPath()
  ctx.arc(x + width / 2, top, areaRadius, 0, Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + width / 2, bottom, areaRadius, Math.PI, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(x + width / 2 - goalWidth / 2, top)
  ctx.lineTo(x + width / 2 + goalWidth / 2, top)
  ctx.moveTo(x + width / 2 - goalWidth / 2, bottom)
  ctx.lineTo(x + width / 2 + goalWidth / 2, bottom)
  ctx.stroke()

  // Marca do pênalti.
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  for (const spot of [top + 78, bottom - 78]) {
    ctx.beginPath()
    ctx.arc(x + width / 2, spot, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Ficha do jogador: foto (ou iniciais), anel na cor do time e o nome. */
function drawPlayerToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  player: LineupPlayer,
  color: string,
  photos: Map<string, HTMLImageElement>,
  radius: number,
  /** No time de baixo o nome vai acima da ficha, senão sai da quadra. */
  plateAbove: boolean,
): void {
  const photo = player.photoUrl ? photos.get(player.photoUrl) : undefined

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (photo) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, radius - 5, 0, Math.PI * 2)
    ctx.clip()
    // Recorte "cover": a foto preenche o círculo sem distorcer.
    const side = Math.min(photo.width, photo.height)
    ctx.drawImage(
      photo,
      (photo.width - side) / 2,
      (photo.height - side) / 2,
      side,
      side,
      x - radius + 5,
      y - radius + 5,
      (radius - 5) * 2,
      (radius - 5) * 2,
    )
    ctx.restore()
  } else {
    ctx.fillStyle = readableInk(color)
    ctx.font = `700 ${Math.round(radius * 0.72)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials(player.name), x, y + 1)
    ctx.textBaseline = 'alphabetic'
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(x, y, radius - 2, 0, Math.PI * 2)
  ctx.stroke()

  if (player.position === 'goleiro') {
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, radius + 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  const label = player.name.split(/\s+/)[0]
  const fontSize = nameplateFont(radius)
  const height = nameplateHeight(radius)
  ctx.font = `600 ${fontSize}px ${FONT}`
  ctx.textAlign = 'center'
  const width = ctx.measureText(label).width + 22
  const top = plateAbove ? y - radius - 8 - height : y + radius + 8

  ctx.fillStyle = 'rgba(8,16,26,0.78)'
  roundedRect(ctx, x - width / 2, top, width, height, height / 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, x, top + fontSize + 4)
}

/** Banco de reservas: a coluna ao lado da quadra, um jogador por linha. */
function drawBench(
  ctx: CanvasRenderingContext2D,
  strip: Rect,
  team: LineupTeam,
  substitutes: LineupPlayer[],
  photos: Map<string, HTMLImageElement>,
): void {
  if (substitutes.length === 0) return

  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  roundedRect(ctx, strip.x + 8, strip.y, strip.width - 16, strip.height, 18)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = team.color
  ctx.font = `700 20px ${FONT}`
  ctx.fillText('BANCO', strip.x + strip.width / 2, strip.y + 34)

  const radius = 30
  const available = strip.height - 60
  const step = Math.min(96, available / substitutes.length)
  const startY = strip.y + 58 + Math.min(step, 96) / 2

  ctx.font = `500 18px ${FONT}`
  substitutes.forEach((player, index) => {
    const centerY = startY + index * step
    if (centerY + radius > strip.y + strip.height) return

    const photo = player.photoUrl ? photos.get(player.photoUrl) : undefined
    const centerX = strip.x + strip.width / 2

    ctx.fillStyle = team.color
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fill()

    if (photo) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 3, 0, Math.PI * 2)
      ctx.clip()
      const side = Math.min(photo.width, photo.height)
      ctx.drawImage(
        photo,
        (photo.width - side) / 2,
        (photo.height - side) / 2,
        side,
        side,
        centerX - radius + 3,
        centerY - radius + 3,
        (radius - 3) * 2,
        (radius - 3) * 2,
      )
      ctx.restore()
    } else {
      ctx.fillStyle = readableInk(team.color)
      ctx.font = `700 22px ${FONT}`
      ctx.textBaseline = 'middle'
      ctx.fillText(initials(player.name), centerX, centerY + 1)
      ctx.textBaseline = 'alphabetic'
    }

    ctx.fillStyle = '#c9d4e2'
    ctx.font = `500 18px ${FONT}`
    ctx.fillText(
      fitText(ctx, player.name.split(/\s+/)[0], strip.width - 20),
      centerX,
      centerY + radius + 22,
    )
  })
}

/** Separa quem começa em quadra de quem fica no banco. */
function splitSquad(players: LineupPlayer[]): {
  starters: LineupPlayer[]
  substitutes: LineupPlayer[]
} {
  const keepers = players.filter((player) => player.position === 'goleiro')
  const line = players.filter((player) => player.position !== 'goleiro')

  const starters = [...keepers.slice(0, 1), ...line].slice(0, COURT_PLAYERS)
  const chosen = new Set(starters)
  return { starters, substitutes: players.filter((player) => !chosen.has(player)) }
}

/**
 * Escalação em quadra de futsal.
 *
 * Cada time ocupa uma metade, com os cinco titulares nas posições reais do
 * futsal — goleiro, fixo, alas e pivô. Quem passa disso vai para o banco, na
 * lateral da quadra, como acontece no jogo de verdade.
 */
export async function drawLineupCard(
  header: CardHeader,
  teams: LineupTeam[],
): Promise<Blob> {
  const photos = await loadPhotos(teams)
  const { ctx, el } = canvas()

  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  drawHeader(ctx, header)

  const squads = teams.map((team) => ({ team, ...splitSquad(team.players) }))
  const hasBench = squads.some((squad) => squad.substitutes.length > 0)
  const benchWidth = hasBench ? 152 : 0

  const court: Rect = {
    x: benchWidth,
    y: 190,
    width: WIDTH - benchWidth * 2,
    height: HEIGHT - 190 - 90,
  }
  drawCourt(ctx, court)

  const bandHeight = court.height / Math.max(squads.length, 1)

  // A ficha encolhe até as quatro fileiras caberem na metade do time.
  const rows = 4
  let tokenRadius = squads.length > 2 ? 34 : 42
  while (tokenRadius > 24 && rowPitch(tokenRadius) * (rows - 1) + rowPitch(tokenRadius) > bandHeight) {
    tokenRadius -= 2
  }

  squads.forEach(({ team, starters, substitutes }, index) => {
    const bandTop = court.y + index * bandHeight
    // O primeiro time ataca para baixo; o segundo, espelhado, para cima.
    const mirrored = index % 2 === 1

    // Etiqueta do time, encostada na linha de fundo daquele lado.
    ctx.textAlign = 'left'
    ctx.font = `700 28px ${FONT}`
    const labelWidth = ctx.measureText(team.name).width + 62
    const labelY = mirrored ? bandTop + bandHeight - 58 : bandTop + 14
    ctx.fillStyle = 'rgba(8,16,26,0.78)'
    roundedRect(ctx, court.x + 34, labelY, labelWidth, 44, 22)
    ctx.fill()
    ctx.fillStyle = team.color
    ctx.beginPath()
    ctx.arc(court.x + 58, labelY + 22, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(team.name, court.x + 78, labelY + 31)

    const formation = FORMATIONS[starters.length] ?? FORMATIONS[COURT_PLAYERS]
    const usableTop = bandTop + 48
    const usableHeight = bandHeight - 96

    starters.forEach((player, slotIndex) => {
      const slot = SLOTS[formation[slotIndex] ?? 'pivo']
      const depth = mirrored ? 1 - slot.y : slot.y
      const x = court.x + court.width * (mirrored ? 1 - slot.x : slot.x)
      const y = usableTop + usableHeight * depth
      drawPlayerToken(ctx, x, y, player, team.color, photos, tokenRadius, mirrored)
    })

    if (benchWidth > 0) {
      drawBench(
        ctx,
        {
          x: mirrored ? WIDTH - benchWidth : 0,
          y: court.y + 10,
          width: benchWidth,
          height: court.height - 20,
        },
        team,
        substitutes,
        photos,
      )
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

/** Resumo da partida: placares, destaques e artilharia do dia. */
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
    section('Artilharia da partida')
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
