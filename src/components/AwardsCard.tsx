import { Link } from 'react-router-dom'
import {
  AWARD_TYPES,
  awardCandidates,
  canVote,
  tallyAward,
  votesByVoter,
  voterTurnout,
  votingDeadline,
  votingState,
} from '../domain/awards'
import { findRound, playerMap, roundAwards } from '../domain/selectors'
import { cn } from '../lib/cn'
import { plural, timeLeft } from '../lib/format'
import { useApp } from '../store/useApp'
import type { AwardType, Snapshot } from '../types'
import { AWARD_LABELS } from '../types'
import { Avatar } from './Avatar'
import { IconGlove, IconGoldenBall, IconPuncturedBall } from './icons'
import { Card, EmptyState, Note, SectionHeader } from './ui'

const STYLES: Record<AwardType, { tone: string; Icon: typeof IconGlove; ask: string }> = {
  jogador_rodada: {
    tone: 'text-gold',
    Icon: IconGoldenBall,
    ask: 'Quem jogou mais?',
  },
  goleiro_menos_vazado: {
    tone: 'text-brand',
    Icon: IconGlove,
    ask: 'Qual goleiro segurou melhor?',
  },
  pior_jogador: {
    tone: 'text-muted',
    Icon: IconPuncturedBall,
    ask: 'Quem passou em branco?',
  },
}

/**
 * Os prêmios da rodada: a cédula enquanto a urna está aberta, o resultado
 * depois dela.
 *
 * Quem decide é a patota, mas não só ela: a nota de cada candidato mistura a
 * fatia de votos com a estatística da rodada. Por isso o cartão mostra as
 * duas coisas — o número de votos que a pessoa recebeu e o que ela fez em
 * quadra —, para que o resultado nunca pareça ter saído do nada.
 */
export function AwardsCard({ snapshot, roundId }: { snapshot: Snapshot; roundId: string }) {
  const { currentPlayer, actions } = useApp()
  const round = findRound(snapshot, roundId)
  const byId = playerMap(snapshot)

  if (!round) return null

  const state = votingState(round)
  const deadline = votingDeadline(round)

  if (state === 'nao-comecou') {
    return (
      <EmptyState
        title="A votação ainda não abriu"
        description="Assim que a partida for encerrada, quem jogou tem 16 horas para escolher os destaques."
      />
    )
  }

  const open = state === 'aberta'
  const eligible = currentPlayer ? canVote(snapshot, roundId, currentPlayer.id) : false
  const myVotes = currentPlayer ? votesByVoter(snapshot, roundId, currentPlayer.id) : {}
  const turnout = voterTurnout(snapshot, roundId)
  const candidates = awardCandidates(snapshot, roundId)
  // Depois da apuração vale o que foi gravado; antes dela, o cálculo ao vivo.
  // Os dois dão no mesmo número — a diferença é só quem já pôde escrever.
  const settled = roundAwards(snapshot, roundId)

  async function vote(type: AwardType, playerId: string) {
    if (myVotes[type] === playerId) await actions.clearVote(roundId, type)
    else await actions.castVote(roundId, type, playerId)
  }

  return (
    <div className="space-y-6">
      {open ? (
        <Note>
          <strong>Votação aberta</strong> — encerra em {deadline ? timeLeft(deadline) : '—'}.{' '}
          {turnout.voted} de {turnout.total} já
          {turnout.voted === 1 ? ' votou' : ' votaram'}. A nota final junta os votos com o que
          cada um fez em quadra.
        </Note>
      ) : (
        <Note>
          <strong>Votação encerrada.</strong> O resultado abaixo junta os votos de quem jogou com
          a estatística da rodada.
        </Note>
      )}

      {open && !eligible && (
        <Note tone="warn">
          Só quem foi escalado nesta partida vota. Você pode acompanhar o resultado por aqui.
        </Note>
      )}

      {AWARD_TYPES.map((type) => {
        const { tone, Icon, ask } = STYLES[type]
        const tally = tallyAward(snapshot, roundId, type)
        const pool = candidates[type]
        const winners = settled.length > 0
          ? settled.filter((award) => award.type === type).map((award) => award.player_id)
          : tally.winners

        return (
          <section key={type}>
            <SectionHeader title={AWARD_LABELS[type]} />
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <Icon className={cn('size-7 shrink-0', tone)} />
                <p className="text-subhead text-muted">
                  {open && eligible ? ask : plural(tally.totalVotes, 'voto')}
                </p>
              </div>

              {pool.length === 0 ? (
                <p className="border-t-2 border-line px-4 py-4 text-footnote text-muted">
                  Ninguém elegível: o prêmio não sai nesta partida.
                </p>
              ) : (
                <ul className="list-group border-t-2 border-line">
                  {tally.entries.map((entry) => {
                    const player = byId.get(entry.playerId)
                    if (!player) return null
                    const mine = myVotes[type] === entry.playerId
                    const won = !open && winners.includes(entry.playerId)
                    const self = currentPlayer?.id === entry.playerId
                    const canPick = open && eligible && !self

                    const body = (
                      <>
                        <Avatar player={player} size="md" />
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-headline text-ink">
                            {player.full_name}
                            {won && <span className="ml-2 text-caption2 text-brand">VENCEU</span>}
                          </span>
                          <span className="block truncate text-footnote text-muted">
                            {plural(entry.votes, 'voto')}
                            {!open && ` · nota ${Math.round(entry.score * 100)}`}
                          </span>
                        </span>
                        {mine && (
                          <span className="shrink-0 text-caption2 text-brand uppercase">
                            Meu voto
                          </span>
                        )}
                      </>
                    )

                    const shell = cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left',
                      mine && 'bg-brand-soft',
                      won && !mine && 'bg-gold-soft',
                    )

                    if (canPick) {
                      return (
                        <li key={entry.playerId}>
                          <button
                            type="button"
                            aria-pressed={mine}
                            onClick={() => vote(type, entry.playerId)}
                            className={cn(shell, 'transition duration-200 ease-ios active:bg-fill')}
                          >
                            {body}
                          </button>
                        </li>
                      )
                    }

                    return (
                      <li key={entry.playerId}>
                        <Link to={`/jogadores/${player.id}`} className={shell}>
                          {body}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </section>
        )
      })}
    </div>
  )
}
