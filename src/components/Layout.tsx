import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useApp } from '../store/useApp'
import { IconCalendar, IconHome, IconTrophy, IconUser, IconUsers } from './icons'
import { Spinner } from './ui'

const NAV = [
  { to: '/', label: 'Início', Icon: IconHome, end: true },
  { to: '/rodadas', label: 'Rodadas', Icon: IconCalendar, end: false },
  { to: '/rankings', label: 'Rankings', Icon: IconTrophy, end: false },
  { to: '/jogadores', label: 'Jogadores', Icon: IconUsers, end: false },
  { to: '/perfil', label: 'Perfil', Icon: IconUser, end: false },
]

export function Layout() {
  const { demoMode, loading } = useApp()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      {demoMode && (
        <p className="pt-safe bg-amber-500/15 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-300">
          Modo demonstração · dados só neste aparelho
        </p>
      )}

      {loading && (
        <div className="fixed top-3 right-3 z-40">
          <Spinner />
        </div>
      )}

      <main className={cn('flex-1 px-4 pb-28', demoMode ? 'pt-3' : 'pt-safe')}>
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <ul className="mx-auto flex w-full max-w-lg">
          {NAV.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
                    isActive ? 'text-emerald-400' : 'text-slate-500',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-6', isActive && 'stroke-[2.2]')} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
