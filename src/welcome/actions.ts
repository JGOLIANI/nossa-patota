import type { WelcomeActionId, WelcomeActionPressHandler } from './types'

/**
 * Prefere a ação com nome e mantém o callback avulso funcionando para quem
 * já montava a tela do jeito antigo.
 */
export function resolveActionPress(
  actionId: WelcomeActionId,
  onActionPress: WelcomeActionPressHandler | undefined,
  legacyFallback?: () => void,
) {
  if (!onActionPress) return legacyFallback
  return () => onActionPress(actionId)
}
