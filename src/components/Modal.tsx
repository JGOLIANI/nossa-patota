import { useEffect, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { IconClose } from './icons'

/** Trava a rolagem do fundo enquanto algo estiver sobreposto à tela. */
function useLockedScroll(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
}

/**
 * Folha que sobe pela base: o conteúdo e o botão de fechar ficam na metade
 * inferior da tela, alcançáveis com o polegar.
 *
 * A alça no topo e o botão redondo cinza à direita são as duas marcas da
 * folha do iOS — uma diz que dá para arrastar, o outro que dá para sair.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useLockedScroll(open, onClose)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-scrim"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-sheet bg-card shadow-raised sm:max-w-md sm:rounded-sheet"
      >
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line" />

        <header className="relative flex shrink-0 items-center justify-center px-4 pt-2.5 pb-3">
          <h2 className="truncate px-10 text-headline text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="absolute right-3 inline-flex size-[30px] items-center justify-center rounded-full bg-fill text-muted transition duration-200 ease-ios active:scale-90"
          >
            <IconClose className="size-4 stroke-[2.6]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-5">{children}</div>

        {footer && <footer className="hairline-top pb-safe shrink-0 px-4 pt-3 pb-4">{footer}</footer>}
      </div>
    </div>
  )
}

/**
 * Alerta do sistema: caixa estreita no centro da tela, texto centralizado e
 * as ações separadas por linhas de meio pixel. A ação de cancelar é a de
 * peso maior — no iOS o negrito marca a saída segura, não a confirmação.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useLockedScroll(open, onCancel)

  if (!open) return null

  const action =
    'flex h-[44px] min-w-0 flex-1 items-center justify-center px-3 text-body transition-colors active:bg-fill'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-10">
      <button
        type="button"
        aria-label="Cancelar"
        onClick={onCancel}
        className="absolute inset-0 animate-fade-in bg-scrim"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[270px] animate-alert-in overflow-hidden rounded-alert bg-card shadow-raised"
      >
        <div className="max-h-[60dvh] overflow-y-auto px-4 pt-5 pb-4 text-center">
          <h2 className="text-headline text-ink">{title}</h2>
          <p className="mt-1.5 text-caption text-ink">{message}</p>
        </div>

        <div className="hairline-top flex">
          <button type="button" onClick={onCancel} className={cn(action, 'font-semibold text-brand')}>
            <span className="truncate">Cancelar</span>
          </button>
          <span aria-hidden="true" className="w-px shrink-0 bg-line" />
          <button
            type="button"
            onClick={onConfirm}
            className={cn(action, destructive ? 'text-loss' : 'text-brand')}
          >
            <span className="truncate">{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
