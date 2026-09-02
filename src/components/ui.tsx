import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { teamSurface } from '../lib/color'
import { IconChevronDown, IconChevronRight, IconClose, IconSearch } from './icons'

/* -------------------------------------------------------------- Button ---- */

type Variant = 'primary' | 'secondary' | 'quiet'

/**
 * Os três botões: o preenchido da ação principal, o claro da ação secundária
 * e o de texto puro.
 *
 * Os dois primeiros se apoiam num degrau sólido — uma faixa da própria cor,
 * mais escura, embaixo — e ao toque descem até encostar nele. O texto sobre o
 * verde vivo é escuro, e não branco: branco ali não passa de 2,2:1, e a cor
 * de ação não vale uma legibilidade pior.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-fill text-brand-ink shadow-[0_4px_0_0_var(--color-lift-brand)]',
  secondary: 'bg-card text-ink border-2 border-line shadow-[0_4px_0_0_var(--color-lift-line)]',
  quiet: 'text-brand',
}

const DESTRUCTIVE: Record<Variant, string> = {
  primary: 'bg-loss text-white shadow-[0_4px_0_0_rgb(0_0_0/0.28)]',
  secondary: 'bg-loss-soft text-loss border-2 border-loss/25 shadow-[0_4px_0_0_rgb(0_0_0/0.12)]',
  quiet: 'text-loss',
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
  // O botão de texto puro não tem caixa, então também não tem a altura, o
  // degrau nem a caixa alta dos preenchidos: ele é só o rótulo.
  const shape =
    variant === 'quiet'
      ? 'h-12 rounded-control px-4 text-body font-bold'
      : size === 'lg'
        ? 'h-14 rounded-control px-6 text-headline tracking-[0.04em] uppercase'
        : 'h-12 rounded-control px-4 text-subhead font-bold'

  return (
    <button
      className={cn(
        // `min-w-0` e a ausência de `shrink-0` são o que permite dois botões
        // de largura total dividirem a mesma linha sem estourar a tela; só o
        // ícone é que não pode encolher.
        'inline-flex min-w-0 items-center justify-center gap-2 [&>svg]:shrink-0',
        'whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-40',
        // `lift` faz a superfície descer até o degrau enquanto o dedo está em
        // cima; o botão de texto puro não tem degrau, então só apaga.
        variant === 'quiet' ? 'transition duration-200 ease-ios active:opacity-40' : 'lift',
        shape,
        destructive ? DESTRUCTIVE[variant] : VARIANTS[variant],
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
  tone = 'neutral',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  /** `tint` é a cor de destaque das ações de barra de navegação. */
  tone?: 'neutral' | 'tint' | 'destructive'
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-2xl',
        'transition duration-200 ease-ios active:scale-90 active:opacity-60 disabled:opacity-35',
        tone === 'tint' && 'text-brand',
        tone === 'destructive' && 'text-loss',
        tone === 'neutral' && 'text-muted',
        className,
      )}
      {...props}
    />
  )
}

/* ---------------------------------------------------------------- Card ---- */

/**
 * Cartão agrupado. Borda cheia e degrau sólido embaixo: no padrão novo o
 * cartão tem espessura, em vez de flutuar sobre uma sombra difusa.
 */
export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn('rounded-card border-2 border-line bg-card shadow-card', className)}
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
    // O rótulo de seção é pequeno, pesado e verde: ele separa blocos sem
    // disputar atenção com os títulos de dentro deles.
    <div className="mb-2.5 flex items-center justify-between gap-3 px-1.5">
      <h2 className="text-caption2 text-brand uppercase">{title}</h2>
      {action}
    </div>
  )
}

/** Atalho para o link discreto ao lado de um título de seção. */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 text-subhead font-medium text-brand">
      {children}
    </Link>
  )
}

/* ------------------------------------------------------------- TeamDot ---- */

/**
 * Bolinha com a cor do colete.
 *
 * O contorno não é enfeite. Os dois times da patota são preto e branco, e
 * cada um desaparece sobre uma das superfícies do aplicativo: o branco sobre
 * o cartão claro, o preto sobre o fundo do tema escuro. A borda garante que a
 * bolinha exista nos dois temas, seja qual for a cor escolhida.
 */
export function TeamDot({ color, className }: { color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={teamSurface(color)}
    />
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
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-headline text-ink">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-footnote text-muted">{subtitle}</span>
        )}
      </span>
    </>
  )

  const wrapper = cn(
    'relative flex w-full items-center',
    accent && 'pl-2',
    selected ? 'bg-brand-soft' : 'bg-card',
    className,
  )

  const main = cn(
    'flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors',
    (to || onClick) && 'active:bg-fill',
  )

  const edge = (
    <>
      {trailing && <span className="shrink-0 pr-3">{trailing}</span>}
      {chevron && <IconChevronRight className="mr-4 size-3.5 shrink-0 stroke-[3] text-faint" />}
    </>
  )

  const stripe = accent ? (
    <span
      aria-hidden="true"
      className="absolute inset-y-2 left-0 w-1 rounded-r-full"
      style={teamSurface(accent)}
    />
  ) : null

  // O separador do grupo começa onde começa o texto, e é a linha que informa
  // esse recuo — com avatar ele parte de 60px, sem avatar do próprio texto.
  const style = { '--sep-inset': leading ? '4.25rem' : '1rem' } as CSSProperties

  // O conteúdo interativo e a área final são irmãos, nunca aninhados: um
  // botão dentro de um link navega ao ser clicado, o que já quebrou o
  // seletor de posição na escalação.
  if (to) {
    return (
      <div className={wrapper} style={style}>
        {stripe}
        <Link to={to} className={main}>
          {content}
        </Link>
        {edge}
      </div>
    )
  }

  if (onClick) {
    return (
      <div className={wrapper} style={style}>
        {stripe}
        <button type="button" onClick={onClick} className={main}>
          {content}
        </button>
        {edge}
      </div>
    )
  }

  return (
    <div className={wrapper} style={style}>
      {stripe}
      <div className={main}>{content}</div>
      {edge}
    </div>
  )
}

/** Agrupa linhas em um cartão único, com separadores — a lista do iOS. */
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
        'list-group overflow-hidden rounded-card border-2 border-line bg-card shadow-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------- Tabs e filtros ---- */

/**
 * Controle segmentado: o seletor de seções do iOS. O trilho é cinza e a
 * opção escolhida sobe como uma pastilha clara com sombra.
 */
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
    <div role="tablist" className="flex rounded-control bg-fill p-1">
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
              'min-w-0 flex-1 rounded-[0.75rem] px-2 py-2 text-footnote',
              'transition duration-200 ease-ios active:scale-[0.96]',
              active ? 'bg-card text-ink shadow-knob' : 'text-muted',
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Filtros. Sempre cápsulas, nunca segmentado — a distinção é proposital. */
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
              'shrink-0 rounded-full px-4 py-2 text-subhead font-bold',
              'transition duration-200 ease-ios active:scale-[0.96]',
              active ? 'bg-brand-fill text-brand-ink' : 'bg-card border-2 border-line text-muted',
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

/**
 * Campo: fundo do cartão e borda cheia, como as outras superfícies do padrão.
 * A borda troca de cor no foco — quem está preenchendo enxerga em qual campo
 * está sem precisar do cursor.
 */
const CONTROL =
  'w-full rounded-control border-2 border-line bg-card px-4 py-3 text-body text-ink ' +
  'placeholder:text-faint disabled:opacity-40 focus:border-brand'

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
      <span className="mb-1.5 block px-1.5 text-caption2 text-muted uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-1.5 text-caption text-faint">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />
}

/**
 * Campo de busca do iOS: cápsula cinza, lupa à esquerda e o botão de limpar
 * que só existe enquanto há texto. Tem forma própria porque é mais baixo que
 * um campo comum — ele acompanha a lista, não o formulário.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <IconSearch
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 stroke-[2.6] text-faint"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border-2 border-line bg-card pr-10 pl-10 text-callout text-ink placeholder:text-faint focus:border-brand [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-faint text-card"
        >
          <IconClose className="size-3 stroke-[3.4]" />
        </button>
      )}
    </div>
  )
}

/**
 * O seletor nativo perde a seta quando recebe estilo próprio; a dupla de
 * setas à direita é a mesma marca que o iOS usa para dizer "isto abre uma
 * lista".
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cn(CONTROL, 'appearance-none pr-10', className)} {...props} />
      <IconChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 stroke-[2.4] text-faint"
      />
    </span>
  )
}

/** Chave de duas posições, com o trilho e o botão nas medidas do iOS. */
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
    <div className="flex items-center justify-between gap-3 rounded-control border-2 border-line bg-card px-4 py-3">
      <span className="text-body text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-ios',
          checked ? 'bg-brand-fill' : 'bg-fill-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-knob',
            'transition-transform duration-300 ease-ios',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
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
    live: 'bg-brand-fill text-brand-ink',
    done: 'bg-fill text-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption2 uppercase',
        tones[tone],
      )}
    >
      {tone === 'live' && (
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse-dot rounded-full bg-current"
        />
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
    info: 'border-line bg-fill text-muted',
    warn: 'border-warn/25 bg-warn-soft text-warn',
    error: 'border-loss/25 bg-loss-soft text-loss',
  }
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('rounded-control border-2 px-4 py-3 text-footnote', tones[tone])}
    >
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
    <div className="px-6 py-12 text-center">
      <p className="text-title3 text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-xs text-subhead text-muted">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * Indicador de atividade do iOS: doze raios apagando em sequência. O desenho
 * mora no CSS; aqui só distribuímos os raios em volta do centro.
 */
const RAYS = Array.from({ length: 12 }, (_, index) => index)

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={cn('activity size-5 text-faint', className)}
    >
      {RAYS.map((ray) => (
        <span
          key={ray}
          style={{
            transform: `rotate(${ray * 30}deg)`,
            animationDelay: `${(ray - 12) / 12}s`,
          }}
        />
      ))}
    </span>
  )
}

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner className="size-7" />
      <p className="text-subhead text-muted">{label}</p>
    </div>
  )
}

/* ---------------------------------------------------------- Números ------- */

/**
 * Número com rótulo. Sem caixa própria: as estatísticas aparecem lado a lado
 * dentro de um cartão, o que reduz muito a quantidade de bordas na tela. Os
 * números usam a variante arredondada da San Francisco, como os painéis do
 * Fitness e do Tempo.
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
          'text-title1 tabular-nums',
          tone === 'brand' && 'text-brand',
          tone === 'win' && 'text-win',
          tone === 'loss' && 'text-loss',
          !tone && 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-caption2 text-muted uppercase">{label}</p>
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
 * ação primária exatamente no mesmo lugar — ao alcance do polegar. O degradê
 * dissolve o conteúdo que passa por baixo, em vez de cortá-lo com uma borda.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto w-full max-w-lg bg-gradient-to-t from-canvas via-canvas to-transparent px-4 pt-8 pb-3"
      style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  )
}
