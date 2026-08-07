import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../components/Page'
import { PlayerRow } from '../components/PlayerRow'
import { IconCheck, IconPlus } from '../components/icons'
import {
  ActionBar,
  Button,
  Card,
  Field,
  Input,
  ListGroup,
  ListRow,
  Note,
  SectionHeader,
  Select,
} from '../components/ui'
import { formatDate, todayISO } from '../lib/format'
import { playerCaption } from '../lib/player'
import { useApp } from '../store/useApp'

function usernameFrom(fullName: string): string {
  const base = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9.]/g, '')
  return base || `visitante.${Date.now().toString().slice(-4)}`
}

/** Círculo de seleção à direita da linha, no lugar de um checkbox do sistema. */
function Check({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? 'inline-flex size-6 items-center justify-center rounded-full bg-brand text-brand-ink'
          : 'inline-flex size-6 items-center justify-center rounded-full border-2 border-line'
      }
    >
      {on && <IconCheck className="size-4" />}
    </span>
  )
}

export function RoundNewPage() {
  const { snapshot, actions } = useApp()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayISO())
  const [teamCount, setTeamCount] = useState(2)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [visitorOpen, setVisitorOpen] = useState(false)
  const [visitorName, setVisitorName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const players = useMemo(
    () =>
      snapshot.players
        .filter((player) => player.status === 'ativo')
        .sort((a, b) => {
          if (a.position !== b.position) return a.position === 'goleiro' ? -1 : 1
          return a.full_name.localeCompare(b.full_name)
        }),
    [snapshot.players],
  )

  const keepersSelected = players.filter(
    (player) => selected.has(player.id) && player.position === 'goleiro',
  ).length

  function toggle(playerId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  function selectAllMonthly() {
    setSelected(new Set(players.filter((p) => p.player_type === 'mensalista').map((p) => p.id)))
  }

  async function addVisitor() {
    const name = visitorName.trim()
    if (!name) return
    setError('')
    setBusy(true)
    try {
      const created = await actions.createPlayer({
        full_name: name,
        username: usernameFrom(name),
        photo_url: null,
        player_type: 'visitante',
        dominant_foot: 'direita',
        position: 'linha',
        status: 'ativo',
        role: 'jogador',
        level: 3,
      })
      setSelected((current) => new Set(current).add(created.id))
      setVisitorName('')
      setVisitorOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o visitante.')
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    setError('')
    if (selected.size < teamCount) {
      setError(`Selecione ao menos ${teamCount} jogadores para formar ${teamCount} times.`)
      return
    }
    setBusy(true)
    try {
      // O nome sai da data: um campo a menos para preencher toda semana.
      const round = await actions.createRound({
        date,
        title: `Rodada de ${formatDate(date).slice(0, 5)}`,
        team_count: teamCount,
        playerIds: [...selected],
      })
      await actions.generateTeamsForRound(round.id, teamCount)
      navigate(`/rodadas/${round.id}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a rodada.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Nova rodada" back>
      <div className="space-y-6 pb-20">
        <Card className="grid grid-cols-2 gap-3 p-4">
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Times">
            <Select
              value={String(teamCount)}
              onChange={(event) => setTeamCount(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count} times
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <section>
          <SectionHeader
            title={`Quem vai jogar${selected.size > 0 ? ` · ${selected.size}` : ''}`}
            action={
              <button type="button" onClick={selectAllMonthly} className="text-sm font-medium text-brand">
                marcar mensalistas
              </button>
            }
          />

          {selected.size > 0 && keepersSelected < teamCount && (
            <div className="mb-3">
              <Note tone="warn">
                {keepersSelected === 0
                  ? 'Nenhum goleiro selecionado — os times ficarão só com jogadores de linha.'
                  : `${keepersSelected} goleiro(s) para ${teamCount} times: algum time ficará sem goleiro fixo.`}
              </Note>
            </div>
          )}

          <ListGroup>
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                selected={selected.has(player.id)}
                onClick={() => toggle(player.id)}
                subtitle={playerCaption(player, `nível ${player.level}`)}
                trailing={<Check on={selected.has(player.id)} />}
              />
            ))}

            {visitorOpen ? (
              <div className="flex items-center gap-2 p-3.5">
                <Input
                  autoFocus
                  value={visitorName}
                  onChange={(event) => setVisitorName(event.target.value)}
                  placeholder="Nome do visitante"
                />
                <Button onClick={addVisitor} disabled={busy || !visitorName.trim()}>
                  Incluir
                </Button>
              </div>
            ) : (
              <ListRow
                onClick={() => setVisitorOpen(true)}
                leading={
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-muted">
                    <IconPlus className="size-5" />
                  </span>
                }
                title="Adicionar visitante"
                subtitle="Cadastro rápido, só o nome"
              />
            )}
          </ListGroup>
        </section>

        {error && <Note tone="error">{error}</Note>}
      </div>

      <ActionBar>
        <Button size="lg" block onClick={create} disabled={busy || selected.size === 0}>
          {busy
            ? 'Montando os times…'
            : selected.size === 0
              ? 'Selecione os jogadores'
              : `Montar ${teamCount} times com ${selected.size}`}
        </Button>
      </ActionBar>
    </Page>
  )
}
