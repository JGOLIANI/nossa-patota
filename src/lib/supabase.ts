import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** Sem credenciais o aplicativo entra automaticamente no modo demonstração. */
export const hasSupabaseConfig = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/**
 * O login da patota é por nome de usuário. O Supabase Auth trabalha com
 * e-mail, então mapeamos para um endereço em domínio reservado (`.local`),
 * que nunca é roteável e não envia mensagens a terceiros.
 */
export const USERNAME_DOMAIN = 'patota.local'

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`
}

export function emailToUsername(email: string | undefined | null): string {
  return (email ?? '').split('@')[0]
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}
