import { useState, type CSSProperties, type ReactNode } from 'react'

type WelcomePressableProps = {
  label: string
  children: ReactNode
  disabled?: boolean
  onPress?: () => void
  style: CSSProperties
}

/**
 * O botão da tela de boas-vindas.
 *
 * Enquanto a abertura ainda cobre a tela ele fica inerte e sai da ordem de
 * leitura: um botão que ninguém vê também não deve ser anunciado nem receber
 * o foco do teclado. Ao toque ele apaga um pouco, que é o retorno da
 * referência.
 */
export function WelcomePressable({
  label,
  children,
  disabled,
  onPress,
  style,
}: WelcomePressableProps) {
  const [pressed, setPressed] = useState(false)
  const inert = disabled || !onPress

  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={inert || undefined}
      disabled={inert}
      tabIndex={inert ? -1 : undefined}
      onClick={inert ? undefined : onPress}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onBlur={() => setPressed(false)}
      style={{
        appearance: 'none',
        border: 'none',
        margin: 0,
        padding: 0,
        cursor: inert ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed && !inert ? 0.78 : 1,
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
