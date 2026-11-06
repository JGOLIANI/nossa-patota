#!/usr/bin/env node
/**
 * Hook PreToolUse do Claude Code: repassa o comando Bash para o rtk
 * (https://github.com/rtk-ai/rtk), que o reescreve para uma versão com saída
 * mais enxuta (`git status` → `rtk git status`) e economiza tokens.
 *
 * É opcional por construção: sem o rtk no PATH, com uma versão antiga ou com
 * RTK_DISABLED=1, o hook sai sem dizer nada e o comando segue intacto.
 * Para instalar: bash scripts/setup-rtk.sh
 */
import { spawnSync } from 'node:child_process'

if (process.env.RTK_DISABLED === '1') process.exit(0)

let input = ''
for await (const chunk of process.stdin) input += chunk

const res = spawnSync('rtk', ['hook', 'claude'], {
  input,
  encoding: 'utf8',
  timeout: 10_000,
})

// rtk ausente, antigo, travado ou com erro: não atrapalha o comando original.
if (res.error || res.status !== 0) process.exit(0)
process.stdout.write(res.stdout)
