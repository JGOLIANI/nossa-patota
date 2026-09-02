/*
 * A mascote da patota: a bola do ícone do aplicativo com cara.
 *
 * É desenho próprio, em SVG e não em bitmap — assim escala sem borrar em
 * qualquer tela, funciona desligado da internet e não acrescenta um único
 * arquivo ao pacote. Os gomos ficam na borda de propósito: o meio da bola é
 * onde mora o rosto, e o par aberto/fechado precisa cair sobre um fundo
 * liso para a piscada não deixar rastro.
 *
 * Só o contorno acompanha o tema. Os gomos encostam na borda, então no tema
 * escuro eles se fundiriam com o fundo e a silhueta ficaria mordida: o anel
 * claro passando por cima deles é o que fecha a bola de novo.
 */
import { useId } from 'react'

type MascotProps = {
  /** A variante de olhos fechados, que a piscada revela por cima da aberta. */
  closed?: boolean
}

const BODY = '#FFFFFF'
const LINE = '#0C1829'
const OUTLINE = 'var(--color-ink)'

/** Gomos pentagonais, presos à silhueta da bola pelo recorte. */
const PANELS = [
  'M100.0 10.0L122.8 26.6L114.1 53.4L85.9 53.4L77.2 26.6Z',
  'M26.6 167.1L21.0 140.6L44.4 127.1L64.5 145.2L53.5 169.9Z',
  'M173.4 167.1L146.5 169.9L135.5 145.2L155.6 127.1L179.0 140.6Z',
]

const EYES = [74, 126]

export function Mascot({ closed = false }: MascotProps) {
  // O recorte é referenciado por id, e a tela desenha a bola quatro vezes:
  // sem um id único cada cópia herdaria o recorte da primeira.
  const clipId = `patota-ball-${useId()}`

  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="88" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="88" fill={BODY} />
      <g clipPath={`url(#${clipId})`} fill={LINE}>
        {PANELS.map((panel) => (
          <path key={panel} d={panel} />
        ))}
      </g>
      <circle cx="100" cy="100" r="88" fill="none" stroke={OUTLINE} strokeWidth="7" />

      {closed ? (
        <g fill="none" stroke={LINE} strokeWidth="7" strokeLinecap="round">
          {EYES.map((x) => (
            <path key={x} d={`M${x - 19} 88 Q${x} 105 ${x + 19} 88`} />
          ))}
        </g>
      ) : (
        EYES.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="92" rx="20" ry="22" fill={BODY} stroke={LINE} strokeWidth="6" />
            <circle cx={x} cy="95" r="9.5" fill={LINE} />
            <circle cx={x + 4} cy="89" r="3.4" fill={BODY} />
          </g>
        ))
      )}

      <path
        d="M76 128 Q100 152 124 128"
        fill="none"
        stroke={LINE}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}
