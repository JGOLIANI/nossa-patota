import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PlayerFormModal } from '../components/PlayerFormModal'
import { PlayerRow } from '../components/PlayerRow'
import { IconPlus } from '../components/icons'
import { EmptyState, Input, Segmented } from '../components/ui'
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
  const [editing, setEditing] = useState<Player | null>(null)
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
    <div>
      <PageHeader
        title="Jogadores"
        subtitle={`${players.length} na lista`}
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="inline-flex size-11 items-center justify-center rounded-xl bg-emerald-500 text-slate-950"
              aria-label="Cadastrar jogador"
            >
              <IconPlus className="size-6" />
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou usuário"
          type="search"
        />
        <Segmented value={filter} options={FILTERS} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-2">
        {players.length === 0 ? (
          <EmptyState
            title="Nenhum jogador encontrado"
            description={
              isAdmin ? 'Cadastre o primeiro jogador no botão +.' : 'Tente outro filtro.'
            }
          />
        ) : (
          players.map((player) => {
            const entry = stats.get(player.id)
            const summary =
              player.position === 'goleiro'
                ? `${entry?.played ?? 0} jogos · ${entry?.goalsAgainst ?? 0} sofridos`
                : `${entry?.played ?? 0} jogos · ${entry?.goals ?? 0} gols · ${entry?.assists ?? 0} assist.`
            return (
              <PlayerRow
                key={player.id}
                player={player}
                subtitle={summary}
                to={`/jogadores/${player.id}`}
              />
            )
          })
        )}
      </div>

      {formOpen && <PlayerFormModal player={editing} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
