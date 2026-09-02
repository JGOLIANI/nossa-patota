import type { CSSProperties } from 'react'

/**
 * Cor de texto legível sobre a cor de um time.
 *
 * As cores dos times são escolhidas pelo administrador, então não dá para
 * fixar o texto em branco: um time amarelo precisa de texto escuro.
 */
export function readableInk(background: string): string {
  const rgb = toRgb(background)
  if (!rgb) return '#ffffff'

  const channels = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return luminance > 0.45 ? '#0d1117' : '#ffffff'
}

/** Os três canais de um `#rrggbb`, ou nada se não for um. */
function toRgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/**
 * Bolinhas do teclado de emoji, com a cor aproximada de cada uma.
 *
 * Não há uma para cada colete possível, então o time cai na mais parecida.
 * São nove círculos bem separados no espaço de cor, e as cores de colete que
 * o aplicativo oferece caem em cima de uma delas.
 */
const CIRCLES: Array<{ emoji: string; rgb: [number, number, number] }> = [
  { emoji: '⚫', rgb: [0, 0, 0] },
  { emoji: '⚪', rgb: [255, 255, 255] },
  { emoji: '🔴', rgb: [220, 60, 60] },
  { emoji: '🟠', rgb: [240, 140, 40] },
  { emoji: '🟡', rgb: [240, 200, 40] },
  { emoji: '🟢', rgb: [60, 180, 80] },
  { emoji: '🔵', rgb: [60, 130, 230] },
  { emoji: '🟣', rgb: [160, 90, 220] },
  { emoji: '🟤', rgb: [130, 80, 45] },
]

/**
 * O colete do time escrito em texto.
 *
 * Na mensagem do grupo não há como pintar o nome do time, e "Time Preto" e
 * "Time Branco" só se distinguem pela leitura. A bolinha devolve num caractere
 * o que a tela mostra com cor. Cor ilegível não vira bolinha errada: vira
 * nenhuma.
 */
export function teamEmoji(color: string): string {
  const rgb = toRgb(color)
  if (!rgb) return ''

  let nearest = CIRCLES[0]
  let best = Infinity
  for (const circle of CIRCLES) {
    const distance = circle.rgb.reduce((sum, value, index) => sum + (value - rgb[index]) ** 2, 0)
    if (distance < best) {
      best = distance
      nearest = circle
    }
  }
  return nearest.emoji
}

/**
 * Cor de colete pintada com um aro que sempre a delimita.
 *
 * O aro não sai da paleta da interface: sai da própria cor do time, pela
 * mesma regra que escolhe a cor do texto sobre ela. Assim o colete preto
 * ganha um aro claro e o branco um aro escuro, e nenhum dos dois depende da
 * superfície que está atrás — que muda com o tema, e é onde um aro cinza fixo
 * falhava: preto sobre o fundo escuro e branco sobre o cartão claro sumiam.
 */
export function teamSurface(color?: string): CSSProperties {
  if (!color) return {}
  return { backgroundColor: color, boxShadow: `0 0 0 1px ${readableInk(color)}` }
}
