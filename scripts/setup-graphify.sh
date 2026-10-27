#!/usr/bin/env bash
# Instala o graphify (https://github.com/Graphify-Labs/graphify), gera o grafo
# do código do projeto e confere se o hook do Claude Code consegue usá-lo. Com o
# grafo, o Claude consulta `graphify query` em vez de sair lendo arquivo por
# arquivo, o que economiza tokens.
#
#   bash scripts/setup-graphify.sh                  # instala (pede confirmação) e configura
#   bash scripts/setup-graphify.sh --yes            # instala sem perguntar
#   bash scripts/setup-graphify.sh --check          # só verifica, não instala nada
#   bash scripts/setup-graphify.sh --no-skill       # não instala o /graphify no Claude Code
#
# O grafo fica em graphify-out/ (fora do git) e é gerado só com análise local do
# código: não usa API nem gasta tokens. Ele não se atualiza sozinho: depois de
# mudar o código, rode `graphify update .`. No Windows, rode pelo Git Bash.
set -euo pipefail

MIN_VERSION="0.9.87" # a partir dela o lembrete do hook tem limite por sessão
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -t 1 ]; then
  G=$'\033[32m' Y=$'\033[33m' R=$'\033[31m' B=$'\033[1m' D=$'\033[2m' N=$'\033[0m'
else
  G='' Y='' R='' B='' D='' N=''
fi
ok()   { printf '%s✓%s %s\n' "$G" "$N" "$1"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$1"; }
fail() { printf '%s✗%s %s\n' "$R" "$N" "$1"; exit 1; }
hint() { printf '%s  %s%s\n' "$D" "$1" "$N"; }

CHECK_ONLY=0 YES=0 SKILL=1
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --yes|-y) YES=1 ;;
    --no-skill) SKILL=0 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "Opção desconhecida: $arg (use --help)" ;;
  esac
done

case "$(uname -s)" in
  Linux*) OS=linux ;;
  Darwin*) OS=mac ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) fail "Sistema não suportado: $(uname -s)" ;;
esac

# Onde uv, pipx e o winget costumam deixar os executáveis, caso o PATH desta
# sessão ainda não os conheça (instalação recém-feita, terminal antigo).
extra_paths() {
  echo "$HOME/.local/bin"
  if [ "$OS" = windows ] && [ -n "${LOCALAPPDATA:-}" ] && command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$LOCALAPPDATA/Microsoft/WinGet/Links"
  fi
}

add_extra_paths() {
  local p
  while IFS= read -r p; do
    [ -n "$p" ] && [ -d "$p" ] || continue
    case ":$PATH:" in *":$p:"*) ;; *) PATH="$PATH:$p" ;; esac
  done < <(extra_paths)
  hash -r
}

version_ge() { # $1 >= $2, comparando x.y.z numericamente
  [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)" = "$2" ]
}

gfy_version() { graphify --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1; }

confirm() {
  [ "$YES" = 1 ] && return 0
  [ -t 0 ] || fail "Sem terminal para confirmar. Rode com --yes para instalar sem perguntar."
  local answer
  read -r -p "$1 [S/n] " answer
  case "${answer:-s}" in [sSyY]*) return 0 ;; *) return 1 ;; esac
}

install_uv() {
  case "$OS" in
    linux|mac)
      command -v curl >/dev/null 2>&1 || fail "curl não encontrado; instale o curl ou o uv (https://docs.astral.sh/uv/) e rode de novo."
      curl -LsSf https://astral.sh/uv/install.sh | sh
      ;;
    windows)
      command -v winget >/dev/null 2>&1 \
        || fail "winget não encontrado. Instale o uv (https://docs.astral.sh/uv/) e rode de novo."
      winget install --id astral-sh.uv --exact --accept-source-agreements --accept-package-agreements
      ;;
  esac
  add_extra_paths
  command -v uv >/dev/null 2>&1 \
    || fail "uv instalado, mas ainda não aparece no PATH. Abra um terminal novo e rode este script de novo."
}

# O pacote no PyPI se chama graphifyy (dois y). `pip install graphify` instala
# outro projeto, sem relação. O extra [sql] indexa o supabase/*.sql, onde mora
# boa parte das regras do servidor; se ele falhar na sua plataforma, vai sem.
install_graphify() {
  local tool
  if command -v uv >/dev/null 2>&1; then
    tool="uv tool install"
  elif command -v pipx >/dev/null 2>&1; then
    tool="pipx install"
  else
    warn "O graphify é um pacote Python e precisa do uv (recomendado) ou do pipx."
    confirm "Instalar o uv agora? Ele cuida até do Python." || { echo "Nada foi instalado."; exit 0; }
    install_uv
    tool="uv tool install"
  fi
  $tool "graphifyy[sql]" || { warn "Sem o extra [sql]; tentando o pacote base."; $tool graphifyy; }
  add_extra_paths
}

printf '\n%sgraphify para o Claude Code — Nossa Patota%s\n\n' "$B" "$N"

command -v node >/dev/null 2>&1 || fail "Node.js não encontrado (o hook roda com node, o mesmo do npm)."
command -v git >/dev/null 2>&1 || fail "git não encontrado."

ORIG_PATH="$PATH"
add_extra_paths

# 1. Binário ---------------------------------------------------------------
if command -v graphify >/dev/null 2>&1; then
  if ! graphify --help 2>&1 | grep -q "claude install"; then
    fail "O 'graphify' do seu PATH ($(command -v graphify)) não é o Graphify-Labs/graphify — provavelmente o pacote 'graphify' do PyPI, que tem o mesmo nome.
  Remova-o (ex.: pip uninstall graphify) e rode este script de novo."
  fi
  VERSION="$(gfy_version)"
  if ! version_ge "$VERSION" "$MIN_VERSION"; then
    warn "graphify $VERSION encontrado, mas o projeto precisa da $MIN_VERSION ou mais nova. Atualize com:"
    hint "uv tool upgrade graphifyy   (ou: pipx upgrade graphifyy)"
    exit 1
  fi
  ok "graphify $VERSION já instalado ($(command -v graphify))"
else
  [ "$CHECK_ONLY" = 1 ] && fail "graphify não está instalado. Rode: bash scripts/setup-graphify.sh"
  confirm "O graphify não está instalado. Instalar agora?" || { echo "Nada foi instalado."; exit 0; }
  install_graphify
  command -v graphify >/dev/null 2>&1 \
    || fail "Instalado, mas o graphify ainda não aparece no PATH. Abra um terminal novo e rode: bash scripts/setup-graphify.sh"
  ok "graphify $(gfy_version) instalado ($(command -v graphify))"
fi

cd "$ROOT"

# 2. Grafo do código -------------------------------------------------------
if [ "$CHECK_ONLY" = 1 ]; then
  [ -f graphify-out/graph.json ] || fail "Ainda não há grafo. Rode: bash scripts/setup-graphify.sh"
  ok "Grafo encontrado em graphify-out/"
else
  # Só análise local (tree-sitter): sem API, sem tokens. Incremental nas próximas vezes.
  PYTHONHASHSEED=0 graphify update . >/dev/null
  ok "Grafo do código gerado em graphify-out/ (fora do git)"
fi

# 3. Skill /graphify no Claude Code -----------------------------------------
# Fica no seu perfil (~/.claude/skills), não no repositório: cada um usa a
# versão da skill que combina com o graphify que instalou.
if [ "$CHECK_ONLY" = 0 ] && [ "$SKILL" = 1 ]; then
  graphify install >/dev/null
  ok "Skill /graphify instalada no seu Claude Code (~/.claude/skills/graphify)"
fi

# 4. Hook do projeto -------------------------------------------------------
grep -q 'hooks/graphify.mjs' .claude/settings.json 2>/dev/null \
  || fail "O hook não está em .claude/settings.json — atualize sua branch com a main."

payload='{"session_id":"setup-check-'"$$-$RANDOM"'","hook_event_name":"PreToolUse","tool_name":"Grep","tool_input":{"pattern":"useState"}}'
if printf '%s' "$payload" | CLAUDE_PROJECT_DIR="$ROOT" node .claude/hooks/graphify.mjs search | grep -q 'graphify query'; then
  ok "Hook do Claude Code funcionando (grep → lembrete de usar graphify query)"
else
  fail "O hook não respondeu ao teste. Rode 'graphify update .' e tente de novo."
fi

# 5. Recado final ----------------------------------------------------------
echo
GFY_DIR="$(dirname "$(command -v graphify)")"
if case ":$ORIG_PATH:" in *":$GFY_DIR:"*) false ;; *) true ;; esac; then
  warn "O graphify está em $GFY_DIR, que não está no PATH deste terminal — o Claude Code não vai achá-lo."
  if [ "$OS" = windows ]; then
    hint "Rode 'uv tool update-shell' (ou 'pipx ensurepath'), abra um terminal novo e rode: bash scripts/setup-graphify.sh --check"
  else
    hint "Rode 'uv tool update-shell' (ou adicione ao ~/.bashrc / ~/.zshrc:  export PATH=\"$GFY_DIR:\$PATH\")"
    hint "Depois abra um terminal novo e rode: bash scripts/setup-graphify.sh --check"
  fi
  exit 0
fi
ok "Pronto. Reinicie o Claude Code para o hook valer nas próximas sessões."
hint "Explorar: graphify query \"<pergunta>\" · visual: graphify-out/graph.html"
hint "Atualizar o grafo depois de mudar o código: graphify update ."
hint "Desligar só para você: GRAPHIFY_DISABLED=1 no env do .claude/settings.local.json · remover: graphify uninstall"
