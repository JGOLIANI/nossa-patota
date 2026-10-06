import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { AppIcon } from './AppIcon'
import { ReferenceCanvas } from './ReferenceCanvas'
import { WelcomePressable } from './WelcomePressable'
import { resolveActionPress } from './actions'
import { box, easeInCubic, mix, segment } from './geometry'
import type { WelcomeScreenProps } from './types'
import { useInteractionGate } from './useInteractionGate'
import { useNunitoReady } from './useNunitoReady'
import { useReducedMotion } from './useReducedMotion'
import { useWelcomeTimeline, type TimelineMode } from './useWelcomeTimeline'

/*
 * Marcações da abertura, em milissegundos, na mesma leitura do clipe de
 * referência a 30 quadros por segundo:
 *
 *   0.900–1.033  o ícone do splash encolhe, acelerando
 *   1.133–1.233  a tela pronta se abre por dentro de um círculo
 *
 * Elas são a tela: mexer num número aqui muda o movimento, e nada mais.
 *
 * O clipe de referência seguia até 2.667 porque a mascote dele piscava em
 * 0.400–0.567 e de novo em 2.467–2.600. O ícone do aplicativo não tem olhos,
 * então essas duas marcações não têm o que animar: a abertura termina onde o
 * círculo termina de abrir, e o relógio para junto em vez de correr em
 * branco por mais um segundo e meio.
 */
const REVEAL_END_MS = 1233

/** Centro do círculo que revela a tela pronta, no plano de referência. */
const REVEAL_CENTER = { x: 320, y: 694 }
const REVEAL_RADIUS = 80

const PITCH = 'var(--color-pitch)'

const styles = {
  splash: {
    ...box([0, 0, 640, 1385]),
    backgroundColor: PITCH,
  },
  splashIcon: {
    ...box([190, 540, 260, 260]),
    transformOrigin: 'center center',
  },
  splashWordmark: {
    ...box([40, 1158, 560, 70]),
    color: '#FFFFFF',
    fontFamily: 'var(--font-nunito)',
    fontSize: 48,
    fontWeight: 900,
    letterSpacing: '-0.5px',
    lineHeight: '70px',
    textAlign: 'center',
  },
  finalScreen: {
    ...box([0, 0, 640, 1385]),
    backgroundColor: 'var(--color-card)',
  },
  icon: {
    ...box([220, 370, 200, 200]),
  },
  wordmark: {
    ...box([40, 615, 560, 76]),
    color: 'var(--color-ink)',
    fontFamily: 'var(--font-nunito)',
    fontSize: 54,
    fontWeight: 900,
    letterSpacing: '-1px',
    lineHeight: '76px',
    textAlign: 'center',
  },
  tagline: {
    ...box([90, 714, 460, 46]),
    color: 'var(--color-muted)',
    fontFamily: 'var(--font-nunito)',
    fontSize: 23,
    fontWeight: 400,
    letterSpacing: '-0.5px',
    lineHeight: '34px',
    textAlign: 'center',
  },
  primaryShadow: {
    ...box([24, 1122, 591, 82]),
    backgroundColor: 'var(--color-lift-brand)',
    borderRadius: 19,
  },
  primary: {
    ...box([24, 1116, 591, 79]),
    backgroundColor: 'var(--color-brand)',
    borderRadius: 19,
  },
  primaryText: {
    color: 'var(--color-brand-ink)',
    fontFamily: 'var(--font-nunito)',
    fontSize: 21,
    fontWeight: 900,
    letterSpacing: '0.5px',
  },
  secondaryShadow: {
    ...box([24, 1229, 591, 78]),
    backgroundColor: 'var(--color-lift-line)',
    borderRadius: 19,
  },
  secondary: {
    ...box([24, 1223, 591, 79]),
    backgroundColor: 'var(--color-card)',
    border: '2px solid var(--color-fill-strong)',
    borderRadius: 19,
  },
  secondaryText: {
    color: 'var(--color-brand)',
    fontFamily: 'var(--font-nunito)',
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: '0.2px',
  },
} satisfies Record<string, CSSProperties>

/**
 * Enquanto a abertura corre, a barra do navegador acompanha o verde do
 * campo; assim que o círculo termina de abrir, ela volta para as cores
 * normais do aplicativo. É o equivalente, na web, a tela dizer de que
 * cor é a barra de status enquanto está na frente.
 */
function useSplashThemeColor(active: boolean) {
  useEffect(() => {
    if (!active) return
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-pitch')
      .trim()
    // O navegador usa a primeira etiqueta que casa, então esta precisa vir
    // antes das duas que o index.html já traz.
    document.head.insertBefore(meta, document.head.firstChild)
    return () => meta.remove()
  }, [active])
}

export function PatotaWelcome({
  autoplay = true,
  onActionPress,
  replayKey = 0,
}: WelcomeScreenProps) {
  const reducedMotion = useReducedMotion()
  const fontsReady = useNunitoReady()
  // A abertura só começa quando a Nunito já está decodificada — com a fonte
  // do sistema a marca nasce com outra largura e "pula" no meio do
  // movimento. Até lá a tela fica parada no primeiro quadro: pular para o
  // estado final e voltar seria justamente o piscar que a espera evita.
  const mode: TimelineMode = !autoplay || reducedMotion ? 'end' : fontsReady ? 'play' : 'hold'
  const gateOpen = useInteractionGate({
    autoplay: mode === 'play',
    delayMs: REVEAL_END_MS,
    replayKey,
  })
  const interactionsReady = mode === 'end' || (mode === 'play' && gateOpen)
  useSplashThemeColor(!interactionsReady)

  const splash = useRef<HTMLDivElement>(null)
  const splashIcon = useRef<HTMLDivElement>(null)
  const reveal = useRef<HTMLDivElement>(null)

  const onFrame = useCallback((time: number) => {
    if (splash.current) {
      // Assim que o círculo acaba de abrir, a tela pronta cobre o plano
      // inteiro e o verde não tem mais o que fazer atrás dela. Deixá-lo ali
      // custaria uma franja verde na borda: quando a proporção do aparelho
      // não é a do plano, a escala cai em meio pixel e o que está por baixo
      // aparece nessa sobra.
      splash.current.style.visibility = time >= REVEAL_END_MS ? 'hidden' : 'visible'
    }
    if (splashIcon.current) {
      const shrink = easeInCubic(segment(time, 900, 1033))
      splashIcon.current.style.transform = `scale(${mix(shrink, [0, 1], [1, 0.36])})`
      splashIcon.current.style.opacity = String(1 - segment(time, 1133, 1233))
    }
    if (reveal.current) {
      const scale = mix(segment(time, 1133, 1233), [0, 0.34, 0.67, 1], [0, 2.6, 7.5, 10])
      const radius = REVEAL_RADIUS * scale
      reveal.current.style.clipPath = `circle(${radius}px at ${REVEAL_CENTER.x}px ${REVEAL_CENTER.y}px)`
    }
  }, [])

  useWelcomeTimeline(REVEAL_END_MS, mode, replayKey, onFrame)

  const getStarted = resolveActionPress('patota.get-started', onActionPress)
  const logIn = resolveActionPress('patota.log-in', onActionPress)

  return (
    <ReferenceCanvas
      // Em aparelhos cuja proporção foge da do plano sobra uma tarja em cima
      // e embaixo. Ela acompanha o que está na frente: verde enquanto a
      // abertura corre, superfície da tela pronta assim que o círculo acaba
      // de abrir — a troca cai no quadro em que o verde já saiu de cena.
      backgroundColor={interactionsReady ? 'var(--color-card)' : PITCH}
      data-testid="welcome-patota"
    >
      <div ref={splash} style={styles.splash} aria-hidden="true">
        <div ref={splashIcon} style={styles.splashIcon}>
          <AppIcon />
        </div>
        <div style={styles.splashWordmark}>Nossa Patota</div>
      </div>

      <div ref={reveal} style={{ position: 'absolute', inset: 0 }}>
        <div style={styles.finalScreen}>
          <div style={styles.icon} aria-hidden="true">
            <AppIcon />
          </div>
          <h1 style={styles.wordmark}>Nossa Patota</h1>
          <p style={styles.tagline}>A sua patota, sempre organizada.</p>

          <div style={styles.primaryShadow} aria-hidden="true" />
          <WelcomePressable
            label="Criar meu acesso"
            disabled={!interactionsReady}
            onPress={getStarted}
            style={styles.primary}
          >
            <span style={styles.primaryText}>CRIAR MEU ACESSO</span>
          </WelcomePressable>

          <div style={styles.secondaryShadow} aria-hidden="true" />
          <WelcomePressable
            label="Já tenho conta"
            disabled={!interactionsReady}
            onPress={logIn}
            style={styles.secondary}
          >
            <span style={styles.secondaryText}>JÁ TENHO CONTA</span>
          </WelcomePressable>
        </div>
      </div>
    </ReferenceCanvas>
  )
}
