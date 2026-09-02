import { useState } from 'react'
import { AWARD_TYPES, computeRoundAwards } from '../domain/awards'
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
  drawRoundCard,
  shareImage,
  shareText,
  type AwardLine,
  type MatchLine,
} from '../lib/shareCard'
import { useApp } from '../store/useApp'
import { AWARD_LABELS, type Round } from '../types'
import { IconShare } from './icons'
import { Button, Note } from './ui'

/**
 * Chama o compartilhamento do aparelho — no celular cai direto no WhatsApp.
 *
 * A escalação vai só como mensagem. Ela é uma lista de nomes, e lista de
 * nomes se lê, se responde e se procura no texto; virada imagem, chegava no
 * grupo como uma miniatura que ninguém abre. O resultado continua com o
 * cartão: ali o que interessa é o placar, e ele é para ser visto de longe.
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
      if (kind === 'escalacao') {
        const result = await shareText(lineupText())
        if (result === 'copied') setMessage('Mensagem copiada. É só colar no grupo.')
        return
      }
      const built = await buildResult()
      const result = await shareImage(built.blob, `${kind}-${round.date}.png`, built.text)
      if (result === 'downloaded') setMessage('Imagem baixada. É só enviar no grupo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível compartilhar.')
    } finally {
      setBusy(false)
    }
  }

  function lineupText() {
    const teams = roundTeams(snapshot, round.id).map((team) => ({
      name: team.name,
      players: teamPlayers(snapshot, team.id)
        .map((player) => ({
          name: player.full_name,
          position: positionInRound(snapshot, round.id, player.id),
        }))
        // Quem abre a lista é quem ficou no gol nesta partida, e não quem é
        // goleiro no cadastro: era o goleiro de carteirinha que vinha em
        // primeiro sem a marcação, e o que pegou a luva no dia vinha no meio
        // com ela.
        .sort((a, b) => {
          if (a.position !== b.position) return a.position === 'goleiro' ? -1 : 1
          return a.name.localeCompare(b.name)
        }),
    }))

    const total = teams.reduce((sum, team) => sum + team.players.length, 0)

    const lineup = teams.flatMap((team) => [
      '',
      `*${team.name}*`,
      ...team.players.map((player) =>
        player.position === 'goleiro' ? `${player.name} (goleiro)` : player.name,
      ),
    ])

    return [
      `⚽ *Nossa Patota* — ${round.title}`,
      `🗓 ${when}`,
      `👥 ${plural(total, 'jogador', 'jogadores')} em quadra`,
      ...lineup,
      '',
      'Quem não puder ir, avisa no grupo.',
    ].join('\n')
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
    /*
     * Vale o que foi gravado; enquanto a apuração não virou linha no banco,
     * vale o mesmo cálculo que a tela mostra.
     *
     * A urna fecha pelo relógio, mas gravar depende de um administrador abrir
     * o aplicativo. Lendo só as linhas gravadas, quem compartilhasse nesse
     * intervalo mandaria para o grupo um resultado sem destaque nenhum,
     * diferente do que estava vendo na tela.
     */
    const computed = computeRoundAwards(snapshot, round.id)
    const decided: Record<string, string[]> = round.awards_settled_at
      ? roundAwards(snapshot, round.id).reduce<Record<string, string[]>>((acc, award) => {
          acc[award.type] = [...(acc[award.type] ?? []), award.player_id]
          return acc
        }, {})
      : Object.fromEntries(
          Object.entries(computed).map(([type, playerId]) => [type, playerId ? [playerId] : []]),
        )

    const awards: AwardLine[] = AWARD_TYPES.map((type) => ({
      label: AWARD_LABELS[type],
      names: (decided[type] ?? [])
        .map((playerId) => byId.get(playerId)?.full_name)
        .filter((name) => name !== undefined),
    }))

    const stats = computeStats(snapshot, { roundId: round.id })
    const scorers = [...stats.values()]
      .filter((entry) => entry.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .map((entry) => ({ name: byId.get(entry.playerId)?.full_name ?? '—', goals: entry.goals }))

    // O resultado só sai depois da urna fechada, então aqui ele é sempre
    // definitivo: o rodapé conta a partida, não o que ainda falta fazer.
    const goals = scorers.reduce((sum, entry) => sum + entry.goals, 0)
    const footer = `${plural(goals, 'gol')} na partida`

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
    ].join('\n')

    return { blob: await drawRoundCard(header, matches, awards, scorers, footer), text }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" block onClick={share} disabled={busy}>
        <IconShare className="size-5" />
        {kind === 'escalacao'
          ? busy
            ? 'Compartilhando…'
            : 'Compartilhar escalações'
          : busy
            ? 'Gerando imagem…'
            : 'Compartilhar resultado'}
      </Button>
      {message && <Note>{message}</Note>}
      {error && <Note tone="error">{error}</Note>}
    </div>
  )
}
