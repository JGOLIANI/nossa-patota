import { describe, expect, it } from 'vitest'
import { emailToUsername, normalizeProjectUrl, normalizeUsername, usernameToEmail } from './supabase'

describe('endereço do projeto no Supabase', () => {
  it('deixa passar o endereço base', () => {
    expect(normalizeProjectUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co')
  })

  it('corta a barra do fim', () => {
    expect(normalizeProjectUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co')
  })

  it('corta o sufixo copiado da documentação da API', () => {
    expect(normalizeProjectUrl('https://abc.supabase.co/rest/v1/')).toBe('https://abc.supabase.co')
    expect(normalizeProjectUrl('https://abc.supabase.co/auth/v1')).toBe('https://abc.supabase.co')
    expect(normalizeProjectUrl('  https://abc.supabase.co/storage/v1  ')).toBe(
      'https://abc.supabase.co',
    )
  })

  it('não mexe em domínio próprio que não termina no sufixo', () => {
    expect(normalizeProjectUrl('https://api.minhapatota.com.br')).toBe(
      'https://api.minhapatota.com.br',
    )
  })
})

describe('login por nome de usuário', () => {
  it('vai e volta pelo e-mail em domínio reservado', () => {
    expect(usernameToEmail('  Igor.Santos ')).toBe('igor.santos@patota.local')
    expect(emailToUsername('igor.santos@patota.local')).toBe('igor.santos')
  })

  it('sem e-mail, o nome de usuário é vazio', () => {
    expect(emailToUsername(null)).toBe('')
    expect(emailToUsername(undefined)).toBe('')
  })

  it('normaliza espaços e caixa', () => {
    expect(normalizeUsername('  IGOR  ')).toBe('igor')
  })
})
