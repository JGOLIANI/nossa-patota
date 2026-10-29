#!/usr/bin/env node
/**
 * Hook PreToolUse do Claude Code para o graphify
 * (https://github.com/Graphify-Labs/graphify): quando existe um grafo do
 * código em graphify-out/, lembra o Claude de consultá-lo (`graphify query`)
 * antes de sair fazendo grep e lendo arquivo por arquivo.
 *
 *   node .claude/hooks/graphify.mjs search   # Bash|Grep
 *   node .claude/hooks/graphify.mjs read     # Read|Glob
 *
 * É opcional por construção: sem grafo (graphify-out/ não é versionado), sem o
 * graphify no PATH ou com GRAPHIFY_DISABLED=1, o hook sai sem dizer nada.
 * Para instalar: bash scripts/setup-graphify.sh
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const kind = process.argv[2]
if (kind !== 'search' && kind !== 'read') process.exit(0)
if (process.env.GRAPHIFY_DISABLED === '1') process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const graph = resolve(root, process.env.GRAPHIFY_OUT || 'graphify-out', 'graph.json')

// Sem grafo — o caso de quem não usa o graphify — nem vale chamar o Python.
if (!existsSync(graph)) process.exit(0)

let input = ''
for await (const chunk of process.stdin) input += chunk

const res = spawnSync('graphify', ['hook-guard', kind], {
  input,
  cwd: root,
  encoding: 'utf8',
  timeout: 10_000,
})

// graphify ausente, antigo, travado ou com erro: não atrapalha a ferramenta.
if (res.error || res.status !== 0) process.exit(0)
process.stdout.write(res.stdout)
