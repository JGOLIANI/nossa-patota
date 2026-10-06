import { readableInk } from './color'
import { initials } from './format'

/**
 * Cartão de imagem do resultado, para o grupo do WhatsApp.
 *
 * Tudo é desenhado em canvas, sem nenhuma biblioteca: o resultado é um PNG
 * pronto para o `navigator.share`, ou para download quando o aparelho não
 * suporta compartilhar arquivos. A escalação não tem cartão: ela vai como
 * mensagem, e quem compartilha quer justamente o texto que dá para responder
 * no grupo.
 *
 * A régua aqui é a miniatura. No grupo a imagem chega com uns 200 pixels de
 * largura, e é nesse tamanho que ela precisa dizer a que veio — quem jogou
 * contra quem, quanto foi. Por isso o placar é enorme, os nomes vão em lista
 * e não espalhados por uma quadra, e cada cartão tem uma informação
 * dominante em vez de cinco de mesmo peso.
 *
 * As cores são fixas, e não lidas do tema: a imagem sai do aparelho de quem
 * compartilha e é vista por todo mundo — ela não pode mudar de cor porque
 * quem enviou estava no tema escuro.
 */

const WIDTH = 1080
const FONT = "'Nunito Variable', ui-rounded, system-ui, sans-serif"

const INK = '#101418'
const MUTED = '#5f6672'
const CARD = '#ffffff'
const CANVAS = '#f1f3f5'
const LINE = '#d7dbe0'
const LIFT = '#cdd2d9'
const PITCH = '#12833c'
const GOLD = '#8a6d00'

export interface CardHeader {
  title: string
  subtitle: string
}

/* ------------------------------------------------------------ desenho ----- */

function canvas(height: number): { ctx: CanvasRenderingContext2D; el: HTMLCanvasElement } {
  const el = document.createElement('canvas')
  el.width = WIDTH
  el.height = height
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

/**
 * O canvas desenha com a fonte que já estiver decodificada. Sem esta espera o
 * cartão sai na fonte de reserva — com outra largura e outro peso — e ninguém
 * descobre por quê.
 */
async function waitForFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load(`400 40px ${FONT}`),
      document.fonts.load(`700 40px ${FONT}`),
      document.fonts.load(`900 40px ${FONT}`),
    ])
  } catch {
    // Fonte indisponível não impede o cartão: ele sai na de reserva.
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1)
  }
  return `${result}…`
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

/** Superfície do padrão: borda cheia e o degrau sólido embaixo. */
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 28,
): void {
  ctx.fillStyle = LIFT
  roundedRect(ctx, x, y + 8, width, height, radius)
  ctx.fill()

  ctx.fillStyle = CARD
  roundedRect(ctx, x, y, width, height, radius)
  ctx.fill()

  ctx.strokeStyle = LINE
  ctx.lineWidth = 4
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, radius - 2)
  ctx.stroke()
}

/** Faixa verde do topo, com o nome da partida e quando ela foi. */
function drawHeader(ctx: CanvasRenderingContext2D, header: CardHeader, height: number): void {
  ctx.fillStyle = PITCH
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = `800 30px ${FONT}`
  ctx.fillText('NOSSA PATOTA', WIDTH / 2, 76)

  ctx.fillStyle = '#ffffff'
  ctx.font = `900 68px ${FONT}`
  ctx.fillText(fitText(ctx, header.title, WIDTH - 120), WIDTH / 2, 158)

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = `600 34px ${FONT}`
  ctx.fillText(fitText(ctx, header.subtitle, WIDTH - 120), WIDTH / 2, 210)
}

function drawFooter(ctx: CanvasRenderingContext2D, height: number, label: string): void {
  ctx.textAlign = 'center'
  ctx.fillStyle = MUTED
  ctx.font = `700 28px ${FONT}`
  ctx.fillText(fitText(ctx, label, WIDTH - 120), WIDTH / 2, height - 40)
}

/** Ficha redonda na cor do colete, com as iniciais do time no meio. */
function drawToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  name: string,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = readableInk(color)
  ctx.font = `800 ${Math.round(radius * 0.78)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials(name), x, y + 1)
  ctx.textBaseline = 'alphabetic'

  // O aro contrastante é o que separa a ficha do fundo quando o colete é
  // branco — e o que separa o colete preto do fundo escuro.
  ctx.strokeStyle = readableInk(color)
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, radius - 1.5, 0, Math.PI * 2)
  ctx.stroke()
}

/* ---------------------------------------------------------- resultado ----- */

const HEADER_HEIGHT = 250

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

/**
 * Resultado: o placar ocupando o cartão, e o resto embaixo.
 *
 * Quem abre o grupo quer saber quanto foi. O placar vai em 150 pixels porque
 * é a única coisa que precisa ser legível na miniatura; destaques e
 * artilharia são para quem abrir a imagem.
 */
export async function drawRoundCard(
  header: CardHeader,
  matches: MatchLine[],
  awards: AwardLine[],
  scorers: Array<{ name: string; goals: number }>,
  footer: string,
): Promise<Blob> {
  await waitForFont()

  const visibleAwards = awards.filter((award) => award.names.length > 0)
  const topScorers = scorers.slice(0, 5)
  const scoreHeight = 260
  const awardsHeight = visibleAwards.length > 0 ? 96 + visibleAwards.length * 92 : 0
  const scorersHeight = topScorers.length > 0 ? 96 + topScorers.length * 66 : 0
  const height = Math.max(
    1080,
    HEADER_HEIGHT + 40 + matches.length * (scoreHeight + 28) + awardsHeight + scorersHeight + 130,
  )

  const { ctx, el } = canvas(height)
  ctx.fillStyle = CANVAS
  ctx.fillRect(0, 0, WIDTH, height)
  drawHeader(ctx, header, HEADER_HEIGHT)

  let y = HEADER_HEIGHT + 40

  for (const match of matches) {
    panel(ctx, 48, y, WIDTH - 96, scoreHeight)

    const half = (WIDTH - 96) / 2
    const sides = [
      { name: match.home, color: match.homeColor, score: match.scoreHome, x: 48 + half / 2 },
      {
        name: match.away,
        color: match.awayColor,
        score: match.scoreAway,
        x: 48 + half + half / 2,
      },
    ]
    const winner = Math.max(match.scoreHome, match.scoreAway)
    const drawn = match.scoreHome === match.scoreAway

    for (const side of sides) {
      drawToken(ctx, side.x, y + 62, 26, side.name, side.color)

      ctx.textAlign = 'center'
      ctx.fillStyle = MUTED
      ctx.font = `700 30px ${FONT}`
      ctx.fillText(fitText(ctx, side.name, half - 60), side.x, y + 128)

      ctx.fillStyle = !drawn && side.score === winner ? PITCH : INK
      ctx.font = `900 116px ${FONT}`
      ctx.fillText(String(side.score), side.x, y + 226)
    }

    ctx.strokeStyle = LINE
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(WIDTH / 2, y + 40)
    ctx.lineTo(WIDTH / 2, y + scoreHeight - 40)
    ctx.stroke()

    y += scoreHeight + 28
  }

  const section = (title: string) => {
    ctx.textAlign = 'left'
    ctx.fillStyle = PITCH
    ctx.font = `800 28px ${FONT}`
    ctx.fillText(title.toUpperCase(), 60, y + 52)
    y += 80
  }

  if (visibleAwards.length > 0) {
    section('Destaques')
    for (const award of visibleAwards) {
      panel(ctx, 48, y, WIDTH - 96, 76, 22)
      ctx.textAlign = 'left'
      ctx.fillStyle = GOLD
      ctx.font = `800 24px ${FONT}`
      ctx.fillText(award.label.toUpperCase(), 76, y + 32)
      ctx.fillStyle = INK
      ctx.font = `800 34px ${FONT}`
      ctx.fillText(fitText(ctx, award.names.join(', '), WIDTH - 200), 76, y + 64)
      y += 92
    }
    y += 4
  }

  if (topScorers.length > 0) {
    section('Artilharia')
    for (const scorer of topScorers) {
      ctx.textAlign = 'left'
      ctx.fillStyle = INK
      ctx.font = `700 34px ${FONT}`
      ctx.fillText(fitText(ctx, scorer.name, WIDTH - 220), 60, y + 40)

      ctx.textAlign = 'right'
      ctx.fillStyle = PITCH
      ctx.font = `900 34px ${FONT}`
      ctx.fillText(String(scorer.goals), WIDTH - 60, y + 40)
      y += 66
    }
  }

  drawFooter(ctx, height, footer)
  return toBlob(el)
}

/**
 * Compartilha só a mensagem. Onde o aparelho não tem menu de compartilhamento
 * — a maioria dos navegadores de desktop — copia para a área de transferência,
 * que é o passo seguinte de quem ia colar no grupo de qualquer jeito.
 */
export async function shareText(text: string): Promise<'shared' | 'copied'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (cause) {
      // Cancelar o menu de compartilhamento não é erro.
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'shared'
    }
  }

  await copyToClipboard(text)
  return 'copied'
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fora de contexto seguro não existe área de transferência moderna; o
    // caminho antigo, pelo campo escondido, ainda funciona nesses casos.
  }

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  if (!copied) throw new Error('Não foi possível copiar a mensagem.')
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
