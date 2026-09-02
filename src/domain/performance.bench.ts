import { bench, describe } from 'vitest'
import { computeRoundAwards } from './awards'
import { generateTeams } from './balance'
import { makeSnapshot, SCALES } from './benchData'
import { buildRankings } from './rankings'
import { computeMatchLogs, computeStats } from './stats'

/**
 * Tudo neste aplicativo é recalculado do zero a partir do histórico
 * completo: não há contador guardado no banco. Isso mantém os números
 * sempre coerentes, mas transforma o custo dessas funções no teto de
 * desempenho da interface. Estes benchmarks existem para saber onde fica
 * esse teto.
 *
 *   npm run bench
 */

for (const [name, scale] of Object.entries(SCALES)) {
  const snapshot = makeSnapshot(scale)
  const lastRound = snapshot.rounds[snapshot.rounds.length - 1]
  const stats = computeStats(snapshot)
  const logs = computeMatchLogs(snapshot)
  const roster = snapshot.players.slice(0, scale.perRound)

  describe(`${name} — ${scale.players} jogadores, ${scale.rounds} rodadas`, () => {
    // Roda a cada mudança do snapshot, dentro do provider.
    bench('computeStats (histórico completo)', () => {
      computeStats(snapshot)
    })

    // Roda ao abrir a tela de rankings.
    bench('buildRankings', () => {
      buildRankings(snapshot)
    })

    // Roda ao abrir a rodada.
    bench('computeStats (uma rodada)', () => {
      computeStats(snapshot, { roundId: lastRound.id })
    })

    /*
     * Os prêmios têm dois custos bem diferentes, e medir só um deles engana.
     *
     * A lista de candidatos fica memorizada por identidade de snapshot, então
     * a primeira apuração paga uma passada de estatística e as seguintes não
     * pagam quase nada. A tela dos prêmios faz quatro chamadas por
     * renderização, e é o segundo número que ela sente.
     */
    bench('computeRoundAwards (snapshot novo)', () => {
      computeRoundAwards({ ...snapshot }, lastRound.id)
    })

    bench('computeRoundAwards (mesmo snapshot)', () => {
      computeRoundAwards(snapshot, lastRound.id)
    })

    // Roda ao sortear os times.
    bench('generateTeams', () => {
      generateTeams({ players: roster, stats, logs, teamCount: 2, seed: 1 })
    })
  })
}
