import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useApp } from '../store/useApp'
import { IconCalendar, IconHome, IconTrophy, IconUsers } from './icons'
import { Spinner } from './ui'

/**
 * Quatro destinos, todos substantivos concretos.
 *
 * "Perfil" saiu da barra: ele conflitava com "Jogadores" (a lista de todo
 * mundo) e agora fica atrás do próprio avatar, no canto superior direito —
 * o lugar onde as pessoas já esperam encontrá-lo.
 */
const NAV = [
  { to: '/', label: 'Início', Icon: IconHome, end: true },
  { to: '/rodadas', label: 'Rodadas', Icon: IconCalendar, end: false },
  { to: '/rankings', label: 'Rankings', Icon: IconTrophy, end: false },
  { to: '/jogadores', label: 'Elenco', Icon: IconUsers, end: false },
]

export function Layout() {
  const { demoMode, loading } = useApp()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      {demoMode && (
        <p className="pt-safe bg-warn-soft px-4 py-1 text-center text-[12px] text-warn">
          Modo demonstração · dados só neste aparelho
        </p>
      )}

      {loading && (
        <div className="fixed top-3 right-3 z-40">
          <Spinner />
        </div>
      )}

      <main className={cn('flex-1 px-4', demoMode ? 'pt-2' : 'pt-safe')} style={{ paddingBottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 24px)' }}>
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card">
        <ul className="mx-auto flex w-full max-w-lg" style={{ height: 'var(--nav-height)' }}>
          {NAV.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-1 text-[11px] transition',
                    isActive ? 'font-semibold text-brand' : 'text-faint',
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
