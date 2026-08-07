import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { PlayerRow } from '../components/PlayerRow'
import { IconCheck, IconPlus } from '../components/icons'
import { Button, Card, ErrorText, Field, Input, Select } from '../components/ui'
import { todayISO } from '../lib/format'
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

export function RoundNewPage() {
  const { snapshot, actions } = useApp()
  const navigate = useNavigate()

  const [title, setTitle] = useState(`Rodada de ${new Date().toLocaleDateString('pt-BR')}`)
  const [date, setDate] = useState(todayISO())
  const [teamCount, setTeamCount] = useState(2)
  const [selected, setSelected] = useState<Set<string>>(new Set())
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
    setSelected(
      new Set(
        players.filter((player) => player.player_type === 'mensalista').map((p) => p.id),
      ),
    )
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
      const round = await actions.createRound({
        date,
        title: title.trim() || 'Rodada',
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
    <div className="pb-24">
      <PageHeader title="Nova rodada" back />

      <div className="space-y-4">
        <Field label="Nome da rodada">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Quantidade de times">
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
        </div>

        <Card>
          <p className="text-sm font-semibold text-slate-200">Visitante rápido</p>
          <p className="mt-0.5 mb-2 text-xs text-slate-400">
            Cadastro simplificado: só o nome. Ele já entra selecionado nesta rodada.
          </p>
          <div className="flex gap-2">
            <Input
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              placeholder="Nome do visitante"
            />
            <Button variant="secondary" onClick={addVisitor} disabled={busy || !visitorName.trim()}>
              <IconPlus className="size-5" />
            </Button>
          </div>
        </Card>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Participantes ({selected.size})
            </p>
            <button
              type="button"
              onClick={selectAllMonthly}
              className="text-xs text-emerald-400"
            >
              marcar mensalistas
            </button>
          </div>

          {keepersSelected < teamCount && (
            <p className="mb-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {keepersSelected === 0
                ? 'Nenhum goleiro selecionado — os times ficarão só com jogadores de linha.'
                : `Há ${keepersSelected} goleiro(s) para ${teamCount} times; alguns times ficarão sem goleiro fixo.`}
            </p>
          )}

          <div className="space-y-2">
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                selected={selected.has(player.id)}
                onClick={() => toggle(player.id)}
                subtitle={`Nível ${player.level}`}
                right={
                  selected.has(player.id) ? (
                    <IconCheck className="size-5 text-emerald-400" />
                  ) : null
                }
              />
            ))}
          </div>
        </div>

        <ErrorText>{error}</ErrorText>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg px-4">
        <Button size="lg" block onClick={create} disabled={busy}>
          {busy ? 'Gerando times…' : 'Criar rodada e gerar times'}
        </Button>
      </div>
    </div>
  )
}
