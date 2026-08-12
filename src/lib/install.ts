/*
 * Convite para instalar o aplicativo na tela de início.
 *
 * Só o Chrome e o Edge oferecem o diálogo nativo de instalação, através do
 * evento `beforeinstallprompt`. No Safari, no Firefox e em tudo que roda no
 * iPhone não existe evento nenhum: o caminho é o menu do navegador. Por isso
 * o convite tem duas formas — um botão que abre o diálogo onde ele existe, e
 * a instrução escrita onde não existe — e assim aparece em qualquer navegador
 * de qualquer sistema.
 *
 * Este arquivo guarda a parte que não depende de React: o que o navegador
 * conta sobre si mesmo, o texto de cada caminho manual e a memória de que o
 * convite já foi feito.
 */

/* ------------------------------------------------------------- Ambiente ---- */

/** O que o navegador conta sobre si mesmo, reunido para poder ser testado. */
export interface BrowserFacts {
  userAgent: string
  /** O iPad moderno se anuncia como Mac; o toque na tela é o que o entrega. */
  maxTouchPoints: number
  /** `display-mode: standalone` — a página abriu fora da aba do navegador. */
  standaloneDisplay: boolean
  /** `navigator.standalone`, a versão do Safari no iOS da mesma informação. */
  iosStandalone: boolean
  /** O Android abre o app instalado com este referenciador. */
  androidApp: boolean
}

export type InstallPlatform = 'ios' | 'android' | 'desktop'

type Browser = 'safari' | 'firefox' | 'chromium'

/** Lê o ambiente real. Fora do navegador devolve um ambiente neutro. */
export function readBrowserFacts(): BrowserFacts {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      userAgent: '',
      maxTouchPoints: 0,
      standaloneDisplay: false,
      iosStandalone: false,
      androidApp: false,
    }
  }

  const matches = (query: string) => window.matchMedia?.(query).matches === true

  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standaloneDisplay:
      matches('(display-mode: standalone)') ||
      matches('(display-mode: fullscreen)') ||
      matches('(display-mode: minimal-ui)'),
    iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    androidApp: document.referrer.startsWith('android-app://'),
  }
}

export function detectPlatform({ userAgent, maxTouchPoints }: BrowserFacts): InstallPlatform {
  // O iPadOS 13 em diante manda a mesma linha de um Mac; só o número de
  // pontos de toque separa os dois.
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  return 'desktop'
}

function detectBrowser(userAgent: string): Browser {
  if (/firefox|fxios/i.test(userAgent)) return 'firefox'
  // Todo Chromium carrega "Safari" na linha; o contrário não acontece.
  if (/safari/i.test(userAgent) && !/chrome|chromium|crios|edg|android|opr/i.test(userAgent)) {
    return 'safari'
  }
  return 'chromium'
}

/** O app já está na tela de início — não há o que convidar. */
export function isAppInstalled(facts: BrowserFacts): boolean {
  return facts.standaloneDisplay || facts.iosStandalone || facts.androidApp
}

/**
 * O caminho manual, na linguagem do aparelho de quem está lendo.
 *
 * No iPhone e no iPad todos os navegadores passam pela folha de
 * compartilhamento do sistema, inclusive Chrome e Firefox — a instrução é uma
 * só. No computador o Firefox não instala aplicativos, então o texto aponta
 * para um navegador que instala em vez de mandar procurar um menu que não
 * existe.
 */
export function manualInstallHint(facts: BrowserFacts): string {
  const platform = detectPlatform(facts)
  const browser = detectBrowser(facts.userAgent)

  if (platform === 'ios') {
    return 'Toque em Compartilhar, na barra do navegador, e escolha “Adicionar à Tela de Início”.'
  }

  if (platform === 'android') {
    return browser === 'firefox'
      ? 'Abra o menu do navegador e escolha “Instalar”.'
      : 'Abra o menu do navegador e escolha “Adicionar à tela inicial”.'
  }

  if (browser === 'safari') return 'No menu Arquivo do Safari, escolha “Adicionar ao Dock”.'
  if (browser === 'firefox') return 'Para instalar no computador, abra o app no Chrome, no Edge ou no Safari.'
  return 'Clique no ícone de instalar, no fim da barra de endereço.'
}

/** Um ícone do próprio navegador, desenhado dentro do passo que fala dele. */
export type StepIcon = 'share' | 'menu' | 'install'

export interface InstallStep {
  text: string
  icon?: StepIcon
}

/**
 * O mesmo caminho manual, agora passo a passo, para quem tocou no convite
 * querendo que ele fizesse o trabalho.
 *
 * Nenhum navegador deixa uma página abrir sozinha o “Adicionar à Tela de
 * Início” — no iPhone não existe API para isso, e é por aí que a maior parte
 * da patota vai passar. Como não dá para executar, resta ensinar bem: o
 * ícone que a pessoa tem que procurar aparece desenhado ao lado do passo.
 */
export function manualInstallSteps(facts: BrowserFacts): InstallStep[] {
  const platform = detectPlatform(facts)
  const browser = detectBrowser(facts.userAgent)

  if (platform === 'ios') {
    return [
      { icon: 'share', text: 'Toque em Compartilhar, na barra do navegador.' },
      { text: 'Deslize a lista até “Adicionar à Tela de Início” e toque.' },
      { text: 'Confirme em “Adicionar”. O ícone fica junto dos seus outros apps.' },
    ]
  }

  if (platform === 'android') {
    return [
      { icon: 'menu', text: 'Abra o menu do navegador.' },
      {
        text:
          browser === 'firefox'
            ? 'Escolha “Instalar”.'
            : 'Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.',
      },
      { text: 'Confirme. O ícone fica junto dos seus outros apps.' },
    ]
  }

  if (browser === 'safari') {
    return [
      { text: 'No menu Arquivo do Safari, escolha “Adicionar ao Dock”.' },
      { text: 'Confirme em “Adicionar”. O app aparece no Dock.' },
    ]
  }

  if (browser === 'firefox') {
    return [
      { text: 'O Firefox no computador não instala aplicativos web.' },
      { text: 'Abra o app no Chrome, no Edge ou no Safari para instalá-lo.' },
    ]
  }

  return [
    { icon: 'install', text: 'Clique no ícone de instalar, no fim da barra de endereço.' },
    { text: 'Confirme em “Instalar”. O app abre em janela própria.' },
  ]
}

/* -------------------------------------------------------------- Memória ---- */

export const INSTALL_PROMPT_KEY = 'patota.convite-instalar.v1'

/** `visto` basta para não repetir: o convite é da primeira abertura. */
export type InstallPromptOutcome = 'visto' | 'dispensado' | 'instalado'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** O Safari em navegação privada lança ao tocar no armazenamento. */
export function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readInstallPromptOutcome(
  storage: StorageLike | null,
): InstallPromptOutcome | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(INSTALL_PROMPT_KEY)
    return raw === 'visto' || raw === 'dispensado' || raw === 'instalado' ? raw : null
  } catch {
    return null
  }
}

export function saveInstallPromptOutcome(
  storage: StorageLike | null,
  outcome: InstallPromptOutcome,
): void {
  if (!storage) return
  try {
    storage.setItem(INSTALL_PROMPT_KEY, outcome)
  } catch {
    // Sem memória o convite volta na próxima abertura; é o pior caso aceitável.
  }
}

/** Convida quem ainda não instalou e ainda não viu o convite. */
export function shouldInviteInstall(facts: BrowserFacts, storage: StorageLike | null): boolean {
  if (isAppInstalled(facts)) return false
  return readInstallPromptOutcome(storage) === null
}

/* ------------------------------------------------- Diálogo do Chromium ---- */

/** O evento que o Chrome e o Edge disparam; ainda fora do padrão. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<(event: BeforeInstallPromptEvent) => void>()

/**
 * Precisa ser chamado antes de a interface montar.
 *
 * O `beforeinstallprompt` chega uma vez só, logo depois do carregamento, e
 * quem não estava ouvindo o perde para sempre — o botão de instalar viraria
 * instrução escrita à toa no Chrome. Guardar o evento aqui, no módulo, deixa
 * o componente livre para aparecer quando quiser.
 */
export function watchInstallPrompt(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isto o Chrome desenha a própria barra de instalação por cima.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    for (const listener of listeners) listener(deferred)
  })

  window.addEventListener('appinstalled', () => {
    deferred = null
  })
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred
}

export function onInstallPrompt(listener: (event: BeforeInstallPromptEvent) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearInstallPrompt(): void {
  deferred = null
}
