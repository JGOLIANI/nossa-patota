import { useState } from 'react'
import { useApp } from '../store/useApp'
import type { Round } from '../types'
import { Modal } from './Modal'
import { RoundFields, type RoundDraft } from './RoundFields'
import { Button, Note } from './ui'

/**
 * Remarcar uma partida que ainda não começou.
 *
 * Combinado de quadra muda: a quadra fica sem luz, o horário atrasa meia
 * hora, o pessoal decide jogar na quinta. Sem isto a saída era excluir a
 * partida e criar outra — e junto com ela iam embora as confirmações que já
 * tinham chegado, que são a parte mais difícil de conseguir de novo.
 *
 * Só vale enquanto os times não foram sorteados. Depois disso a partida tem
 * placar aberto, e mudar a data por baixo de um jogo em andamento não é
 * corrigir um combinado: é reescrever o que já aconteceu.
 */
export function RoundEditModal({
  round,
  open,
  onClose,
}: {
  round: Round
  open: boolean
  onClose: () => void
}) {
  const { actions } = useApp()
  // O formulário só existe enquanto a modal está aberta, e é isso que faz o
  // rascunho nascer de novo a cada abertura: quem cancelou uma mudança e
  // reabriu tem de ver o que está gravado, não o que desistiu de salvar.
  return open ? <Form round={round} onClose={onClose} actions={actions} /> : null
}

function Form({
  round,
  onClose,
  actions,
}: {
  round: Round
  onClose: () => void
  actions: ReturnType<typeof useApp>['actions']
}) {
  const [draft, setDraft] = useState<RoundDraft>({
    date: round.date.slice(0, 10),
    startTime: round.start_time,
    location: round.location,
    locationUrl: round.location_url,
    maxPlayers: String(round.max_players),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setError('')
    setBusy(true)
    try {
      await actions.updateRound(round.id, {
        date: draft.date,
        start_time: draft.startTime,
        location: draft.location.trim(),
        location_url: draft.locationUrl.trim(),
        max_players: Number(draft.maxPlayers) || 0,
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a partida.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title="Editar partida"
      onClose={onClose}
      footer={
        <Button size="lg" block onClick={save} disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
      }
    >
      <div className="space-y-4">
        <RoundFields value={draft} onChange={setDraft} />

        <Note>
          Quem já confirmou continua confirmado. Abrir mais vagas puxa quem está na espera; fechar
          vagas não tira ninguém.
        </Note>

        {error && <Note tone="error">{error}</Note>}
      </div>
    </Modal>
  )
}
