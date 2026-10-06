import { useMemo, useState } from 'react'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { ChipBar, EmptyState, ListGroup } from '../components/ui'
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
    <Page title="Rankings" profile>
      <ChipBar
        value={active}
        onChange={setActive}
        options={rankings.map((item) => ({ value: item.key, label: item.title }))}
      />

      {list && (
        <>
          <p className="mt-3 mb-4 px-1 text-footnote text-muted">{list.description}</p>

          {list.entries.length === 0 ? (
            <EmptyState
              title="Sem dados ainda"
              description="Encerre uma partida para alimentar os rankings."
            />
          ) : (
            <ListGroup>
              {list.entries.map((entry, index) => {
                const player = byId.get(entry.playerId)
                if (!player) return null
                return (
                  <PlayerRow
                    key={entry.playerId}
                    player={player}
                    rank={index + 1}
                    to={`/jogadores/${player.id}`}
                    subtitle={player.position === 'goleiro' ? 'Goleiro' : 'Linha'}
                    trailing={
                      <span className="font-rounded text-title3 tabular-nums text-ink">
                        {entry.display}
                      </span>
                    }
                  />
                )
              })}
            </ListGroup>
          )}
        </>
      )}
    </Page>
  )
}
