import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Deixa a URL do projeto na forma que o cliente do Supabase espera: só o
 * endereço base.
 *
 * Copiar o endereço que aparece na documentação da API do painel é o engano
 * mais fácil de cometer — vem com `/rest/v1` no fim, e aí o cliente monta
 * `/rest/v1/rest/v1/…` e `/rest/v1/auth/v1/token`. Nada funciona, e a tela de
 * entrada não sabe dizer por quê. Nenhum projeto tem endereço base terminado
 * em `/rest/v1`, então cortar o sufixo não tira nada de ninguém.
 */
export function normalizeProjectUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+$/i, '')
}

const url = normalizeProjectUrl(import.meta.env.VITE_SUPABASE_URL ?? '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** Sem credenciais o aplicativo entra automaticamente no modo demonstração. */
export const hasSupabaseConfig = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url, anonKey!, {
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
