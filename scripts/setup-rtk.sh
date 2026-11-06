#!/usr/bin/env bash
# Instala o rtk (https://github.com/rtk-ai/rtk) e confere se o hook do Claude
# Code deste projeto consegue usá-lo. O rtk enxuga a saída de comandos como
# `git status` e `npm test` antes de ela chegar ao Claude, economizando tokens.
#
#   bash scripts/setup-rtk.sh           # instala (pede confirmação) e verifica
#   bash scripts/setup-rtk.sh --yes     # instala sem perguntar
#   bash scripts/setup-rtk.sh --check   # só verifica, não instala nada
#
# Não é preciso rodar `rtk init`: o hook já vem registrado em
# .claude/settings.json e só age quando o rtk está no PATH.
# No Windows, rode pelo Git Bash (o mesmo que o Claude Code usa).
set -euo pipefail

MIN_VERSION="0.37.2" # primeira versão com `rtk hook claude` nativo (sem bash/jq)
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

CHECK_ONLY=0 YES=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "Opção desconhecida: $arg (use --help)" ;;
  esac
done

case "$(uname -s)" in
  Linux*) OS=linux ;;
  Darwin*) OS=mac ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) fail "Sistema não suportado: $(uname -s)" ;;
esac

# Onde os instaladores costumam deixar o binário, caso o PATH desta sessão
# ainda não os conheça (instalação recém-feita, terminal antigo).
extra_paths() {
  if [ "$OS" = windows ] && [ -n "${LOCALAPPDATA:-}" ]; then
    command -v cygpath >/dev/null 2>&1 && cygpath -u "$LOCALAPPDATA/Microsoft/WinGet/Links"
  else
    echo "$HOME/.local/bin"
  fi
}

add_extra_paths() {
  local p
  while IFS= read -r p; do
    [ -n "$p" ] && [ -d "$p" ] || continue
    case ":$PATH:" in *":$p:"*) ;; *) PATH="$PATH:$p" ;; esac
  done < <(extra_paths)
}

version_ge() { # $1 >= $2, comparando x.y.z numericamente
  [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -n1)" = "$2" ]
}

rtk_version() { rtk --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1; }

install_rtk() {
  case "$OS" in
    linux|mac)
      if command -v brew >/dev/null 2>&1; then
        brew install rtk
      else
        command -v curl >/dev/null 2>&1 || fail "curl não encontrado; instale o curl e rode de novo."
        # Instalador oficial: baixa o binário da release, confere o SHA-256 e
        # grava em ~/.local/bin. RTK_VERSION=vX.Y.Z fixa uma versão.
        curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
      fi
      ;;
    windows)
      command -v winget >/dev/null 2>&1 \
        || fail "winget não encontrado. Instale pelo 'App Installer' da Microsoft Store ou baixe o rtk em https://github.com/rtk-ai/rtk/releases"
      winget install --id rtk-ai.rtk --exact --accept-source-agreements --accept-package-agreements
      ;;
  esac
}

printf '\n%srtk para o Claude Code — Nossa Patota%s\n\n' "$B" "$N"

command -v node >/dev/null 2>&1 || fail "Node.js não encontrado (o hook roda com node, o mesmo do npm)."

ORIG_PATH="$PATH"
add_extra_paths

# 1. Binário ---------------------------------------------------------------
if command -v rtk >/dev/null 2>&1; then
  if ! rtk gain >/dev/null 2>&1; then
    fail "O 'rtk' do seu PATH ($(command -v rtk)) não é o rtk-ai — provavelmente o Rust Type Kit, que tem o mesmo nome.
  Remova-o (ex.: cargo uninstall rtk) e rode este script de novo."
  fi
  VERSION="$(rtk_version)"
  if ! version_ge "$VERSION" "$MIN_VERSION"; then
    warn "rtk $VERSION encontrado, mas o hook precisa da $MIN_VERSION ou mais nova. Atualize com:"
    case "$OS" in
      windows) hint "winget upgrade --id rtk-ai.rtk" ;;
      *) command -v brew >/dev/null 2>&1 && brew list rtk >/dev/null 2>&1 \
           && hint "brew upgrade rtk" \
           || hint "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh" ;;
    esac
    exit 1
  fi
  ok "rtk $VERSION já instalado ($(command -v rtk))"
else
  [ "$CHECK_ONLY" = 1 ] && fail "rtk não está instalado. Rode: bash scripts/setup-rtk.sh"
  if [ "$YES" != 1 ]; then
    [ -t 0 ] || fail "Sem terminal para confirmar. Rode com --yes para instalar sem perguntar."
    read -r -p "O rtk não está instalado. Instalar agora? [S/n] " answer
    case "${answer:-s}" in [sSyY]*) ;; *) echo "Nada foi instalado."; exit 0 ;; esac
  fi
  install_rtk
  add_extra_paths
  hash -r
  command -v rtk >/dev/null 2>&1 \
    || fail "Instalado, mas o rtk ainda não aparece no PATH. Abra um terminal novo e rode: bash scripts/setup-rtk.sh --check"
  ok "rtk $(rtk_version) instalado ($(command -v rtk))"
fi

# 2. Hook do projeto -------------------------------------------------------
grep -q 'hooks/rtk.mjs' "$ROOT/.claude/settings.json" 2>/dev/null \
  || fail "O hook não está em .claude/settings.json — atualize sua branch com a main."

payload='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git status"},"cwd":"'"$ROOT"'"}'
if (cd "$ROOT" && printf '%s' "$payload" | node .claude/hooks/rtk.mjs) | grep -q 'rtk git status'; then
  ok "Hook do Claude Code funcionando (git status → rtk git status)"
else
  fail "O hook não reescreveu o comando de teste. Veja: rtk init --show"
fi

if grep -qs 'rtk hook claude\|rtk-rewrite' "$HOME/.claude/settings.json"; then
  hint "Você também tem o hook global do rtk (rtk init -g). Tudo bem: os dois convivem, o comando só é reescrito uma vez."
fi

# 3. Recado final ----------------------------------------------------------
echo
RTK_DIR="$(dirname "$(command -v rtk)")"
if case ":$ORIG_PATH:" in *":$RTK_DIR:"*) false ;; *) true ;; esac; then
  warn "O rtk está em $RTK_DIR, que não está no PATH deste terminal — o Claude Code não vai achá-lo."
  if [ "$OS" = windows ]; then
    hint "Abra um terminal novo (o winget já ajustou o PATH) e rode: bash scripts/setup-rtk.sh --check"
  else
    hint "Adicione ao ~/.bashrc ou ~/.zshrc:  export PATH=\"$RTK_DIR:\$PATH\""
    hint "Depois abra um terminal novo e rode: bash scripts/setup-rtk.sh --check"
  fi
  exit 0
fi
ok "Pronto. Reinicie o Claude Code para o hook valer nas próximas sessões."
hint "Ver a economia: rtk gain · desligar só para você: RTK_DISABLED=1 no env do .claude/settings.local.json"
