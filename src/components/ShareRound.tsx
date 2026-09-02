import { useState } from 'react'
import { AWARD_TYPES, votingDeadline, votingState } from '../domain/awards'
import {
  playerMap,
  positionInRound,
  roundAwards,
  roundMatches,
  roundTeams,
  teamPlayers,
} from '../domain/selectors'
import { computeStats } from '../domain/stats'
import { formatDate, formatWeekday, plural } from '../lib/format'
import {
  drawLineupCard,
  drawRoundCard,
  shareImage,
  type AwardLine,
  type MatchLine,
} from '../lib/shareCard'
import { useApp } from '../store/useApp'
import { AWARD_LABELS, type Round } from '../types'
import { IconShare } from './icons'
import { Button, Note } from './ui'

/** "sáb., 14:00" — o suficiente para saber se ainda dá tempo de votar. */
function formatDeadline(deadline: Date): string {
  return deadline.toLocaleString('pt-BR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Gera a imagem da rodada e chama o compartilhamento do aparelho — no
 * celular cai direto no WhatsApp; no desktop, baixa o arquivo.
 *
 * A mensagem que vai junto não repete a imagem: ela traz o que se lê sem
 * abrir nada (o placar, o horário) e diz o que fazer em seguida — confirmar
 * presença, ou votar antes de a urna fechar.
 */
export function ShareRound({ round, kind }: { round: Round; kind: 'escalacao' | 'resultado' }) {
  const { snapshot } = useApp()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const when = [
    `${formatWeekday(round.date)}, ${formatDate(round.date)}`,
    round.start_time,
    round.location,
  ]
    .filter(Boolean)
    .join(' · ')

  const header = { title: round.title, subtitle: when }

  async function share() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const built = kind === 'escalacao' ? await buildLineup() : await buildResult()
      const result = await shareImage(built.blob, `${kind}-${round.date}.png`, built.text)
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
        position: positionInRound(snapshot, round.id, player.id),
        photoUrl: player.photo_url,
      })),
    }))

    const total = teams.reduce((sum, team) => sum + team.players.length, 0)
    const text = [
      `⚽ *Nossa Patota* — ${round.title}`,
      `🗓 ${when}`,
      `👥 ${plural(total, 'jogador', 'jogadores')} em quadra`,
      '',
      'Os times estão na imagem. Quem não puder ir, avisa no grupo.',
    ].join('\n')

    return { blob: await drawLineupCard(header, teams), text }
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
    const awards: AwardLine[] = AWARD_TYPES.map((type) => ({
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

    // O rodapé do cartão e a última linha da mensagem dizem a mesma coisa: o
    // que fazer agora. Enquanto a urna está aberta, isso é votar.
    const state = votingState(round)
    const deadline = votingDeadline(round)
    const callToAction =
      state === 'aberta' && deadline
        ? `🗳️ Votação dos destaques aberta até ${formatDeadline(deadline)}. Vote pelo aplicativo.`
        : ''
    const footer =
      state === 'aberta' && deadline
        ? `Votação aberta até ${formatDeadline(deadline)}`
        : `${plural(scorers.reduce((sum, entry) => sum + entry.goals, 0), 'gol', 'gols')} na partida`

    const scoreLine = matches
      .map((match) => `${match.home} ${match.scoreHome} × ${match.scoreAway} ${match.away}`)
      .join('\n')
    const podium = awards
      .filter((award) => award.names.length > 0)
      .map((award) => `🏅 ${award.label}: ${award.names.join(', ')}`)
    const topScorers = scorers
      .slice(0, 3)
      .map((entry) => `${entry.name} (${entry.goals})`)
      .join(', ')

    const text = [
      `🏆 *Nossa Patota* — ${round.title}`,
      scoreLine,
      ...(topScorers ? ['', `⚽ Artilharia: ${topScorers}`] : []),
      ...(podium.length > 0 ? ['', ...podium] : []),
      ...(callToAction ? ['', callToAction] : []),
    ].join('\n')

    return { blob: await drawRoundCard(header, matches, awards, scorers, footer), text }
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
