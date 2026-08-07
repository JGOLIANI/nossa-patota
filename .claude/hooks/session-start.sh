#!/bin/bash
# Prepara o ambiente do Claude Code na web: instala as dependências para que
# `npm test`, `npm run lint` e `npm run build` funcionem já na primeira volta.
set -euo pipefail

# Em máquinas locais o desenvolvedor cuida das próprias dependências.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# `npm install` (e não `ci`) aproveita o cache do container entre sessões.
npm install --no-audit --no-fund

# O Chromium já vem no ambiente; impede que algum postinstall tente baixar outro.
{
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
  echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers'
} >> "${CLAUDE_ENV_FILE:-/dev/null}"

echo "Dependências prontas: npm test · npm run lint · npm run build"
