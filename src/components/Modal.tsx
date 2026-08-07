import { useEffect, type ReactNode } from 'react'
import { IconClose } from './icons'
import { Button, IconButton } from './ui'

/**
 * Folha que sobe pela base: o conteúdo e o botão de fechar ficam na metade
 * inferior da tela, alcançáveis com o polegar.
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-card shadow-raised sm:max-w-md sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2">
            <IconClose className="size-5" />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <footer className="pb-safe border-t border-line p-4">{footer}</footer>}
      </div>
    </div>
  )
}

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
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" block onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="lg" block destructive={destructive} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  )
}
