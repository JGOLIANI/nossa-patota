/**
 * Contrato da tela de boas-vindas.
 *
 * As ações têm nome próprio em vez de `onPrimaryPress`/`onSecondaryPress`:
 * quem monta a tela decide para onde cada uma leva sem precisar saber qual
 * botão é o de cima. Os dois callbacks antigos continuam aceitos.
 */
export const WELCOME_SCREEN_ID = 'patota' as const

export type WelcomeActionId = 'patota.get-started' | 'patota.log-in'

export type WelcomeActionPressHandler = (actionId: WelcomeActionId) => void

export type WelcomeScreenProps = {
  /** Com `false` a tela nasce no estado final, sem a abertura. */
  autoplay?: boolean
  onActionPress?: WelcomeActionPressHandler
  onPrimaryPress?: () => void
  onSecondaryPress?: () => void
  /** Trocar a chave reinicia a abertura do começo. */
  replayKey?: number | string
}
