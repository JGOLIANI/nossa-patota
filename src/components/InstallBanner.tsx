import { useCallback, useEffect, useState } from 'react'
import {
  clearInstallPrompt,
  getInstallPrompt,
  manualInstallHint,
  onInstallPrompt,
  readBrowserFacts,
  safeStorage,
  saveInstallPromptOutcome,
  shouldInviteInstall,
  type BeforeInstallPromptEvent,
} from '../lib/install'
import { IconClose } from './icons'
import { Button } from './ui'

/**
 * O convite desce depois da primeira tela desenhada: o app tem que aparecer
 * antes de pedir alguma coisa. O intervalo também dá tempo de o Chrome
 * disparar o `beforeinstallprompt`, e assim o balão já nasce com o botão em
 * vez da instrução escrita.
 */
const ATRASO_MS = 1200

/**
 * Balão de notificação do sistema, no topo da tela, convidando a instalar o
 * app na tela de início. Aparece uma vez, na primeira abertura, em qualquer
 * navegador do Android, do iPhone ou do computador — onde o navegador tem
 * diálogo próprio de instalação, com o botão que o abre; onde não tem, com o
 * caminho do menu escrito.
 */
export function InstallBanner() {
  const [facts] = useState(readBrowserFacts)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(getInstallPrompt)
  const [open, setOpen] = useState(false)

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

  if (!open) return null

  return (
    <div className="top-safe pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-3 pt-3">
      <div
        role="dialog"
        aria-label="Instalar o Nossa Patota"
        className="material squircle animate-banner-in pointer-events-auto w-full max-w-lg rounded-[20px] p-3 shadow-raised"
      >
        <div className="flex items-start gap-3">
          <img
            src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
            alt=""
            className="squircle size-10 shrink-0 rounded-[10px]"
          />

          <div className="min-w-0 flex-1">
            <p className="text-footnote font-semibold text-ink">Instalar o Nossa Patota</p>
            <p className="mt-0.5 text-caption text-muted">
              {prompt
                ? 'Na tela de início o app abre em tela cheia e funciona sem internet.'
                : manualInstallHint(facts)}
            </p>
          </div>

          <button
            type="button"
            aria-label="Agora não"
            onClick={() => dismiss('dispensado')}
            className="-mt-0.5 -mr-0.5 inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-fill text-muted transition duration-200 ease-ios active:scale-90"
          >
            <IconClose className="size-4 stroke-[2.6]" />
          </button>
        </div>

        {prompt && (
          <div className="mt-2.5 flex justify-end">
            <Button onClick={() => void install(prompt)}>Instalar</Button>
          </div>
        )}
      </div>
    </div>
  )
}
