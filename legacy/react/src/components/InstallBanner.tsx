import { useCallback, useEffect, useState, type ComponentType } from 'react'
import {
  clearInstallPrompt,
  getInstallPrompt,
  manualInstallHint,
  manualInstallSteps,
  onInstallPrompt,
  readBrowserFacts,
  safeStorage,
  saveInstallPromptOutcome,
  shouldInviteInstall,
  type BeforeInstallPromptEvent,
  type StepIcon,
} from '../lib/install'
import { IconChevronRight, IconClose, IconInstall, IconMenuDots, IconShare } from './icons'
import { Modal } from './Modal'
import { Button } from './ui'

/**
 * O convite desce depois da primeira tela desenhada: o app tem que aparecer
 * antes de pedir alguma coisa. O intervalo também dá tempo de o Chrome
 * disparar o `beforeinstallprompt`, e assim o balão já nasce podendo instalar
 * de verdade, em vez de só ensinar o caminho.
 */
const ATRASO_MS = 1200

const STEP_ICONS: Record<StepIcon, ComponentType<{ className?: string }>> = {
  share: IconShare,
  menu: IconMenuDots,
  install: IconInstall,
}

const appIcon = `${import.meta.env.BASE_URL}icons/icon-192.png`

/**
 * Balão de notificação do sistema, no topo da tela, convidando a instalar o
 * app na tela de início. Aparece uma vez, na primeira abertura, em qualquer
 * navegador do Android, do iPhone ou do computador.
 *
 * O balão inteiro é um botão. Onde o navegador tem diálogo de instalação —
 * Chrome e Edge — tocar nele instala, sem mais nenhuma parada. Onde não tem,
 * tocar abre o passo a passo: o iPhone não dá a nenhuma página o poder de
 * adicionar à tela de início sozinha, então o melhor que existe é levar a
 * pessoa até o botão certo.
 */
export function InstallBanner() {
  const [facts] = useState(readBrowserFacts)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(getInstallPrompt)
  const [open, setOpen] = useState(false)
  const [guide, setGuide] = useState(false)

  const dismiss = useCallback((outcome: 'dispensado' | 'instalado') => {
    setOpen(false)
    saveInstallPromptOutcome(safeStorage(), outcome)
  }, [])

  useEffect(() => {
    if (!shouldInviteInstall(facts, safeStorage())) return

    // O convite conta como feito assim que aparece: ele é da primeira
    // abertura, e voltar a cada visita seria propaganda, não ajuda.
    const timer = window.setTimeout(() => {
      setOpen(true)
      saveInstallPromptOutcome(safeStorage(), 'visto')
    }, ATRASO_MS)

    const stopWatching = onInstallPrompt((event) => setPrompt(event))
    const onInstalled = () => {
      setOpen(false)
      setGuide(false)
      saveInstallPromptOutcome(safeStorage(), 'instalado')
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.clearTimeout(timer)
      stopWatching()
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [facts])

  async function install(event: BeforeInstallPromptEvent) {
    // O diálogo do navegador toma a tela: o balão sai da frente antes.
    setOpen(false)
    await event.prompt()
    const { outcome } = await event.userChoice
    saveInstallPromptOutcome(safeStorage(), outcome === 'accepted' ? 'instalado' : 'dispensado')
    // O evento vale uma vez só.
    clearInstallPrompt()
    setPrompt(null)
  }

  /** Um toque no balão: instala onde dá, ensina onde não dá. */
  function tap() {
    if (prompt) {
      void install(prompt)
      return
    }
    setOpen(false)
    setGuide(true)
  }

  return (
    <>
      {open && (
        <div className="top-safe pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-3 pt-3">
          <div
            role="dialog"
            aria-label="Instalar o Nossa Patota"
            className="material squircle animate-banner-in pointer-events-auto w-full max-w-lg rounded-card border-2 border-line p-3.5 shadow-raised"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={tap}
                className="flex min-w-0 flex-1 items-start gap-3 text-left transition duration-200 ease-ios active:opacity-60"
              >
                <img
                  src={appIcon}
                  alt=""
                  className="squircle size-12 shrink-0 rounded-2xl border-2 border-line"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-headline text-ink">Instalar o Nossa Patota</span>
                  <span className="mt-0.5 block text-footnote text-muted">
                    {prompt
                      ? 'Toque para colocar o app na tela de início: ele abre em tela cheia e funciona sem internet.'
                      : manualInstallHint(facts)}
                  </span>
                </span>

                {!prompt && (
                  <IconChevronRight className="mt-3 size-4 shrink-0 self-start text-faint" />
                )}
              </button>

              <button
                type="button"
                aria-label="Agora não"
                onClick={() => dismiss('dispensado')}
                className="-mt-0.5 -mr-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-card text-muted transition duration-200 ease-ios active:scale-90"
              >
                <IconClose className="size-4" />
              </button>
            </div>

            {prompt && (
              <div className="mt-3 flex justify-end">
                <Button onClick={() => void install(prompt)}>Instalar</Button>
              </div>
            )}
          </div>
        </div>
      )}

      <InstallGuide open={guide} facts={facts} onClose={() => setGuide(false)} />
    </>
  )
}

/**
 * O passo a passo, na folha do sistema. Cada passo tem seu número, e o que
 * fala de um botão do navegador mostra o desenho dele — no iPhone, procurar
 * “Compartilhar” pelo nome é mais difícil do que reconhecer o quadrado com a
 * seta para cima.
 */
function InstallGuide({
  open,
  facts,
  onClose,
}: {
  open: boolean
  facts: ReturnType<typeof readBrowserFacts>
  onClose: () => void
}) {
  const steps = manualInstallSteps(facts)

  return (
    <Modal open={open} title="Instalar na tela de início" onClose={onClose}>
      <div className="flex items-center gap-3 pb-1">
        <img
          src={appIcon}
          alt=""
          className="squircle size-14 shrink-0 rounded-2xl border-2 border-line"
        />
        <p className="text-footnote text-muted">
          Neste navegador o app não pode se instalar sozinho. O caminho é este:
        </p>
      </div>

      <ol className="list-group mt-4 overflow-hidden rounded-card border-2 border-line bg-card">
        {steps.map((step, index) => {
          const Icon = step.icon ? STEP_ICONS[step.icon] : null
          return (
            <li key={step.text} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand-fill text-caption text-brand-ink">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-subhead text-ink">{step.text}</span>
              {Icon && <Icon className="size-5 shrink-0 text-brand" />}
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
