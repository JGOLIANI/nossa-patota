import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog } from '../components/Modal'
import { Page } from '../components/Page'
import { PlayerFormModal } from '../components/PlayerFormModal'
import { IconEdit } from '../components/icons'
import {
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  Note,
  SectionHeader,
  Stat,
  StatRow,
} from '../components/ui'
import { awardCounts } from '../domain/awards'
import { findRound } from '../domain/selectors'
import { playerHistory } from '../domain/stats'
import { cn } from '../lib/cn'
import { decimal, formatDate, percent } from '../lib/format'
import { useApp } from '../store/useApp'
import { AWARD_LABELS, AWARD_SHORT_LABELS, DEFAULT_PASSWORD, type AwardType } from '../types'

const FOOT = { direita: 'Destro', esquerda: 'Canhoto', ambidestro: 'Ambidestro' }

const RESULT = {
  V: { label: 'V', className: 'bg-win/15 text-win' },
  E: { label: 'E', className: 'bg-fill text-muted' },
  D: { label: 'D', className: 'bg-loss/15 text-loss' },
}

export function PlayerDetailPage() {
  const { playerId } = useParams()
  const { snapshot, stats, isAdmin, demoMode, actions } = useApp()
  const [editing, setEditing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetDone, setResetDone] = useState('')
  const [resetError, setResetError] = useState('')

  const player = snapshot.players.find((item) => item.id === playerId)
  if (!player) {
    return (
      <Page title="Jogador" back>
        <EmptyState title="Jogador não encontrado" />
      </Page>
    )
  }

  const entry = stats.get(player.id)!
  const history = playerHistory(snapshot, player.id).slice(0, 8)
  const awards = awardCounts(snapshot, player.id)
  // A posição do cadastro é só o padrão: quem já pegou no gol ganha o bloco
  // de goleiro, e todo mundo tem gols e assistências, inclusive o goleiro.
  const playedInGoal = entry.keeperMatches > 0

  async function resetPassword() {
    if (!player) return
    setConfirmReset(false)
    setResetError('')
    try {
      await actions.setPlayerPassword(player.id, DEFAULT_PASSWORD)
      setResetDone(
        `Senha de ${player.full_name} redefinida para "${DEFAULT_PASSWORD}". Passe para ele — ao entrar, o aplicativo pede uma nova.`,
      )
    } catch (cause) {
      setResetError(
        cause instanceof Error ? cause.message : 'Não foi possível redefinir a senha.',
      )
    }
  }

  const description = [
    player.position === 'goleiro' ? 'Goleiro' : 'Jogador de linha',
    player.player_type === 'mensalista' ? 'Mensalista' : 'Visitante',
    FOOT[player.dominant_foot],
    player.status === 'inativo' ? 'Inativo' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Page
      title="Perfil"
      back
      action={
        isAdmin ? (
          <IconButton label="Editar jogador" onClick={() => setEditing(true)}>
            <IconEdit className="size-5" />
          </IconButton>
        ) : undefined
      }
    >
      <div className="space-y-7">
        <div className="flex flex-col items-center text-center">
          <Avatar player={player} size="xl" />
          <h2 className="mt-3 text-title2 text-ink">{player.full_name}</h2>
          <p className="mt-1 text-subhead text-muted">{description}</p>
        </div>

        <Card className="p-4">
          <StatRow>
            <Stat label="Jogos" value={entry.played} />
            <Stat label="Vitórias" value={entry.wins} tone="win" />
            <Stat label="Empates" value={entry.draws} />
            <Stat label="Derrotas" value={entry.losses} tone="loss" />
          </StatRow>
          <div className="hairline my-3.5 h-px" />
          <StatRow>
            <Stat label="Gols" value={entry.goals} />
            <Stat label="Assistências" value={entry.assists} />
            <Stat label="Participações" value={entry.participations} />
            <Stat label="Aproveitamento" value={percent(entry.pointsPct)} tone="brand" />
          </StatRow>

          {playedInGoal && (
            <>
              <div className="hairline my-3.5 h-px" />
              <p className="mb-2.5 text-center text-footnote text-muted">
                Como goleiro · {entry.keeperMatches} jogo(s)
              </p>
              <StatRow>
                <Stat label="Gols sofridos" value={entry.goalsAgainst} />
                <Stat label="Sem sofrer" value={entry.cleanSheets} />
                <Stat label="Média sofrida" value={decimal(entry.goalsAgainstPerMatch)} />
              </StatRow>
            </>
          )}
        </Card>

        <section>
          <SectionHeader title="Premiações" />
          <Card className="p-4">
            <StatRow>
              {(Object.keys(AWARD_LABELS) as AwardType[]).map((type) => (
                <Stat key={type} label={AWARD_SHORT_LABELS[type]} value={awards[type]} />
              ))}
            </StatRow>
          </Card>
        </section>

        <section>
          <SectionHeader title="Últimas partidas" />
          {history.length === 0 ? (
            <EmptyState title="Ainda não entrou em campo" />
          ) : (
            <ListGroup>
              {history.map((item) => {
                const round = findRound(snapshot, item.roundId)
                const result = RESULT[item.result]
                return (
                  <ListRow
                    key={item.matchId}
                    to={`/rodadas/${item.roundId}`}
                    leading={
                      <span
                        className={cn(
                          'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-subhead font-semibold',
                          result.className,
                        )}
                      >
                        {result.label}
                      </span>
                    }
                    title={
                      <span className="font-rounded tabular-nums">
                        {item.scoreFor} – {item.scoreAgainst}
                      </span>
                    }
                    subtitle={round ? `${round.title} · ${formatDate(round.date)}` : undefined}
                    trailing={
                      item.goals > 0 || item.assists > 0 ? (
                        <span className="text-footnote text-muted">
                          {item.goals > 0 && `${item.goals}G`}
                          {item.goals > 0 && item.assists > 0 && ' '}
                          {item.assists > 0 && `${item.assists}A`}
                        </span>
                      ) : item.position === 'goleiro' && item.scoreAgainst === 0 ? (
                        <span className="text-footnote font-medium text-brand">Não sofreu</span>
                      ) : undefined
                    }
                  />
                )
              })}
            </ListGroup>
          )}
        </section>

        {isAdmin && (
          <section>
            <SectionHeader title="Acesso" />
            <ListGroup>
              <ListRow
                title="Nome de usuário"
                trailing={<span className="text-subhead text-muted">@{player.username}</span>}
              />
              {!demoMode &&
                (player.user_id ? (
                  <ListRow
                    onClick={() => {
                      setResetDone('')
                      setConfirmReset(true)
                    }}
                    title="Redefinir senha"
                    subtitle={
                      player.must_change_password
                        ? 'Está com a senha padrão e vai ter que trocar ao entrar'
                        : 'Aplica a senha padrão para quem esqueceu a sua'
                    }
                    chevron
                  />
                ) : (
                  <ListRow
                    title="Redefinir senha"
                    subtitle="Ainda não criou acesso, então não há senha a redefinir"
                  />
                ))}
              <ListRow to="/admin" title="Permissões" subtitle="Quem é administrador" chevron />
            </ListGroup>
            {resetDone && (
              <div className="mt-3">
                <Note>{resetDone}</Note>
              </div>
            )}
            {resetError && (
              <div className="mt-3">
                <Note tone="error">{resetError}</Note>
              </div>
            )}
          </section>
        )}
      </div>

      {editing && <PlayerFormModal player={player} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmReset}
        title="Redefinir senha"
        message={`A senha de ${player.full_name} passa a ser "${DEFAULT_PASSWORD}". A antiga deixa de funcionar na hora, e ao entrar ele terá que escolher uma nova.`}
        confirmLabel="Redefinir"
        destructive={false}
        onConfirm={resetPassword}
        onCancel={() => setConfirmReset(false)}
      />
    </Page>
  )
}
