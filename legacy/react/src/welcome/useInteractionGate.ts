import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

type InteractionGateOptions = {
  autoplay: boolean
  delayMs: number
  replayKey: number | string
}

/**
 * Mantém os botões inertes enquanto a abertura ainda passa por cima deles —
 * ninguém deve conseguir tocar num botão que ainda está escondido atrás da
 * máscara. Comparar a chave já concluída durante a renderização fecha a
 * brecha de um quadro que uma troca de `replayKey` deixaria antes de o efeito
 * conseguir reabrir a contagem.
 */
export function useInteractionGate({ autoplay, delayMs, replayKey }: InteractionGateOptions) {
  const reducedMotion = useReducedMotion()
  const shouldWait = autoplay && !reducedMotion
  const motionKey = `${typeof replayKey}:${String(replayKey)}`
  const gate = useMemo(
    () => ({ delayMs, motionKey, shouldWait }),
    [delayMs, motionKey, shouldWait],
  )
  const [completedGate, setCompletedGate] = useState<typeof gate | null>(null)

  useEffect(() => {
    if (!shouldWait) return
    const timeout = setTimeout(() => setCompletedGate(gate), delayMs)
    return () => clearTimeout(timeout)
  }, [delayMs, gate, shouldWait])

  return !shouldWait || completedGate === gate
}
