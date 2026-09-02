import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, isDemoMode } from '../data'
import type { AwardInput, EventInput, PlayerInput, RoundInput } from '../data/types'
import { confirmedPlayers, rebalanceWaitlist } from '../domain/attendance'
import { computeRoundAwards, votingState } from '../domain/awards'
import { generateTeams, seedFromString } from '../domain/balance'
import { missingRoundDates, roundTitle, staleRoundIds } from '../domain/schedule'
import { scoreFromEvents } from '../domain/score'
import { computeMatchLogs, computeStats } from '../domain/stats'
import { todayISO } from '../lib/format'
import type {
  Attendance,
  Match,
  PatotaSettings,
  PlayerPosition,
  SessionUser,
  Snapshot,
} from '../types'
import { EMPTY_SNAPSHOT, TEAM_PRESETS } from '../types'
import { AppContext, type AppActions, type AppValue } from './context'

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  // De qual sessão é o acervo que está em mãos.
  //
  // A sessão chega antes do acervo, e sem saber que a primeira leitura já
  // terminou as telas leem "ninguém é administrador" e "esta conta não tem
  // ficha" de um snapshot ainda vazio — e piscam a resposta errada. Guardar o
  // dono, e não um sim/não, também cobre a troca de conta: o acervo de quem
  // saiu não vale como carregado para quem entrou.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  // Espelho do snapshot para as ações lerem o estado mais recente sem
  // recriar os callbacks a cada atualização.
  const snapshotRef = useRef(snapshot)
  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  // Identidade estável: a tela de cadastro consulta isto dentro de um efeito,
  // e um callback novo a cada render refaria a chamada sem motivo.
  const joinCodeRequired = useCallback(() => backend.joinCodeRequired(), [])

  const refresh = useCallback(async () => {
    const data = await backend.fetchAll()
    snapshotRef.current = data
    setSnapshot(data)
  }, [])

  useEffect(() => {
    let active = true
    backend
      .getSession()
      .then((user) => {
        if (active) setSession(user)
      })
      .finally(() => {
        if (active) setReady(true)
      })

    const unsubscribe = backend.onAuthChange((user) => {
      setSession(user)
      if (!user) setSnapshot(EMPTY_SNAPSHOT)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const data = await backend.fetchAll()
        if (!active) return
        snapshotRef.current = data
        setSnapshot(data)
      } finally {
        // Também quando a leitura falha: a espera acabou de todo jeito, e
        // seguir girando prenderia a pessoa numa tela que não sai mais.
        if (active) {
          setLoading(false)
          setHydratedFor(session.id)
        }
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [session])

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      setLoading(true)
      try {
        const result = await operation()
        await refresh()
        return result
      } finally {
        setLoading(false)
      }
    },
    [refresh],
  )

  /** Cria as rodadas futuras que ainda faltam, conforme a agenda da patota. */
  const createMissingRounds = useCallback(async () => {
    const current = snapshotRef.current
    const dates = missingRoundDates(current.settings, current.rounds, todayISO())
    for (const date of dates) {
      await backend.createRound({
        date,
        title: roundTitle(date),
        start_time: current.settings.start_time,
        location: current.settings.location,
        team_count: 2,
        max_players: current.settings.max_players,
      })
    }
    return dates.length
  }, [])

  /**
   * Grava o resultado das rodadas cuja urna já fechou.
   *
   * A votação termina pelo relógio, sozinha, mas o resultado precisa virar
   * linha no banco para entrar no histórico do jogador — e escrever exige
   * permissão. Então a apuração acontece na primeira vez que um
   * administrador abre o aplicativo depois do prazo. Até lá as telas mostram
   * a mesma apuração calculada na hora, então ninguém vê número diferente do
   * que vai ser gravado.
   *
   * `awards_settled_at` é o que impede a repetição: uma rodada em que
   * ninguém se destacou é apurada com zero prêmios, e sem a marca ela seria
   * reapurada para sempre.
   */
  const settleDueRounds = useCallback(async () => {
    const current = snapshotRef.current
    const due = current.rounds.filter(
      (round) => !round.awards_settled_at && votingState(round) === 'encerrada',
    )
    for (const round of due) {
      const awards = computeRoundAwards(current, round.id)
      const rows: AwardInput[] = Object.entries(awards).flatMap(([type, playerIds]) =>
        (playerIds as string[]).map((playerId) => ({
          type: type as AwardInput['type'],
          player_id: playerId,
        })),
      )
      await backend.setAwards(round.id, rows)
      await backend.updateRound(round.id, { awards_settled_at: new Date().toISOString() })
    }
    return due.length
  }, [])

  const actions = useMemo<AppActions>(
    () => ({
      createPlayer: (input: PlayerInput) => run(() => backend.createPlayer(input)),
      updatePlayer: (id, patch) => run(() => backend.updatePlayer(id, patch)),
      deletePlayer: (id) => run(() => backend.deletePlayer(id)),
      uploadAvatar: (playerId, file) =>
        run(async () => {
          const url = await backend.uploadAvatar(playerId, file)
          await backend.updatePlayer(playerId, { photo_url: url })
        }),
      setPlayerPassword: (playerId, password) =>
        backend.setPlayerPassword(playerId, password),

      updateSettings: (patch: Partial<PatotaSettings>) =>
        run(async () => {
          const previous = snapshotRef.current.settings
          await backend.updateSettings(patch)

          // A agenda mudou: as rodadas do dia antigo que ninguém tocou saem, e
          // as do dia novo entram. Sem a limpeza a lista de partidas ia
          // acumulando dias em que ninguém mais joga.
          let fresh = await backend.fetchAll()
          const stale = staleRoundIds({
            rounds: fresh.rounds,
            answered: new Set(fresh.roundPlayers.map((rp) => rp.round_id)),
            previousWeekday: previous.weekday,
            nextWeekday: fresh.settings.weekday,
            todayISO: todayISO(),
          })
          for (const roundId of stale) await backend.deleteRound(roundId)
          if (stale.length > 0) fresh = await backend.fetchAll()

          snapshotRef.current = fresh
          return { created: await createMissingRounds(), removed: stale.length }
        }),

      ensureUpcomingRounds: () =>
        run(async () => {
          await createMissingRounds()
        }),

      createRound: (input: RoundInput) => run(() => backend.createRound(input)),
      updateRound: (id, patch) => run(() => backend.updateRound(id, patch)),
      deleteRound: (id) => run(() => backend.deleteRound(id)),

      respond: (roundId: string, _playerId: string, wants: 'confirmado' | 'fora') =>
        run(() => backend.respondAttendance(roundId, wants)),

      setAttendance: (roundId: string, playerId: string, attendance: Attendance) =>
        run(() => backend.setAttendance(roundId, [{ player_id: playerId, attendance }])),

      setRoundPosition: (roundId: string, playerId: string, position: PlayerPosition) =>
        run(() => backend.setRoundPosition(roundId, playerId, position)),

      removeFromRound: (roundId: string, playerId: string) =>
        run(async () => {
          await backend.removeFromRound(roundId, playerId)
          // Sair da rodada pode liberar vaga para quem está na espera.
          const fresh = await backend.fetchAll()
          const round = fresh.rounds.find((item) => item.id === roundId)
          if (!round) return
          const rows = fresh.roundPlayers.filter((rp) => rp.round_id === roundId)
          const promotions = rebalanceWaitlist(rows, round.max_players)
          if (promotions.length > 0) await backend.setAttendance(roundId, promotions)
        }),

      /**
       * Sorteia dois times e já cria a partida da rodada.
       *
       * A rodada tem uma partida só, então não faz sentido pedir ao
       * administrador que a crie num segundo passo: sortear os times é o
       * mesmo ato de começar o jogo.
       */
      generateTeamsForRound: (roundId) =>
        run(async () => {
          const current = snapshotRef.current
          const roster = confirmedPlayers(current, roundId)

          if (roster.length < 2) {
            throw new Error(
              `Só ${roster.length} jogador(es) confirmaram presença — não dá para dividir em dois times.`,
            )
          }

          // As estatísticas usadas no balanceamento ignoram a própria rodada.
          const history: Snapshot = {
            ...current,
            matches: current.matches.filter((match) => match.round_id !== roundId),
          }

          const result = generateTeams({
            players: roster,
            stats: computeStats(history),
            logs: computeMatchLogs(history),
            teamCount: 2,
            seed: seedFromString(roundId),
          })

          await backend.setRoundTeams(
            roundId,
            result.teams.map((team, index) => ({
              name: TEAM_PRESETS[index % TEAM_PRESETS.length].name,
              color: TEAM_PRESETS[index % TEAM_PRESETS.length].color,
              playerIds: team.playerIds,
            })),
          )

          // Recarrega para conhecer os ids dos times recém-criados.
          const fresh = await backend.fetchAll()
          const teams = fresh.teams
            .filter((team) => team.round_id === roundId)
            .sort((a, b) => a.position - b.position)

          // A posição da rodada começa igual à do cadastro; o administrador
          // ajusta quando o goleiro decide jogar na linha.
          for (const player of roster) {
            await backend.setRoundPosition(roundId, player.id, player.position)
          }

          if (teams.length === 2) {
            await backend.createMatch(roundId, teams[0].id, teams[1].id)
          }
          await backend.updateRound(roundId, { team_count: 2, status: 'em_andamento' })
        }),

      /**
       * Monta os times na mão.
       *
       * O sorteio resolve o caso comum, mas nem toda pelada quer o time que o
       * histórico sugere: às vezes os quatro que vieram juntos querem jogar
       * juntos. Aqui quem decide é o administrador.
       *
       * Os dois caminhos são bem diferentes. Sem times ainda, isto faz o
       * mesmo que o sorteio, só que com as listas escolhidas: cria os times,
       * fixa a posição de cada um e abre o placar. Com os times já montados,
       * move apenas quem trocou de lado — passar por `setRoundTeams` aqui
       * refaria os times do zero e levaria a partida e os gols junto.
       */
      setManualTeams: (roundId, assignments) =>
        run(async () => {
          const current = snapshotRef.current
          const existing = current.teams
            .filter((team) => team.round_id === roundId)
            .sort((a, b) => a.position - b.position)

          if (existing.length >= 2) {
            for (const rp of current.roundPlayers) {
              if (rp.round_id !== roundId) continue
              const index = assignments[rp.player_id]
              const teamId =
                index === null || index === undefined ? null : (existing[index]?.id ?? null)
              if (teamId !== rp.team_id) {
                await backend.setPlayerTeam(roundId, rp.player_id, teamId)
              }
            }
            return
          }

          const lists: string[][] = [[], []]
          for (const [playerId, index] of Object.entries(assignments)) {
            if (index === null || index === undefined) continue
            if (index < 0 || index >= lists.length) continue
            lists[index].push(playerId)
          }
          if (lists.some((list) => list.length === 0)) {
            throw new Error('Cada time precisa de pelo menos um jogador.')
          }

          await backend.setRoundTeams(
            roundId,
            lists.map((playerIds, index) => ({
              name: TEAM_PRESETS[index % TEAM_PRESETS.length].name,
              color: TEAM_PRESETS[index % TEAM_PRESETS.length].color,
              playerIds,
            })),
          )

          // Recarrega para conhecer os ids dos times recém-criados.
          const fresh = await backend.fetchAll()
          const teams = fresh.teams
            .filter((team) => team.round_id === roundId)
            .sort((a, b) => a.position - b.position)
          const byId = new Map(fresh.players.map((player) => [player.id, player]))

          // A posição da rodada começa igual à do cadastro; o administrador
          // ajusta quando o goleiro decide jogar na linha.
          for (const playerId of lists.flat()) {
            const player = byId.get(playerId)
            if (player) await backend.setRoundPosition(roundId, playerId, player.position)
          }

          if (teams.length === 2) {
            await backend.createMatch(roundId, teams[0].id, teams[1].id)
          }
          await backend.updateRound(roundId, { team_count: 2, status: 'em_andamento' })
        }),

      startRound: (roundId) =>
        run(() => backend.updateRound(roundId, { status: 'em_andamento' })),

      /**
       * Encerra a partida e abre a urna.
       *
       * Os prêmios não saem mais daqui. Quem jogou tem 16 horas para votar, e
       * só depois disso a apuração vira definitiva — é `settleDueRounds` que
       * grava o resultado quando o prazo vence. O `closed_at` gravado aqui é
       * o que dá partida nesse relógio.
       */
      closeRound: (roundId) =>
        run(async () => {
          const current = snapshotRef.current
          const open = current.matches.filter(
            (match) => match.round_id === roundId && match.status !== 'encerrada',
          )
          for (const match of open) {
            await backend.updateMatch(match.id, {
              status: 'encerrada',
              ended_at: new Date().toISOString(),
            })
          }

          // Prêmios de um encerramento anterior não valem mais: a urna
          // recomeça, e o resultado antigo seria apurado sobre outro placar.
          await backend.setAwards(roundId, [])
          await backend.updateRound(roundId, {
            status: 'encerrada',
            closed_at: new Date().toISOString(),
          })
        }),

      createMatch: (roundId, teamAId, teamBId) =>
        run(() => backend.createMatch(roundId, teamAId, teamBId)),
      /**
       * Reabre a partida e, se a rodada já estava encerrada, reabre a rodada
       * junto.
       *
       * Uma partida em andamento sai das estatísticas — então deixar a rodada
       * fechada guardava prêmios calculados sobre um placar que não conta
       * mais, e sem o botão de encerrar não havia como refazê-los. Os prêmios
       * são apagados aqui e recalculados quando a rodada for encerrada de novo.
       */
      reopenMatch: (matchId) =>
        run(async () => {
          await backend.updateMatch(matchId, { status: 'em_andamento', ended_at: null })
          const current = snapshotRef.current
          const match = current.matches.find((item) => item.id === matchId)
          const round = match && current.rounds.find((item) => item.id === match.round_id)
          if (round?.status !== 'encerrada') return
          await backend.setAwards(round.id, [])
          await backend.updateRound(round.id, { status: 'em_andamento', closed_at: null })
        }),
      deleteMatch: (matchId) => run(() => backend.deleteMatch(matchId)),

      addGoal: (match: Match, input: Omit<EventInput, 'match_id'>) =>
        run(async () => {
          const event = await backend.addEvent({ ...input, match_id: match.id })
          const events = [...snapshotRef.current.events, event]
          await backend.updateMatch(match.id, scoreFromEvents(match, events))
        }),

      editGoal: (match: Match, eventId: string, input: Omit<EventInput, 'match_id'>) =>
        run(async () => {
          await backend.updateEvent(eventId, input)
          const events = snapshotRef.current.events.map((event) =>
            event.id === eventId ? { ...event, ...input } : event,
          )
          await backend.updateMatch(match.id, scoreFromEvents(match, events))
        }),

      removeEvent: (match: Match, eventId: string) =>
        run(async () => {
          await backend.deleteEvent(eventId)
          const events = snapshotRef.current.events.filter((event) => event.id !== eventId)
          await backend.updateMatch(match.id, scoreFromEvents(match, events))
        }),

      castVote: (roundId, type, playerId) =>
        run(() => backend.castVote(roundId, type, playerId)),
      clearVote: (roundId, type) => run(() => backend.clearVote(roundId, type)),

      setAwards: (roundId, awards) =>
        run(async () => {
          await backend.setAwards(roundId, awards)
        }),
    }),
    [run, createMissingRounds],
  )

  const currentPlayer = useMemo(() => {
    if (!session) return null
    return (
      snapshot.players.find((player) => player.user_id === session.id) ??
      snapshot.players.find((player) => player.username === session.username) ??
      null
    )
  }, [session, snapshot.players])

  const isAdmin = currentPlayer?.role === 'admin'
  const hydrated = session !== null && hydratedFor === session.id

  // O administrador é quem tem permissão de escrita, então é ao abrir o
  // aplicativo dele que as próximas rodadas da agenda são materializadas.
  const ensuredRef = useRef(false)
  useEffect(() => {
    if (!isAdmin || ensuredRef.current || snapshot.players.length === 0) return
    if (missingRoundDates(snapshot.settings, snapshot.rounds, todayISO()).length === 0) return
    ensuredRef.current = true
    void createMissingRounds().then(refresh)
  }, [isAdmin, snapshot.settings, snapshot.rounds, snapshot.players.length, createMissingRounds, refresh])

  // Mesma ideia da agenda: quem tem permissão de escrita é quem fecha as
  // urnas vencidas ao abrir o aplicativo.
  const settledRef = useRef(false)
  useEffect(() => {
    if (!isAdmin || settledRef.current || snapshot.players.length === 0) return
    const due = snapshot.rounds.some(
      (round) => !round.awards_settled_at && votingState(round) === 'encerrada',
    )
    if (!due) return
    settledRef.current = true
    void settleDueRounds().then(refresh)
  }, [isAdmin, snapshot.rounds, snapshot.players.length, settleDueRounds, refresh])

  const stats = useMemo(() => computeStats(snapshot), [snapshot])

  const value: AppValue = {
    ready,
    loading,
    hydrated,
    demoMode: isDemoMode,
    session,
    snapshot,
    currentPlayer,
    isAdmin,
    stats,
    refresh,
    signIn: (username, password) => backend.signIn(username, password),
    signUp: (input) => backend.signUp(input),
    joinCodeRequired,
    signOut: async () => {
      await backend.signOut()
      setSession(null)
      setSnapshot(EMPTY_SNAPSHOT)
    },
    changePassword: (password) => backend.changePassword(password),
    actions,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
