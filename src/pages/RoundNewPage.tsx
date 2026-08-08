import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { ActionBar, Button, Card, Field, Input, Note, Select } from '../components/ui'
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

  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState(settings.start_time)
  const [location, setLocation] = useState(settings.location)
  const [maxPlayers, setMaxPlayers] = useState(String(settings.max_players))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setError('')
    setBusy(true)
    try {
      const round = await actions.createRound({
        date,
        title: roundTitle(date),
        start_time: startTime,
        location: location.trim(),
        team_count: 2,
        max_players: Number(maxPlayers) || 0,
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
      <div className="space-y-4">
        <Card className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Horário">
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Local">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Quadra do Zé"
            />
          </Field>

          <Field label="Vagas" hint="Quem confirmar depois disso entra na lista de espera.">
            <Select value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)}>
              <option value="0">Sem limite</option>
              {[8, 10, 12, 14, 16, 18, 20, 24].map((count) => (
                <option key={count} value={count}>
                  {count} jogadores
                </option>
              ))}
            </Select>
          </Field>
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
