import { useState } from 'react'
import { attendanceLists } from '../domain/attendance'
import { roundEntries } from '../domain/selectors'
import type { Round } from '../types'
import { useApp } from '../store/useApp'
import { Button, Note } from './ui'

/**
 * Resposta do jogador ao convite da rodada.
 *
 * Aparece na tela inicial e na rodada com o mesmo comportamento, porque é a
 * ação que o jogador comum mais faz — e a única que ele faz sozinho.
 */
export function AttendanceControl({ round }: { round: Round }) {
  const { snapshot, currentPlayer, actions } = useApp()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!currentPlayer || round.status === 'encerrada') return null

  const rows = roundEntries(snapshot, round.id)
  const lists = attendanceLists(rows)
  const mine = rows.find((rp) => rp.player_id === currentPlayer.id)?.attendance ?? null

  const waitingPosition =
    mine === 'espera'
      ? lists.waiting.findIndex((row) => row.player_id === currentPlayer.id) + 1
      : 0

  async function respond(wants: 'confirmado' | 'fora') {
    setError('')
    setBusy(true)
    try {
      await actions.respond(round.id, currentPlayer!.id, wants)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível responder.')
    } finally {
      setBusy(false)
    }
  }

  const full = round.max_players > 0 && lists.confirmed.length >= round.max_players

  return (
    <div className="space-y-2">
      {mine === 'confirmado' && (
        <>
          <p className="text-center text-subhead font-medium text-brand">
            Sua presença está confirmada
          </p>
          <Button variant="secondary" size="lg" block disabled={busy} onClick={() => respond('fora')}>
            Não vou poder ir
          </Button>
        </>
      )}

      {mine === 'espera' && (
        <>
          <p className="text-center text-subhead text-muted">
            Você é o {waitingPosition}º da lista de espera
          </p>
          <Button variant="secondary" size="lg" block disabled={busy} onClick={() => respond('fora')}>
            Sair da lista
          </Button>
        </>
      )}

      {(mine === null || mine === 'fora') && (
        <Button size="lg" block disabled={busy} onClick={() => respond('confirmado')}>
          {busy ? 'Enviando…' : full ? 'Entrar na lista de espera' : 'Confirmar presença'}
        </Button>
      )}

      {error && <Note tone="error">{error}</Note>}
    </div>
  )
}
