/**
 * Cor de texto legível sobre a cor de um time.
 *
 * As cores dos times são escolhidas pelo administrador, então não dá para
 * fixar o texto em branco: um time amarelo precisa de texto escuro.
 */
export function readableInk(background: string): string {
  const hex = background.replace('#', '')
  if (hex.length !== 6) return '#ffffff'

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  return luminance > 0.45 ? '#0d1117' : '#ffffff'
}
