import { useState } from 'react'
import { Page } from '../components/Page'
import { ActionBar, Button, Card, Field, Input, ListGroup, Note, Select } from '../components/ui'
import { missingRoundDates, nextOccurrences } from '../domain/schedule'
import { formatDate, todayISO } from '../lib/format'
import { useApp } from '../store/useApp'
import { WEEKDAYS } from '../types'

/**
 * Agenda da patota.
 *
 * O administrador descreve o compromisso uma vez — dia, horário, local e
 * vagas — e o sistema passa a manter as próximas rodadas criadas sozinho.
 */
export function SettingsPage() {
  const { snapshot, actions } = useApp()
  const { settings } = snapshot

  const [weekday, setWeekday] = useState(String(settings.weekday))
  const [startTime, setStartTime] = useState(settings.start_time)
  const [location, setLocation] = useState(settings.location)
  const [maxPlayers, setMaxPlayers] = useState(String(settings.max_players))
  const [weeksAhead, setWeeksAhead] = useState(String(settings.weeks_ahead))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const preview = nextOccurrences(Number(weekday), todayISO(), Math.min(Number(weeksAhead), 4))

  async function save() {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const patch = {
        weekday: Number(weekday),
        start_time: startTime,
        location: location.trim(),
        max_players: Number(maxPlayers) || 0,
        weeks_ahead: Number(weeksAhead),
      }
      const pending = missingRoundDates(
        { ...settings, ...patch },
        snapshot.rounds,
        todayISO(),
      ).length
      await actions.updateSettings(patch)
      setMessage(
        pending > 0
          ? `Agenda salva. ${pending} rodada(s) criada(s) automaticamente.`
          : 'Agenda salva.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a agenda.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Agenda da patota" subtitle="O sistema cria as rodadas por você" back>
      <div className="space-y-5 pb-20">
        <Card className="space-y-4 p-4">
          <Field label="Dia da semana">
            <Select value={weekday} onChange={(event) => setWeekday(event.target.value)}>
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Horário">
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
            <Field label="Vagas">
              <Select value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)}>
                <option value="0">Sem limite</option>
                {[8, 10, 12, 14, 16, 18, 20, 24].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Local">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Quadra do Zé, rua das Flores 120"
            />
          </Field>

          <Field
            label="Criar com quanta antecedência"
            hint="Rodadas futuras já disponíveis para os jogadores confirmarem."
          >
            <Select value={weeksAhead} onChange={(event) => setWeeksAhead(event.target.value)}>
              <option value="0">Não criar automaticamente</option>
              {[1, 2, 3, 4, 6, 8].map((weeks) => (
                <option key={weeks} value={weeks}>
                  {weeks} semana{weeks > 1 ? 's' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        {Number(weeksAhead) > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-title3 text-ink">Próximas rodadas</h2>
            <ListGroup>
              {preview.map((date) => (
                <p key={date} className="px-4 py-3 text-subhead text-muted">
                  {formatDate(date)} às {startTime}
                  {location.trim() && ` · ${location.trim()}`}
                </p>
              ))}
            </ListGroup>
          </section>
        )}

        {message && <Note>{message}</Note>}
        {error && <Note tone="error">{error}</Note>}

        <Note tone="warn">
          As rodadas são criadas quando um administrador abre o aplicativo — planos gratuitos não
          executam tarefas agendadas no servidor.
        </Note>
      </div>

      <ActionBar>
        <Button size="lg" block onClick={save} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar agenda'}
        </Button>
      </ActionBar>
    </Page>
  )
}
