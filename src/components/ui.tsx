import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { IconChevronRight } from './icons'

/* -------------------------------------------------------------- Button ---- */

type Variant = 'primary' | 'secondary' | 'quiet'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90 active:opacity-80',
  secondary: 'bg-fill text-ink hover:brightness-95 active:brightness-90',
  quiet: 'text-muted hover:bg-fill',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** `lg` é a altura confortável para a ação principal da tela. */
  size?: 'md' | 'lg'
  block?: boolean
  /** Ações destrutivas: vermelho apenas quando o risco é real. */
  destructive?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  destructive,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // `min-w-0` e a ausência de `shrink-0` são o que permite dois botões
        // de largura total dividirem a mesma linha sem estourar a tela; só o
        // ícone é que não pode encolher.
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-control [&>svg]:shrink-0',
        'font-semibold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-45',
        size === 'lg' ? 'h-13 px-5 text-[15px]' : 'h-11 px-4 text-sm',
        destructive
          ? variant === 'primary'
            ? 'bg-loss text-white hover:opacity-90'
            : 'text-loss hover:bg-fill'
          : VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

/** Botão só de ícone. Sempre 44px, o mínimo confortável para o polegar. */
export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full',
        'text-muted transition hover:bg-fill active:bg-line disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
}

/* ---------------------------------------------------------------- Card ---- */

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-card shadow-card',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {action}
    </div>
  )
}

/** Atalho para o link discreto ao lado de um título de seção. */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm font-medium text-brand">
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------- ListRow ---- */

/**
 * A única linha de lista da aplicação. Jogadores, rodadas, partidas e itens
 * de menu usam esta mesma estrutura, então a leitura fica previsível.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  to,
  onClick,
  selected,
  chevron,
  accent,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  to?: string
  onClick?: () => void
  selected?: boolean
  chevron?: boolean
  /** Faixa colorida à esquerda, usada para a cor do time. */
  accent?: string
  className?: string
}) {
  const interactive = Boolean(to || onClick)

  const content = (
    <>
      {accent && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-1 rounded-r-full"
          style={{ backgroundColor: accent }}
        />
      )}
      {leading}
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium text-ink">{title}</span>
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>
        )}
      </span>
      {trailing}
      {chevron && <IconChevronRight className="size-4 shrink-0 text-faint" />}
    </>
  )

  const base = cn(
    'relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition',
    accent && 'pl-5',
    selected ? 'bg-brand-soft' : 'bg-card',
    interactive && 'hover:bg-fill active:bg-fill',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={base}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={base}>
        {content}
      </button>
    )
  }
  return <div className={base}>{content}</div>
}

/** Agrupa linhas em um cartão único, com divisórias — padrão de lista de app. */
export function ListGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------- Tabs e filtros ---- */

/** Navegação entre seções de uma tela. Sublinhado, como manda o costume. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="flex border-b border-line">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              '-mb-px flex-1 border-b-2 px-2 pb-2.5 text-sm font-medium transition',
              active ? 'border-brand text-ink' : 'border-transparent text-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Filtros. Sempre pílulas, nunca sublinhado — a distinção é proposital. */
export function ChipBar<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
              active
                ? 'border-brand bg-brand text-brand-ink'
                : 'border-line bg-card text-muted hover:bg-fill',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------- Campos ---- */

const CONTROL =
  'w-full rounded-control border border-line bg-card px-3.5 py-3 text-ink ' +
  'placeholder:text-faint focus:border-brand focus:outline-none disabled:opacity-50'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-faint">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, 'appearance-none', className)} {...props} />
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-control bg-fill px-3.5 py-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-6 accent-[var(--color-brand)]"
      />
    </label>
  )
}

/**
 * Etiqueta de estado. Existe uma só, com três tons, e é usada apenas para
 * situação de rodada ou partida — nunca para decorar.
 */
export function Tag({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'live' | 'done'
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-fill text-muted',
    live: 'bg-brand-soft text-brand',
    done: 'bg-fill text-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
        tones[tone],
      )}
    >
      {tone === 'live' && (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      )}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------- Avisos ----- */

export function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error'
  children: ReactNode
}) {
  if (!children) return null
  const tones = {
    info: 'bg-fill text-muted',
    warn: 'bg-warn-soft text-warn',
    error: 'bg-loss/10 text-loss',
  }
  return (
    <p role={tone === 'error' ? 'alert' : undefined} className={cn('rounded-control px-3.5 py-2.5 text-[13px]', tones[tone])}>
      {children}
    </p>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-line border-t-brand',
        className,
      )}
    />
  )
}

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="size-7" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

/* ---------------------------------------------------------- Números ------- */

/**
 * Número com rótulo. Sem caixa própria: as estatísticas aparecem lado a lado
 * dentro de um cartão, o que reduz muito a quantidade de bordas na tela.
 */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: ReactNode
  tone?: 'brand' | 'win' | 'loss'
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p
        className={cn(
          'text-xl leading-tight font-semibold tabular-nums',
          tone === 'brand' && 'text-brand',
          tone === 'win' && 'text-win',
          tone === 'loss' && 'text-loss',
          !tone && 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-muted">{label}</p>
    </div>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2">{children}</div>
}

/* ----------------------------------------------------------- ActionBar ---- */

/**
 * Barra fixa para a ação principal da tela, ancorada logo acima da navegação.
 * Existe um componente só para isso, para que todas as telas posicionem a
 * ação primária exatamente no mesmo lugar — ao alcance do polegar.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto w-full max-w-lg px-4 pb-3"
      style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  )
}
