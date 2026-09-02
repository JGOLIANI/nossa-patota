import { useState } from 'react'
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
import { Card, EmptyState, ListGroup, Note, SectionHeader } from './ui'

const STYLES: Record<AwardType, { tone: string; Icon: typeof IconGlove; ask: string }> = {
  jogador_rodada: {
    tone: 'text-gold',
    Icon: IconGoldenBall,
    ask: 'Quem foi o craque?',
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
export function AwardsCard({
  snapshot,
  roundId,
  compact,
}: {
  snapshot: Snapshot
  roundId: string
  /**
   * Resumo de uma linha por prêmio, para a tela de início.
   *
   * Lá isto já vive dentro de uma seção chamada "Destaques": a cédula
   * inteira acrescentaria três subtítulos aninhados e meia tela de rolagem
   * ao que deveria ser um cartão de relance.
   */
  compact?: boolean
}) {
  const { currentPlayer, actions } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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
  /*
   * Depois da apuração vale o que foi gravado; antes dela, o cálculo ao vivo.
   * Os dois dão no mesmo número — a diferença é só quem já pôde escrever.
   *
   * Quem responde por "já apurou?" é a marca na rodada, e não a existência de
   * linhas de prêmio: uma partida em que ninguém se destacou é apurada com
   * zero prêmios, e ali contar linhas diria "ainda não" para sempre — a tela
   * mostraria vencedores ao vivo que nunca entraram no histórico.
   */
  const settledAwards = roundAwards(snapshot, roundId)
  const isSettled = Boolean(round.awards_settled_at)

  /**
   * O voto vai ao servidor, e o servidor pode recusar: a urna fechou entre a
   * tela carregar e o dedo tocar, o jogador saiu da escalação. Sem isto o
   * toque não fazia nada e ninguém ficava sabendo por quê.
   */
  if (compact) {
    if (open) {
      const mine = AWARD_TYPES.filter((type) => myVotes[type]).length
      return (
        <ListGroup>
          <div className="px-4 py-3.5">
            <p className="text-headline text-ink">
              Votação aberta · encerra em {deadline ? timeLeft(deadline) : '—'}
            </p>
            <p className="mt-0.5 text-footnote text-muted">
              {!eligible
                ? `${turnout.voted} de ${turnout.total} já ${turnout.voted === 1 ? 'votou' : 'votaram'}.`
                : mine === 0
                  ? 'Você ainda não votou. Abra a partida para escolher.'
                  : mine === AWARD_TYPES.length
                    ? 'Você já votou nos três prêmios.'
                    : `Você votou em ${mine} de ${AWARD_TYPES.length}. Abra a partida para completar.`}
            </p>
          </div>
        </ListGroup>
      )
    }

    const decided = AWARD_TYPES.map((type) => ({
      type,
      names: (isSettled
        ? settledAwards.filter((award) => award.type === type).map((award) => award.player_id)
        : tallyAward(snapshot, roundId, type).winners
      )
        .map((id) => byId.get(id))
        .filter((player) => player !== undefined),
    })).filter((row) => row.names.length > 0)

    if (decided.length === 0) {
      return <EmptyState title="Ninguém se destacou nesta partida" />
    }

    return (
      <ListGroup>
        {decided.map(({ type, names }) => {
          const { tone, Icon } = STYLES[type]
          return (
            <div key={type} className="flex items-center gap-3 px-4 py-3">
              <Icon className={cn('size-6 shrink-0', tone)} />
              <div className="min-w-0 flex-1">
                <p className="text-caption2 text-muted uppercase">{AWARD_LABELS[type]}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {names.map((player) => (
                    <Link
                      key={player.id}
                      to={`/jogadores/${player.id}`}
                      className="flex items-center gap-1.5"
                    >
                      <Avatar player={player} size="sm" />
                      <span className="text-subhead text-ink">{player.full_name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </ListGroup>
    )
  }

  async function vote(type: AwardType, playerId: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (myVotes[type] === playerId) await actions.clearVote(roundId, type)
      else await actions.castVote(roundId, type, playerId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar seu voto.')
    } finally {
      setBusy(false)
    }
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

      {error && <Note tone="error">{error}</Note>}

      {AWARD_TYPES.map((type) => {
        const { tone, Icon, ask } = STYLES[type]
        const tally = tallyAward(snapshot, roundId, type)
        const pool = candidates[type]
        const winners = isSettled
          ? settledAwards.filter((award) => award.type === type).map((award) => award.player_id)
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
                    const canPick = open && eligible && !self && !busy

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
