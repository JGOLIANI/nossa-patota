import type { PostgrestError } from '@supabase/supabase-js'
import { resizeImage } from '../lib/image'
import { emailToUsername, normalizeUsername, supabase, usernameToEmail } from '../lib/supabase'
import type {
  Award,
  Match,
  MatchEvent,
  Player,
  Round,
  RoundPlayer,
  SessionUser,
  Snapshot,
  Team,
} from '../types'
import type {
  AwardInput,
  Backend,
  EventInput,
  PlayerInput,
  RoundInput,
  TeamInput,
} from './types'

function client() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(translate(result.error.message))
  return result.data as T
}

function translate(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Usuário ou senha inválidos.'
  if (/user already registered/i.test(message)) return 'Este usuário já possui acesso criado.'
  if (/password should be at least/i.test(message)) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (/duplicate key value/i.test(message)) return 'Já existe um cadastro com esse nome de usuário.'
  if (/row-level security/i.test(message)) {
    return 'Você não tem permissão para executar esta ação.'
  }
  return message
}

export const supabaseBackend: Backend = {
  mode: 'supabase',

  async getSession() {
    const { data } = await client().auth.getSession()
    const user = data.session?.user
    return user ? { id: user.id, username: emailToUsername(user.email) } : null
  },

  onAuthChange(callback: (user: SessionUser | null) => void) {
    const { data } = client().auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      callback(user ? { id: user.id, username: emailToUsername(user.email) } : null)
    })
    return () => data.subscription.unsubscribe()
  },

  async signIn(username: string, password: string) {
    const { error } = await client().auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error) throw new Error(translate(error.message))
  },

  async signUp(username: string, password: string) {
    const { error } = await client().auth.signUp({
      email: usernameToEmail(username),
      password,
    })
    if (error) throw new Error(translate(error.message))
  },

  async signOut() {
    await client().auth.signOut()
  },

  async changePassword(password: string) {
    const { error } = await client().auth.updateUser({ password })
    if (error) throw new Error(translate(error.message))
  },

  async fetchAll(): Promise<Snapshot> {
    const db = client()
    const [players, rounds, teams, roundPlayers, matches, events, awards] = await Promise.all([
      db.from('players').select('*').order('full_name'),
      db.from('rounds').select('*').order('date', { ascending: false }),
      db.from('teams').select('*').order('position'),
      db.from('round_players').select('*'),
      db.from('matches').select('*').order('sequence'),
      db.from('match_events').select('*').order('created_at'),
      db.from('round_awards').select('*'),
    ])

    return {
      players: unwrap<Player[]>(players),
      rounds: unwrap<Round[]>(rounds),
      teams: unwrap<Team[]>(teams),
      roundPlayers: unwrap<RoundPlayer[]>(roundPlayers),
      matches: unwrap<Match[]>(matches),
      events: unwrap<MatchEvent[]>(events),
      awards: unwrap<Award[]>(awards),
    }
  },

  async createPlayer(input: PlayerInput) {
    const row = { ...input, username: normalizeUsername(input.username) }
    const data = unwrap<Player[]>(await client().from('players').insert(row).select())
    return data[0]
  },

  async updatePlayer(id: string, patch: Partial<Player>) {
    const row = patch.username ? { ...patch, username: normalizeUsername(patch.username) } : patch
    unwrap(await client().from('players').update(row).eq('id', id).select())
  },

  async deletePlayer(id: string) {
    const { error } = await client().from('players').delete().eq('id', id)
    if (error) throw new Error(translate(error.message))
  },

  async uploadAvatar(playerId: string, file: File) {
    const db = client()
    const blob = await resizeImage(file)
    const path = `${playerId}/${Date.now()}.jpg`
    const { error } = await db.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
    if (error) throw new Error(translate(error.message))
    return db.storage.from('avatars').getPublicUrl(path).data.publicUrl
  },

  async createRound(input: RoundInput) {
    const db = client()
    const rounds = unwrap<Round[]>(
      await db
        .from('rounds')
        .insert({
          date: input.date,
          title: input.title,
          team_count: input.team_count,
          status: 'rascunho',
        })
        .select(),
    )
    const round = rounds[0]
    if (input.playerIds.length > 0) {
      unwrap(
        await db
          .from('round_players')
          .insert(input.playerIds.map((playerId) => ({ round_id: round.id, player_id: playerId })))
          .select(),
      )
    }
    return round
  },

  async updateRound(id: string, patch: Partial<Round>) {
    unwrap(await client().from('rounds').update(patch).eq('id', id).select())
  },

  async deleteRound(id: string) {
    const { error } = await client().from('rounds').delete().eq('id', id)
    if (error) throw new Error(translate(error.message))
  },

  async setRoundRoster(roundId: string, playerIds: string[]) {
    const db = client()
    const current = unwrap<RoundPlayer[]>(
      await db.from('round_players').select('*').eq('round_id', roundId),
    )
    const keep = new Set(playerIds)
    const removed = current.filter((rp) => !keep.has(rp.player_id)).map((rp) => rp.id)
    const existing = new Set(current.map((rp) => rp.player_id))
    const added = playerIds.filter((id) => !existing.has(id))

    if (removed.length > 0) {
      const { error } = await db.from('round_players').delete().in('id', removed)
      if (error) throw new Error(translate(error.message))
    }
    if (added.length > 0) {
      unwrap(
        await db
          .from('round_players')
          .insert(added.map((playerId) => ({ round_id: roundId, player_id: playerId })))
          .select(),
      )
    }
  },

  async setRoundTeams(roundId: string, teams: TeamInput[]) {
    const db = client()
    // Refazer os times invalida as partidas já criadas na rodada.
    const dropMatches = await db.from('matches').delete().eq('round_id', roundId)
    if (dropMatches.error) throw new Error(translate(dropMatches.error.message))
    const dropTeams = await db.from('teams').delete().eq('round_id', roundId)
    if (dropTeams.error) throw new Error(translate(dropTeams.error.message))

    const created = unwrap<Team[]>(
      await db
        .from('teams')
        .insert(
          teams.map((team, index) => ({
            round_id: roundId,
            position: index,
            name: team.name,
            color: team.color,
          })),
        )
        .select(),
    )

    const clear = await db
      .from('round_players')
      .update({ team_id: null })
      .eq('round_id', roundId)
    if (clear.error) throw new Error(translate(clear.error.message))

    for (const [index, team] of teams.entries()) {
      if (team.playerIds.length === 0) continue
      const teamId = created.find((row) => row.position === index)?.id
      if (!teamId) continue
      const { error } = await db
        .from('round_players')
        .update({ team_id: teamId })
        .eq('round_id', roundId)
        .in('player_id', team.playerIds)
      if (error) throw new Error(translate(error.message))
    }
  },

  async createMatch(roundId: string, teamAId: string, teamBId: string) {
    const db = client()
    const existing = unwrap<Array<Pick<Match, 'sequence'>>>(
      await db.from('matches').select('sequence').eq('round_id', roundId),
    )
    const sequence = existing.reduce((max, row) => Math.max(max, row.sequence), 0) + 1
    const created = unwrap<Match[]>(
      await db
        .from('matches')
        .insert({
          round_id: roundId,
          sequence,
          team_a_id: teamAId,
          team_b_id: teamBId,
          score_a: 0,
          score_b: 0,
          status: 'em_andamento',
        })
        .select(),
    )
    return created[0]
  },

  async updateMatch(id: string, patch: Partial<Match>) {
    unwrap(await client().from('matches').update(patch).eq('id', id).select())
  },

  async deleteMatch(id: string) {
    const { error } = await client().from('matches').delete().eq('id', id)
    if (error) throw new Error(translate(error.message))
  },

  async addEvent(input: EventInput) {
    const created = unwrap<MatchEvent[]>(
      await client().from('match_events').insert(input).select(),
    )
    return created[0]
  },

  async deleteEvent(id: string) {
    const { error } = await client().from('match_events').delete().eq('id', id)
    if (error) throw new Error(translate(error.message))
  },

  async setAwards(roundId: string, awards: AwardInput[]) {
    const db = client()
    const { error } = await db.from('round_awards').delete().eq('round_id', roundId)
    if (error) throw new Error(translate(error.message))
    if (awards.length === 0) return []
    return unwrap<Award[]>(
      await db
        .from('round_awards')
        .insert(awards.map((award) => ({ ...award, round_id: roundId })))
        .select(),
    )
  },
}
