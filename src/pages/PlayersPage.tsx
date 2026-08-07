import { useMemo, useState } from 'react'
import { Page } from '../components/Page'
import { PlayerFormModal } from '../components/PlayerFormModal'
import { PlayerRow } from '../components/PlayerRow'
import { IconPlus, IconSearch } from '../components/icons'
import { ChipBar, EmptyState, Input, ListGroup } from '../components/ui'
import { playerCaption } from '../lib/player'
import { useApp } from '../store/useApp'
import type { Player } from '../types'

type Filter = 'todos' | 'mensalistas' | 'visitantes' | 'goleiros' | 'inativos'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'mensalistas', label: 'Mensalistas' },
  { value: 'visitantes', label: 'Visitantes' },
  { value: 'goleiros', label: 'Goleiros' },
  { value: 'inativos', label: 'Inativos' },
]

function matches(player: Player, filter: Filter): boolean {
  switch (filter) {
    case 'mensalistas':
      return player.player_type === 'mensalista' && player.status === 'ativo'
    case 'visitantes':
      return player.player_type === 'visitante'
    case 'goleiros':
      return player.position === 'goleiro' && player.status === 'ativo'
    case 'inativos':
      return player.status === 'inativo'
    default:
      return player.status === 'ativo'
  }
}

export function PlayersPage() {
  const { snapshot, stats, isAdmin } = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [formOpen, setFormOpen] = useState(false)

  const players = useMemo(() => {
    const term = search.trim().toLowerCase()
    return snapshot.players
      .filter((player) => matches(player, filter))
      .filter(
        (player) =>
          !term ||
          player.full_name.toLowerCase().includes(term) ||
          player.username.toLowerCase().includes(term),
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [snapshot.players, filter, search])

  return (
    <Page
      title="Elenco"
      subtitle={`${players.length} jogadores`}
      profile
      action={
        isAdmin ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            aria-label="Cadastrar jogador"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink"
          >
            <IconPlus className="size-6" />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogador"
            type="search"
            className="pl-11"
          />
        </div>
        <ChipBar value={filter} options={FILTERS} onChange={setFilter} />
      </div>

      <div className="mt-4">
        {players.length === 0 ? (
          <EmptyState
            title="Nenhum jogador encontrado"
            description={isAdmin ? 'Toque em + para cadastrar.' : 'Tente outro filtro.'}
          />
        ) : (
          <ListGroup>
            {players.map((player) => {
              const entry = stats.get(player.id)
              const summary =
                player.position === 'goleiro'
                  ? `${entry?.played ?? 0} jogos · ${entry?.goalsAgainst ?? 0} sofridos`
                  : `${entry?.played ?? 0} jogos · ${entry?.goals ?? 0} gols · ${entry?.assists ?? 0} assist.`
              return (
                <PlayerRow
                  key={player.id}
                  player={player}
                  subtitle={
                    entry && entry.played > 0 ? summary : playerCaption(player, 'sem partidas')
                  }
                  to={`/jogadores/${player.id}`}
                  chevron
                />
              )
            })}
          </ListGroup>
        )}
      </div>

      {formOpen && <PlayerFormModal player={null} onClose={() => setFormOpen(false)} />}
    </Page>
  )
}
