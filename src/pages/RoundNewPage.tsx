import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { RoundFields, type RoundDraft } from '../components/RoundFields'
import { ActionBar, Button, Card, Note } from '../components/ui'
import { roundTitle } from '../domain/schedule'
import { todayISO } from '../lib/format'
import { useApp } from '../store/useApp'

/**
 * Partida avulsa.
 *
 * O caminho normal é a patota ter dia fixo e o sistema criar as partidas
 * sozinho. Esta tela existe para o jogo extra — o amistoso de quarta, a
 * confraternização de fim de ano — e por isso pede o mínimo possível.
 */
export function RoundNewPage() {
  const { snapshot, actions } = useApp()
  const navigate = useNavigate()
  const { settings } = snapshot

  const [draft, setDraft] = useState<RoundDraft>({
    date: todayISO(),
    startTime: settings.start_time,
    location: settings.location,
    locationUrl: settings.location_url,
    maxPlayers: String(settings.max_players),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setError('')
    setBusy(true)
    try {
      const round = await actions.createRound({
        date: draft.date,
        title: roundTitle(draft.date),
        start_time: draft.startTime,
        location: draft.location.trim(),
        location_url: draft.locationUrl.trim(),
        team_count: 2,
        max_players: Number(draft.maxPlayers) || 0,
      })
      navigate(`/rodadas/${round.id}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a partida.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Partida avulsa" subtitle="Para um jogo fora do dia fixo" back>
      <div className="space-y-4 pb-32">
        <Card className="space-y-4 p-4">
          <RoundFields value={draft} onChange={setDraft} />
        </Card>

        <Note>
          Depois de criada, os jogadores confirmam presença sozinhos. Os times são gerados a
          partir de quem confirmou.
        </Note>

        {error && <Note tone="error">{error}</Note>}
      </div>

      <ActionBar>
        <Button size="lg" block onClick={create} disabled={busy}>
          {busy ? 'Criando…' : 'Criar partida'}
        </Button>
      </ActionBar>
    </Page>
  )
}
