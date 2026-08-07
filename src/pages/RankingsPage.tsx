import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PlayerRow } from '../components/PlayerRow'
import { EmptyState, Segmented } from '../components/ui'
import { buildRankings } from '../domain/rankings'
import { playerMap } from '../domain/selectors'
import { useApp } from '../store/useApp'

export function RankingsPage() {
  const { snapshot } = useApp()
  const rankings = useMemo(() => buildRankings(snapshot), [snapshot])
  const [active, setActive] = useState(rankings[0]?.key ?? 'artilheiro')
  const byId = playerMap(snapshot)

  const list = rankings.find((item) => item.key === active) ?? rankings[0]

  return (
    <div>
      <PageHeader title="Rankings" subtitle="Atualizados a cada rodada encerrada" />

      <Segmented
        value={active}
        onChange={setActive}
        options={rankings.map((item) => ({ value: item.key, label: item.title }))}
      />

      {list && (
        <>
          <p className="mt-3 mb-3 text-xs text-slate-500">{list.description}</p>

          {list.entries.length === 0 ? (
            <EmptyState
              title="Sem dados ainda"
              description="Encerre uma rodada para alimentar os rankings."
            />
          ) : (
            <div className="space-y-2">
              {list.entries.map((entry, index) => {
                const player = byId.get(entry.playerId)
                if (!player) return null
                return (
                  <PlayerRow
                    key={entry.playerId}
                    player={player}
                    rank={index + 1}
                    to={`/jogadores/${player.id}`}
                    right={
                      <span className="text-lg font-bold text-emerald-400 tabular-nums">
                        {entry.display}
                      </span>
                    }
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
