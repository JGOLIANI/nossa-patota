/**
 * Contrato da tela de boas-vindas.
 *
 * As ações têm nome próprio em vez de um `onPrimaryPress` genérico: quem
 * monta a tela decide para onde cada uma leva sem precisar saber qual botão
 * é o de cima.
 */
export type WelcomeActionId = 'patota.get-started' | 'patota.log-in'

export type WelcomeActionPressHandler = (actionId: WelcomeActionId) => void

export type WelcomeScreenProps = {
  /** Com `false` a tela nasce no estado final, sem a abertura. */
  autoplay?: boolean
  onActionPress?: WelcomeActionPressHandler
  /** Trocar a chave reinicia a abertura do começo. */
  replayKey?: number | string
}
