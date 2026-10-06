import { useId } from 'react'

/*
 * O ícone do aplicativo: o mesmo que fica na tela de início do aparelho e no
 * alto do formulário de entrar.
 *
 * É `public/favicon.svg` na forma de componente. A abertura precisa dele em
 * vetor — o encolher passa por escalas grandes, e um bitmap chegaria borrado
 * no caminho —, mas o arquivo continua sendo a fonte que o navegador carrega:
 * se um mudar, o outro precisa mudar junto.
 */
export function AppIcon() {
  // O gradiente é referenciado por id, e a tela desenha o ícone duas vezes:
  // sem um id único a segunda cópia herdaria o da primeira.
  const gradient = `patota-icone-${useId()}`

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradient})`} />
      <circle cx="32" cy="32" r="20" fill="#ffffff" />
      <path d="M32 24.6 38 29l-2.3 7h-7.4L26 29l6-4.4Z" fill="#0c1829" />
      <g fill="none" stroke="#0c1829" strokeWidth="2.4" strokeLinecap="round">
        <path d="M32 24.6V16M38 29l7.6-2.6M35.7 36l4.7 6.4M28.3 36l-4.7 6.4M26 29l-7.6-2.6" />
      </g>
    </svg>
  )
}
