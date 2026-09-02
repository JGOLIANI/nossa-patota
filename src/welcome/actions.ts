import type { WelcomeActionId, WelcomeActionPressHandler } from './types'

/**
 * Devolve o que o botão faz, ou nada.
 *
 * O `undefined` é o ponto: sem quem ouvir a ação, `WelcomePressable` deixa o
 * botão inerte e fora da ordem de leitura, em vez de oferecer um toque que
 * não leva a lugar nenhum.
 */
export function resolveActionPress(
  actionId: WelcomeActionId,
  onActionPress: WelcomeActionPressHandler | undefined,
) {
  if (!onActionPress) return undefined
  return () => onActionPress(actionId)
}
