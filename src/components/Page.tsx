import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '../lib/cn'
import { Avatar } from './Avatar'
import { IconChevronLeft } from './icons'
import { useApp } from '../store/useApp'

/**
 * Cabeçalho único de todas as telas.
 *
 * Ter um só componente garante que o título, o botão de voltar e a ação da
 * tela apareçam sempre na mesma posição — o usuário sabe onde está e como
 * sair sem precisar procurar.
 *
 * O título aparece duas vezes de propósito: grande no corpo, como abertura da
 * tela, e pequeno na barra fixa. Ao rolar, a barra ganha fundo no instante em
 * que o título grande a encosta — é ela que o esconde — e o título pequeno
 * acende depois, quando o grande acabou de passar. É o movimento do título
 * grande do iOS, e ele existe para que você nunca perca de vista em que tela
 * está.
 */
export function Page({
  title,
  subtitle,
  back,
  action,
  /** Telas de primeiro nível mostram o próprio avatar, que leva ao perfil. */
  profile,
  children,
}: {
  title: string
  subtitle?: ReactNode
  back?: boolean
  action?: ReactNode
  profile?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const { currentPlayer, demoMode } = useApp()

  const bar = useRef<HTMLElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Medir os dois elementos evita depender de qualquer número mágico: a barra
  // muda de altura com o recorte da tela, e o título grande muda com a
  // legenda. As duas medidas cruzam a mesma borda — a base da barra — em
  // momentos diferentes, e é essa diferença que faz o movimento.
  useEffect(() => {
    const barNode = bar.current
    const headingNode = heading.current
    if (!barNode || !headingNode) return

    let frame = 0
    const measure = () => {
      frame = 0
      const barBottom = barNode.getBoundingClientRect().bottom
      const headingBox = headingNode.getBoundingClientRect()
      // O fundo acende no primeiro instante em que o título grande encosta na
      // barra. Esperar ele passar inteiro deixava a barra transparente
      // justamente enquanto o título cruzava o botão de voltar — e um ficava
      // por cima do outro. Opaca desde o começo, a barra o esconde.
      setScrolled(headingBox.top < barBottom)
      // O título pequeno, esse sim, só acende quando o grande terminou de
      // passar: os dois juntos seriam o mesmo nome escrito duas vezes.
      setCollapsed(headingBox.bottom <= barBottom)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Trocar o título ou a legenda muda a altura do cabeçalho; observar os
    // dois blocos dispensa refazer o efeito a cada renderização.
    const observer = new ResizeObserver(schedule)
    observer.observe(barNode)
    observer.observe(headingNode)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <header
        ref={bar}
        className={cn(
          'sticky top-0 z-20 transition-colors duration-200',
          // Em demonstração a faixa de aviso já ocupa a área segura do topo.
          !demoMode && 'pt-safe',
          scrolled && 'material hairline',
        )}
      >
        <div className="relative flex items-center px-2" style={{ height: 'var(--bar-height)' }}>
          {/* O título da barra é centralizado sobre ela inteira, e não entre
              os botões: assim ele fica no mesmo lugar com ou sem ações. */}
          <div className="pointer-events-none absolute inset-x-0 flex justify-center px-24">
            <p
              className={cn(
                'truncate text-headline text-ink transition-opacity duration-200',
                collapsed ? 'opacity-100' : 'opacity-0',
              )}
            >
              {title}
            </p>
          </div>

          {back && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="-ml-1 inline-flex h-11 items-center pr-3 text-body text-brand transition duration-200 ease-ios active:opacity-40"
            >
              <IconChevronLeft className="size-6" />
              Voltar
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            {action}
            {profile && currentPlayer && (
              <Link
                to="/perfil"
                aria-label="Meu perfil"
                className="shrink-0 transition duration-200 ease-ios active:scale-90"
              >
                <Avatar player={currentPlayer} size="md" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="px-4">
        <div ref={heading} className="pt-1 pb-5">
          <h1 className="text-largetitle text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-subhead text-muted">{subtitle}</p>}
        </div>

        {children}
      </div>
    </>
  )
}
