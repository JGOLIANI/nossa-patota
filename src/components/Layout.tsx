import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useApp } from '../store/useApp'
import {
  IconCalendar,
  IconCalendarSolid,
  IconHome,
  IconHomeSolid,
  IconTrophy,
  IconTrophySolid,
  IconUsers,
  IconUsersSolid,
} from './icons'
import { Spinner } from './ui'

/**
 * Quatro destinos, todos substantivos concretos.
 *
 * "Perfil" saiu da barra: ele conflitava com "Jogadores" (a lista de todo
 * mundo) e agora fica atrás do próprio avatar, no canto superior direito —
 * o lugar onde as pessoas já esperam encontrá-lo.
 *
 * Cada destino tem duas versões do ícone: vazada quando está de passagem,
 * preenchida quando é onde você está. É a convenção da barra de abas do iOS.
 */
const NAV = [
  { to: '/', label: 'Início', Icon: IconHome, Active: IconHomeSolid, end: true },
  { to: '/rodadas', label: 'Partidas', Icon: IconCalendar, Active: IconCalendarSolid, end: false },
  { to: '/rankings', label: 'Rankings', Icon: IconTrophy, Active: IconTrophySolid, end: false },
  { to: '/jogadores', label: 'Elenco', Icon: IconUsers, Active: IconUsersSolid, end: false },
]

export function Layout() {
  const { demoMode, loading } = useApp()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
      {demoMode && (
        <p className="pt-safe bg-warn-soft px-4 py-1 text-center text-caption2 font-medium text-warn">
          Modo demonstração · dados só neste aparelho
        </p>
      )}

      {loading && (
        <div className="top-safe fixed right-4 z-40 mt-3">
          <Spinner />
        </div>
      )}

      <main
        className="flex-1"
        style={{ paddingBottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 24px)' }}
      >
        <Outlet />
      </main>

      {/* A barra de abas é de vidro: o conteúdo continua visível por baixo,
          desfocado, em vez de sumir atrás de um bloco opaco. */}
      <nav className="material hairline-top pb-safe fixed inset-x-0 bottom-0 z-30">
        <ul className="mx-auto flex w-full max-w-lg" style={{ height: 'var(--nav-height)' }}>
          {NAV.map(({ to, label, Icon, Active, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-[3px] text-caption2',
                    'transition duration-200 ease-ios active:scale-90',
                    isActive ? 'font-medium text-brand' : 'text-faint',
                  )
                }
              >
                {({ isActive }) =>
                  isActive ? (
                    <>
                      <Active className="size-[26px]" />
                      {label}
                    </>
                  ) : (
                    <>
                      <Icon className="size-[26px]" />
                      {label}
                    </>
                  )
                }
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
