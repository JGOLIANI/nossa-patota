#!/usr/bin/env node
/**
 * Guarda do deploy: confere as credenciais do Supabase antes do build.
 *
 * Sem esta verificação a falha é invisível. O build não depende das variáveis
 * para terminar: se elas faltarem, o Vite compila do mesmo jeito, o site sobe
 * e cada visitante cai no modo demonstração — com a patota fictícia guardada
 * só no aparelho dele. O deploy fica verde e ninguém desconfia.
 *
 * Aqui o erro vira vermelho, com o motivo escrito.
 *
 * Nada do valor das credenciais é impresso: no GitHub Actions os secrets
 * saem mascarados do log, mas o texto decodificado de um JWT não sairia.
 */
import { env, exit } from 'node:process'
import { validateKey, validateUrl } from './credentials.mjs'

const C = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m' }

const url = env.VITE_SUPABASE_URL?.trim()
const key = env.VITE_SUPABASE_ANON_KEY?.trim()

// Escotilha para quem quer publicar a vitrine mesmo: uma demonstração
// pública, um fork sem banco. Precisa ser dito em voz alta.
if (env.ALLOW_DEMO_BUILD === '1') {
  console.log('! ALLOW_DEMO_BUILD=1 — publicando em modo demonstração, sem Supabase.')
  exit(0)
}

const problems = []

if (!url && !key) {
  problems.push(
    'Nenhuma credencial chegou ao build.\n' +
      '    Cadastre os dois secrets em Settings → Secrets and variables → Actions:\n' +
      '      VITE_SUPABASE_URL       https://seu-projeto.supabase.co\n' +
      '      VITE_SUPABASE_ANON_KEY  a chave "anon public"\n' +
      '    Eles só entram em builds novos: republique depois de cadastrar.',
  )
} else {
  if (!url) problems.push('Falta o secret VITE_SUPABASE_URL.')
  else {
    const error = validateUrl(url)
    if (error) problems.push(`VITE_SUPABASE_URL: ${error}`)
  }

  if (!key) problems.push('Falta o secret VITE_SUPABASE_ANON_KEY.')
  else {
    const error = validateKey(key)
    if (error) problems.push(`VITE_SUPABASE_ANON_KEY: ${error}`)
  }
}

if (problems.length > 0) {
  console.error(
    `\n${C.red}${C.bold}✗ As credenciais do Supabase não passaram na conferência${C.reset}\n`,
  )
  for (const problem of problems) console.error(`  ${C.red}•${C.reset} ${problem}`)

  // As duas saídas erradas são diferentes, e confundi-las manda a pessoa
  // procurar o problema no lugar errado. Sem nenhuma credencial o aplicativo
  // entra em modo demonstração; com credencial torta ele tenta o Supabase de
  // verdade e trava no login.
  console.error(
    !url || !key
      ? '\n  Publicar assim colocaria no ar um aplicativo em modo demonstração,\n' +
          '  onde cada visitante enxerga uma patota fictícia só dele.\n'
      : '\n  Publicar assim colocaria no ar um aplicativo que tenta falar com o\n' +
          '  Supabase e falha no login — tela de entrada recusando todo mundo.\n',
  )
  exit(1)
}

console.log(`${C.green}✓${C.reset} Credenciais do Supabase conferidas.`)
