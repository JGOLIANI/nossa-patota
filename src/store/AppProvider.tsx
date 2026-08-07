import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, isDemoMode } from '../data'
import type { AwardInput, EventInput, PlayerInput, RoundInput } from '../data/types'
import { computeRoundAwards } from '../domain/awards'
import { generateTeams, seedFromString } from '../domain/balance'
import { scoreFromEvents } from '../domain/score'
import { computeMatchLogs, computeStats } from '../domain/stats'
import type { Match, Player, SessionUser, Snapshot } from '../types'
import { EMPTY_SNAPSHOT, TEAM_PRESETS } from '../types'
import { AppContext, type AppActions, type AppValue } from './context'

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  // Espelho do snapshot para as ações lerem o estado mais recente sem
  // recriar os callbacks a cada atualização.
  const snapshotRef = useRef(snapshot)
  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const refresh = useCallback(async () => {
    const data = await backend.fetchAll()
    snapshotRef.current = data
    setSnapshot(data)
  }, [])

  // Sessão inicial e mudanças de autenticação.
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

  // Os dados só são carregados para quem está autenticado.
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
        if (active) setLoading(false)
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

      createRound: (input: RoundInput) => run(() => backend.createRound(input)),
      updateRound: (id, patch) => run(() => backend.updateRound(id, patch)),
      deleteRound: (id) => run(() => backend.deleteRound(id)),
      setRoundRoster: (roundId, playerIds) =>
        run(() => backend.setRoundRoster(roundId, playerIds)),

      generateTeamsForRound: (roundId, teamCount) =>
        run(async () => {
          const current = snapshotRef.current
          const roster = current.roundPlayers
            .filter((rp) => rp.round_id === roundId)
            .map((rp) => current.players.find((p) => p.id === rp.player_id))
            .filter((player): player is Player => Boolean(player))

          if (roster.length === 0) {
            throw new Error('Selecione ao menos um jogador antes de gerar os times.')
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
            teamCount,
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
          await backend.updateRound(roundId, { team_count: teamCount })
        }),

      startRound: (roundId) =>
        run(() => backend.updateRound(roundId, { status: 'em_andamento' })),

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

          // Recarrega para calcular os prêmios com todas as partidas encerradas.
          const fresh = await backend.fetchAll()
          const awards = computeRoundAwards(fresh, roundId)
          const rows: AwardInput[] = Object.entries(awards).flatMap(([type, playerIds]) =>
            (playerIds as string[]).map((playerId) => ({
              type: type as AwardInput['type'],
              player_id: playerId,
            })),
          )
          await backend.setAwards(roundId, rows)
          await backend.updateRound(roundId, {
            status: 'encerrada',
            closed_at: new Date().toISOString(),
          })
        }),

      createMatch: (roundId, teamAId, teamBId) =>
        run(() => backend.createMatch(roundId, teamAId, teamBId)),
      finishMatch: (matchId) =>
        run(() =>
          backend.updateMatch(matchId, {
            status: 'encerrada',
            ended_at: new Date().toISOString(),
          }),
        ),
      reopenMatch: (matchId) =>
        run(() => backend.updateMatch(matchId, { status: 'em_andamento', ended_at: null })),
      deleteMatch: (matchId) => run(() => backend.deleteMatch(matchId)),

      addGoal: (match: Match, input: Omit<EventInput, 'match_id'>) =>
        run(async () => {
          const event = await backend.addEvent({ ...input, match_id: match.id })
          const events = [...snapshotRef.current.events, event]
          await backend.updateMatch(match.id, scoreFromEvents(match, events))
        }),

      removeEvent: (match: Match, eventId: string) =>
        run(async () => {
          await backend.deleteEvent(eventId)
          const events = snapshotRef.current.events.filter((event) => event.id !== eventId)
          await backend.updateMatch(match.id, scoreFromEvents(match, events))
        }),

      setAwards: (roundId, awards) =>
        run(async () => {
          await backend.setAwards(roundId, awards)
        }),
    }),
    [run],
  )

  const currentPlayer = useMemo(() => {
    if (!session) return null
    return (
      snapshot.players.find((player) => player.user_id === session.id) ??
      snapshot.players.find((player) => player.username === session.username) ??
      null
    )
  }, [session, snapshot.players])

  const stats = useMemo(() => computeStats(snapshot), [snapshot])

  const value: AppValue = {
    ready,
    loading,
    demoMode: isDemoMode,
    session,
    snapshot,
    currentPlayer,
    isAdmin: currentPlayer?.role === 'admin',
    stats,
    refresh,
    signIn: (username, password) => backend.signIn(username, password),
    signUp: (username, password) => backend.signUp(username, password),
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
