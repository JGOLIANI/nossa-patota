import { hasSupabaseConfig } from '../lib/supabase'
import { localBackend } from './localBackend'
import { supabaseBackend } from './supabaseBackend'
import type { Backend } from './types'

/**
 * Com as variáveis do Supabase configuradas o aplicativo usa o backend real.
 * Sem elas, cai no modo demonstração local — útil para testar a interface
 * antes de criar o projeto no Supabase.
 */
export const backend: Backend = hasSupabaseConfig ? supabaseBackend : localBackend

export const isDemoMode = backend.mode === 'demo'
