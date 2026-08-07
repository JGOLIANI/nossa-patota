#!/usr/bin/env node
/**
 * Script de configuração do Nossa Patota.
 *
 *   npm run setup                 # perguntas no terminal
 *   npm run setup -- --demo       # apaga o .env e usa o modo demonstração
 *   npm run setup -- --check      # só valida a configuração atual
 *   npm run setup -- --url=https://xxx.supabase.co --key=eyJ... --yes
 *
 * O script grava o arquivo `.env`, valida as credenciais e — se houver rede —
 * verifica se o schema já foi aplicado no projeto Supabase.
 */
import { createInterface } from 'node:readline/promises'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin, stdout, argv, exit } from 'node:process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
const schemaPath = resolve(root, 'supabase/schema.sql')

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
}

const ok = (text) => console.log(`${C.green}✓${C.reset} ${text}`)
const warn = (text) => console.log(`${C.yellow}!${C.reset} ${text}`)
const fail = (text) => console.log(`${C.red}✗${C.reset} ${text}`)
const title = (text) => console.log(`\n${C.bold}${text}${C.reset}`)
const hint = (text) => console.log(`${C.dim}${text}${C.reset}`)

// ------------------------------------------------------------ argumentos ---

function parseArgs(args) {
  const flags = { demo: false, check: false, yes: false, url: '', key: '' }
  for (const arg of args) {
    if (arg === '--demo') flags.demo = true
    else if (arg === '--check') flags.check = true
    else if (arg === '--yes' || arg === '-y') flags.yes = true
    else if (arg.startsWith('--url=')) flags.url = arg.slice(6).trim()
    else if (arg.startsWith('--key=')) flags.key = arg.slice(6).trim()
    else if (arg === '--help' || arg === '-h') flags.help = true
  }
  return flags
}

// ------------------------------------------------------------- validação ---

function validateUrl(value) {
  if (!value) return 'Informe a URL do projeto.'
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return 'URL inválida. Ela se parece com https://abcdefgh.supabase.co'
  }
  if (parsed.protocol !== 'https:') return 'A URL precisa começar com https://'
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return 'Use apenas o endereço base, sem caminho depois do domínio.'
  }
  return ''
}

function validateKey(value) {
  if (!value) return 'Informe a chave anônima (anon/publishable).'
  const isJwt = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(value)
  const isPublishable = /^sb_publishable_[\w-]+$/.test(value)
  if (!isJwt && !isPublishable) {
    return 'Chave em formato inesperado. Copie a chave "anon public" do painel.'
  }
  if (/^eyJ/.test(value)) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString())
      if (payload.role === 'service_role') {
        return 'Esta é a chave service_role — ela NUNCA deve ir para o aplicativo. Use a chave anon.'
      }
    } catch {
      // Chave opaca: seguimos apenas com a validação de formato.
    }
  }
  return ''
}

// ----------------------------------------------------------------- .env ----

function readEnv() {
  if (!existsSync(envPath)) return {}
  const values = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return values
}

function writeEnv(url, key) {
  const content = [
    '# Gerado por `npm run setup`.',
    '# Estas variáveis são públicas por natureza: a chave anon só funciona',
    '# junto com as políticas de RLS definidas em supabase/schema.sql.',
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_ANON_KEY=${key}`,
    '',
  ].join('\n')
  writeFileSync(envPath, content)
}

// ------------------------------------------------------------ conexão -----

async function checkConnection(url, key) {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/players?select=id&limit=1`
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    })

    if (response.status === 401 || response.status === 403) {
      return { state: 'bad-key', detail: `HTTP ${response.status}` }
    }
    if (response.status === 404) return { state: 'no-schema' }
    if (!response.ok) {
      const body = await response.text()
      if (/relation .*players.* does not exist/i.test(body)) return { state: 'no-schema' }
      return { state: 'error', detail: `HTTP ${response.status} ${body.slice(0, 120)}` }
    }
    return { state: 'ready' }
  } catch (cause) {
    return { state: 'offline', detail: cause instanceof Error ? cause.message : String(cause) }
  }
}

// -------------------------------------------------------------- fluxos ----

function printHelp() {
  console.log(`
${C.bold}Configuração do Nossa Patota${C.reset}

  npm run setup                  perguntas no terminal
  npm run setup -- --demo        modo demonstração (sem Supabase)
  npm run setup -- --check       apenas valida o que já está configurado
  npm run setup -- --url=<URL> --key=<ANON_KEY> --yes

Onde encontrar os valores: painel do Supabase → Project Settings → API.
`)
}

function printSchemaSteps() {
  title('Passo seguinte — aplicar o schema')
  console.log('  1. Abra o painel do Supabase → SQL Editor → New query.')
  console.log(`  2. Cole todo o conteúdo de ${C.cyan}supabase/schema.sql${C.reset} e execute.`)
  console.log('  3. Em Authentication → Providers → Email, desligue "Confirm email".')
  console.log(`  4. No aplicativo, use ${C.cyan}Primeiro acesso${C.reset} com o usuário "admin".`)
  hint(`\n  O arquivo tem ${readFileSync(schemaPath, 'utf8').split('\n').length} linhas e pode ser reaplicado quantas vezes precisar.`)
}

async function runDemo() {
  if (existsSync(envPath)) {
    rmSync(envPath)
    ok('.env removido — o aplicativo vai abrir em modo demonstração.')
  } else {
    ok('Nenhum .env encontrado — o aplicativo já abre em modo demonstração.')
  }
  hint('Entre com o usuário "admin" e qualquer senha. Os dados ficam no navegador.')
  console.log('\nAgora rode: npm run dev')
}

async function runCheck() {
  const env = readEnv()
  const url = env.VITE_SUPABASE_URL ?? ''
  const key = env.VITE_SUPABASE_ANON_KEY ?? ''

  if (!url && !key) {
    warn('Nenhuma credencial configurada — o aplicativo roda em modo demonstração.')
    hint('Rode `npm run setup` para conectar ao Supabase.')
    return 0
  }

  const urlError = validateUrl(url)
  const keyError = validateKey(key)
  if (urlError) fail(`VITE_SUPABASE_URL: ${urlError}`)
  else ok(`VITE_SUPABASE_URL = ${url}`)
  if (keyError) fail(`VITE_SUPABASE_ANON_KEY: ${keyError}`)
  else ok('VITE_SUPABASE_ANON_KEY em formato válido')
  if (urlError || keyError) return 1

  title('Testando a conexão')
  const result = await checkConnection(url, key)
  if (result.state === 'ready') {
    ok('Conectado e com o schema aplicado. Tudo pronto!')
    return 0
  }
  if (result.state === 'no-schema') {
    warn('Conectado, mas a tabela "players" ainda não existe.')
    printSchemaSteps()
    return 1
  }
  if (result.state === 'bad-key') {
    fail(`A chave foi recusada pelo Supabase (${result.detail}).`)
    return 1
  }
  if (result.state === 'offline') {
    warn(`Não foi possível alcançar o Supabase agora (${result.detail}).`)
    hint('Isso não impede o build — verifique a rede e rode novamente quando puder.')
    return 0
  }
  fail(`Resposta inesperada: ${result.detail}`)
  return 1
}

async function runInteractive(flags) {
  const env = readEnv()
  let url = flags.url || env.VITE_SUPABASE_URL || ''
  let key = flags.key || env.VITE_SUPABASE_ANON_KEY || ''

  if (!flags.yes) {
    title('Conectar ao Supabase')
    hint('Painel do Supabase → Project Settings → API.')
    hint('Deixe em branco e pressione Enter para usar o modo demonstração.\n')

    const rl = createInterface({ input: stdin, output: stdout })
    try {
      const askedUrl = (await rl.question(`URL do projeto ${url ? `[${url}] ` : ''}› `)).trim()
      url = askedUrl || url
      if (!url) {
        rl.close()
        await runDemo()
        return 0
      }

      let urlError = validateUrl(url)
      while (urlError) {
        fail(urlError)
        url = (await rl.question('URL do projeto › ')).trim()
        urlError = validateUrl(url)
      }

      const askedKey = (await rl.question(`Chave anon ${key ? '[mantida] ' : ''}› `)).trim()
      key = askedKey || key
      let keyError = validateKey(key)
      while (keyError) {
        fail(keyError)
        key = (await rl.question('Chave anon › ')).trim()
        keyError = validateKey(key)
      }
    } finally {
      rl.close()
    }
  }

  const urlError = validateUrl(url)
  const keyError = validateKey(key)
  if (urlError || keyError) {
    fail(urlError || keyError)
    hint('Use --url= e --key= ou rode sem --yes para responder às perguntas.')
    return 1
  }

  writeEnv(url, key)
  ok(`.env gravado em ${envPath.replace(`${root}/`, '')}`)

  title('Testando a conexão')
  const result = await checkConnection(url, key)
  if (result.state === 'ready') {
    ok('Conectado e com o schema aplicado.')
    console.log('\nAgora rode: npm run dev')
    return 0
  }
  if (result.state === 'no-schema') {
    warn('Conectado, mas o schema ainda não foi aplicado.')
    printSchemaSteps()
    return 0
  }
  if (result.state === 'bad-key') {
    fail(`A chave foi recusada pelo Supabase (${result.detail}). Confira se copiou a chave "anon public".`)
    return 1
  }
  if (result.state === 'offline') {
    warn(`Sem resposta do Supabase agora (${result.detail}). As credenciais foram salvas mesmo assim.`)
    printSchemaSteps()
    return 0
  }
  fail(`Resposta inesperada: ${result.detail}`)
  return 1
}

// ---------------------------------------------------------------- main ----

const flags = parseArgs(argv.slice(2))

if (flags.help) {
  printHelp()
  exit(0)
}

if (!existsSync(schemaPath)) {
  fail('Arquivo supabase/schema.sql não encontrado. Rode o script na raiz do projeto.')
  exit(1)
}

const code = flags.demo
  ? ((await runDemo()), 0)
  : flags.check
    ? await runCheck()
    : await runInteractive(flags)

exit(code)
