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
      players: teamPlayers(snapshot, team.id)
        .map((player) => ({
          name: player.full_name,
          position: positionInRound(snapshot, round.id, player.id),
          photoUrl: player.photo_url,
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

    /*
     * Os nomes vão na mensagem, e não só na imagem.
     *
     * No grupo a imagem chega como miniatura e nem todo mundo abre. O nome em
     * texto também é o que se procura com a busca do WhatsApp e o que o leitor
     * de tela alcança — a imagem, para os dois, não existe.
     */
    const lineup = teams.flatMap((team) => [
      '',
      `*${team.name}*`,
      ...team.players.map((player) =>
        player.position === 'goleiro' ? `${player.name} (goleiro)` : player.name,
      ),
    ])

    const text = [
      `⚽ *Nossa Patota* — ${round.title}`,
      `🗓 ${when}`,
      `👥 ${plural(total, 'jogador', 'jogadores')} em quadra`,
      ...lineup,
      '',
      'Quem não puder ir, avisa no grupo.',
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
    /*
     * Vale o que foi gravado; enquanto a apuração não virou linha no banco,
     * vale o mesmo cálculo que a tela mostra.
     *
     * A urna fecha pelo relógio, mas gravar depende de um administrador abrir
     * o aplicativo. Lendo só as linhas gravadas, quem compartilhasse nesse
     * intervalo mandaria para o grupo um resultado sem destaque nenhum,
     * diferente do que estava vendo na tela.
     */
    const decided = round.awards_settled_at
      ? roundAwards(snapshot, round.id).reduce<Record<string, string[]>>((acc, award) => {
          acc[award.type] = [...(acc[award.type] ?? []), award.player_id]
          return acc
        }, {})
      : computeRoundAwards(snapshot, round.id)

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
