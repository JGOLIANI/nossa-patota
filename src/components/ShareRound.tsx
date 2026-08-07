import { useState } from 'react'
import { playerMap, roundAwards, roundMatches, roundTeams, teamPlayers } from '../domain/selectors'
import { computeStats } from '../domain/stats'
import { formatDate, formatWeekday } from '../lib/format'
import {
  drawLineupCard,
  drawRoundCard,
  shareImage,
  type AwardLine,
  type MatchLine,
} from '../lib/shareCard'
import { useApp } from '../store/useApp'
import { AWARD_LABELS, type AwardType, type Round } from '../types'
import { IconShare } from './icons'
import { Button, Note } from './ui'

const AWARD_ORDER: AwardType[] = ['jogador_rodada', 'goleiro_menos_vazado', 'pior_jogador']

/**
 * Gera a imagem da rodada e chama o compartilhamento do aparelho — no
 * celular cai direto no WhatsApp; no desktop, baixa o arquivo.
 */
export function ShareRound({ round, kind }: { round: Round; kind: 'escalacao' | 'resultado' }) {
  const { snapshot } = useApp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const header = {
    title: round.title,
    subtitle: [
      `${formatWeekday(round.date)}, ${formatDate(round.date)}`,
      round.start_time,
      round.location,
    ]
      .filter(Boolean)
      .join(' · '),
  }

  async function share() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const blob =
        kind === 'escalacao' ? await buildLineup() : await buildResult()
      const result = await shareImage(
        blob,
        `${kind}-${round.date}.png`,
        `${round.title} — ${header.subtitle}`,
      )
      if (result === 'downloaded') setMessage('Imagem baixada. É só enviar no grupo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  async function buildLineup() {
    const teams = roundTeams(snapshot, round.id).map((team) => ({
      name: team.name,
      color: team.color,
      players: teamPlayers(snapshot, team.id).map((player) => ({
        name: player.full_name,
        position: player.position,
        photoUrl: player.photo_url,
      })),
    }))
    return drawLineupCard(header, teams)
  }

  async function buildResult() {
    const teams = roundTeams(snapshot, round.id)
    const byTeam = new Map(teams.map((team) => [team.id, team]))

    const matches: MatchLine[] = roundMatches(snapshot, round.id).map((match) => ({
      home: byTeam.get(match.team_a_id)?.name ?? '—',
      away: byTeam.get(match.team_b_id)?.name ?? '—',
      homeColor: byTeam.get(match.team_a_id)?.color ?? '#888888',
      awayColor: byTeam.get(match.team_b_id)?.color ?? '#888888',
      scoreHome: match.score_a,
      scoreAway: match.score_b,
    }))

    const byId = playerMap(snapshot)
    const awardRows = roundAwards(snapshot, round.id)
    const awards: AwardLine[] = AWARD_ORDER.map((type) => ({
      label: AWARD_LABELS[type],
      names: awardRows
        .filter((award) => award.type === type)
        .map((award) => byId.get(award.player_id)?.full_name)
        .filter((name) => name !== undefined),
    }))

    const stats = computeStats(snapshot, { roundId: round.id })
    const scorers = [...stats.values()]
      .filter((entry) => entry.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .map((entry) => ({ name: byId.get(entry.playerId)?.full_name ?? '—', goals: entry.goals }))

    return drawRoundCard(header, matches, awards, scorers)
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" block onClick={share} disabled={busy}>
        <IconShare className="size-5" />
        {busy
          ? 'Gerando imagem…'
          : kind === 'escalacao'
            ? 'Compartilhar escalações'
            : 'Compartilhar resultado'}
      </Button>
      {message && <Note>{message}</Note>}
      {error && <Note tone="error">{error}</Note>}
    </div>
  )
}
