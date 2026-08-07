import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronLeft } from './icons'
import { IconButton } from './ui'

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: string
  back?: boolean
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="mb-4 flex items-center gap-2 pt-3">
      {back && (
        <IconButton label="Voltar" onClick={() => navigate(-1)} className="-ml-2">
          <IconChevronLeft className="size-6" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
