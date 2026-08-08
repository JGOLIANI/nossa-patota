import type { PostgrestError } from '@supabase/supabase-js'
import { resizeImage } from '../lib/image'
import { emailToUsername, normalizeUsername, supabase, usernameToEmail } from '../lib/supabase'
import type {
  Award,
  Match,
  MatchEvent,
  PatotaSettings,
  Player,
  PlayerPosition,
  Round,
  RoundPlayer,
  SessionUser,
  Snapshot,
  Team,
} from '../types'
import { DEFAULT_SETTINGS } from '../types'
import type {
  AttendanceInput,
  AwardInput,
  Backend,
  EventInput,
  PlayerInput,
  RoundInput,
  SignUpInput,
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
  // `rounds` é única por data, e a mensagem genérica de chave duplicada falava
  // de nome de usuário — o que não tem nada a ver com marcar uma partida.
  if (/rounds_date_key/i.test(message)) return 'Já existe uma partida marcada para esta data.'
  if (/duplicate key value/i.test(message)) return 'Já existe um cadastro com esse nome de usuário.'
  if (/row-level security/i.test(message)) {
    return 'Você não tem permissão para executar esta ação.'
  }
  // O Supabase Auth engole a mensagem das exceções levantadas pelo gatilho de
  // cadastro e devolve sempre a mesma frase genérica. Por isso o código da
  // patota é conferido antes do `signUp`: aqui já não dá para dizer o motivo.
  if (/database error saving new user/i.test(message)) {
    return 'Não foi possível concluir o cadastro. Confira os dados e tente de novo.'
  }
  return message
}

const INVALID_JOIN_CODE = 'Código da patota inválido. Peça o código a um administrador.'

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

  /**
   * O perfil viaja como metadados da conta: é o gatilho `handle_new_user`, no
   * banco, que cria a linha em `players`. O navegador não poderia fazê-lo — a
   * escrita na tabela é reservada aos administradores pelo RLS, e quem está se
   * cadastrando ainda não tem sessão.
   */
  async signUp(input: SignUpInput) {
    // Conferido antes para a mensagem sair certa; quem decide de verdade é o
    // gatilho, dentro da transação que cria a conta.
    const check = await client().rpc('join_code_matches', { p_code: input.join_code ?? '' })
    if (!check.error && check.data === false) throw new Error(INVALID_JOIN_CODE)

    const { error } = await client().auth.signUp({
      email: usernameToEmail(input.username),
      password: input.password,
      options: {
        data: {
          full_name: input.full_name.trim(),
          player_type: input.player_type,
          position: input.position,
          dominant_foot: input.dominant_foot,
          join_code: input.join_code?.trim() ?? '',
        },
      },
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

  async joinCodeRequired() {
    const { data, error } = await client().rpc('join_code_required')
    // Sem resposta, o formulário mostra o campo: melhor pedir um código à toa
    // do que esconder o único caminho de cadastro.
    if (error) return true
    return Boolean(data)
  },

  async setPlayerPassword(playerId: string, password: string) {
    const { error } = await client().rpc('admin_set_password', {
      p_player_id: playerId,
      p_password: password,
    })
    if (error) throw new Error(translate(error.message))
  },

  async fetchAll(): Promise<Snapshot> {
    const db = client()
    const [players, rounds, teams, roundPlayers, matches, events, awards, settings] =
      await Promise.all([
      db.from('players').select('*').order('full_name'),
      db.from('rounds').select('*').order('date', { ascending: false }),
      db.from('teams').select('*').order('position'),
      db.from('round_players').select('*'),
      db.from('matches').select('*').order('sequence'),
      db.from('match_events').select('*').order('created_at'),
      db.from('round_awards').select('*'),
        db.from('patota_settings').select('*').eq('id', 'default').maybeSingle(),
      ])

    return {
      players: unwrap<Player[]>(players),
      rounds: unwrap<Round[]>(rounds),
      teams: unwrap<Team[]>(teams),
      roundPlayers: unwrap<RoundPlayer[]>(roundPlayers),
      matches: unwrap<Match[]>(matches),
      events: unwrap<MatchEvent[]>(events),
      awards: unwrap<Award[]>(awards),
      settings: (settings.data as PatotaSettings | null) ?? DEFAULT_SETTINGS,
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
    const rounds = unwrap<Round[]>(
      await client()
        .from('rounds')
        .insert({
          date: input.date,
          title: input.title,
          start_time: input.start_time,
          location: input.location,
          team_count: input.team_count,
          max_players: input.max_players,
          status: 'rascunho',
        })
        .select(),
    )
    return rounds[0]
  },

  async updateSettings(patch: Partial<PatotaSettings>) {
    unwrap(
      await client()
        .from('patota_settings')
        .upsert({ ...patch, id: 'default' })
        .select(),
    )
  },

  async updateRound(id: string, patch: Partial<Round>) {
    unwrap(await client().from('rounds').update(patch).eq('id', id).select())
  },

  async deleteRound(id: string) {
    const { error } = await client().from('rounds').delete().eq('id', id)
    if (error) throw new Error(translate(error.message))
  },

  async respondAttendance(roundId: string, wants: 'confirmado' | 'fora') {
    const { error } = await client().rpc('respond_attendance', {
      p_round_id: roundId,
      p_wants: wants,
    })
    if (error) throw new Error(translate(error.message))
  },

  async setAttendance(roundId: string, changes: AttendanceInput[]) {
    if (changes.length === 0) return
    const db = client()
    const existing = unwrap<RoundPlayer[]>(
      await db.from('round_players').select('*').eq('round_id', roundId),
    )
    const byPlayer = new Map(existing.map((row) => [row.player_id, row]))

    const inserts = changes
      .filter((change) => !byPlayer.has(change.player_id))
      .map((change) => ({
        round_id: roundId,
        player_id: change.player_id,
        attendance: change.attendance,
        responded_at: change.responded_at ?? new Date().toISOString(),
      }))

    if (inserts.length > 0) {
      unwrap(await db.from('round_players').insert(inserts).select())
    }

    for (const change of changes) {
      const row = byPlayer.get(change.player_id)
      if (!row) continue
      const patch: Partial<RoundPlayer> = { attendance: change.attendance }
      // Quem deixa de estar confirmado sai do time: o sorteio já podia ter
      // acontecido, e um desistente com time continuaria na escalação e nas
      // estatísticas da partida que ele não jogou.
      if (change.attendance !== 'confirmado') patch.team_id = null
      if (change.responded_at) patch.responded_at = change.responded_at
      const { error } = await db.from('round_players').update(patch).eq('id', row.id)
      if (error) throw new Error(translate(error.message))
    }
  },

  async setRoundPosition(roundId: string, playerId: string, position: PlayerPosition) {
    const { error } = await client()
      .from('round_players')
      .update({ position })
      .eq('round_id', roundId)
      .eq('player_id', playerId)
    if (error) throw new Error(translate(error.message))
  },

  async removeFromRound(roundId: string, playerId: string) {
    const { error } = await client()
      .from('round_players')
      .delete()
      .eq('round_id', roundId)
      .eq('player_id', playerId)
    if (error) throw new Error(translate(error.message))
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
