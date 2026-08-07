import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { IconChevronLeft } from './icons'
import { IconButton } from './ui'
import { useApp } from '../store/useApp'

/**
 * Cabeçalho único de todas as telas.
 *
 * Ter um só componente garante que o título, o botão de voltar e a ação da
 * tela apareçam sempre na mesma posição — o usuário sabe onde está e como
 * sair sem precisar procurar.
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
  const { currentPlayer } = useApp()

  return (
    <>
      <header className="mb-5 flex items-center gap-2 pt-2">
        {back && (
          <IconButton label="Voltar" onClick={() => navigate(-1)} className="-ml-2.5">
            <IconChevronLeft className="size-6" />
          </IconButton>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
        </div>

        {action}

        {profile && currentPlayer && (
          <Link to="/perfil" aria-label="Meu perfil" className="shrink-0">
            <Avatar player={currentPlayer} size="md" />
          </Link>
        )}
      </header>

      {children}
    </>
  )
}
