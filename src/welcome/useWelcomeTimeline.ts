import { useEffect, useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * `hold` congela no primeiro quadro (a abertura existe, mas ainda espera
 * algo), `play` corre a abertura e `end` monta a tela já pronta.
 */
export type TimelineMode = 'hold' | 'play' | 'end'

/**
 * O relógio da abertura.
 *
 * A referência anima um valor de 0 até a duração total e deixa cada peça
 * consultar esse relógio. Aqui é a mesma ideia com `requestAnimationFrame`:
 * o tempo corre fora do React e o quadro é escrito direto no elemento, então
 * a abertura não custa uma re-renderização por quadro — e as marcações do
 * clipe original continuam sendo lidas em milissegundos.
 */
export function useWelcomeTimeline(
  durationMs: number,
  mode: TimelineMode,
  replayKey: number | string,
  onFrame: (timeMs: number) => void,
) {
  const reducedMotion = useReducedMotion()
  const frame = useRef(onFrame)

  useEffect(() => {
    frame.current = onFrame
  })

  // `useLayoutEffect` porque o primeiro quadro precisa estar escrito antes da
  // pintura: com o efeito comum a tela pisca no estado final antes de voltar
  // para o começo da abertura.
  useLayoutEffect(() => {
    if (mode === 'hold') {
      frame.current(0)
      return
    }
    if (mode === 'end' || reducedMotion) {
      frame.current(durationMs)
      return
    }

    let raf = 0
    // `null` e não `0`: um primeiro quadro com carimbo zero reiniciaria a
    // contagem a cada volta, e a abertura ficaria parada no começo.
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const time = Math.min(durationMs, now - start)
      frame.current(time)
      if (time < durationMs) raf = requestAnimationFrame(tick)
    }

    frame.current(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, mode, reducedMotion, replayKey])
}
