#!/usr/bin/env bash
# Idempotent dotfiles install. Safe to re-run at any time.
#
#   git clone --recurse-submodules https://github.com/heyimcarlos/dotfiles.git ~/repos/dotfiles
#   cd ~/repos/dotfiles && ./install.sh
#
# Layout:
#   - Root-level files (.zshrc, .zsh_profile, tmux/.tmux.conf.local) are
#     symlinked explicitly below.
#   - herdr/, pi/, plannotator/ are GNU Stow packages targeting $HOME.
#   - bin/ is added to PATH by .zshrc; nothing to link.

set -euo pipefail
cd "$(dirname "$0")"
repo=$(pwd)

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# --- dependencies -----------------------------------------------------------
if [[ "$OSTYPE" == darwin* ]] && command -v brew >/dev/null; then
  for pkg in stow fzf jq herdr; do
    command -v "$pkg" >/dev/null || { info "installing $pkg"; brew install "$pkg"; }
  done
fi
for cmd in stow fzf jq git; do
  command -v "$cmd" >/dev/null || { echo "missing dependency: $cmd" >&2; exit 1; }
done

# --- root-level symlinks ----------------------------------------------------
link() { # link <repo-relative-source> <target>
  local src="$repo/$1" dst="$2"
  [[ -e "$src" ]] || { echo "missing source: $src" >&2; return 1; }
  if [[ -L "$dst" && "$(readlink "$dst")" == "$src" ]]; then return 0; fi
  [[ -e "$dst" && ! -L "$dst" ]] && mv "$dst" "$dst.pre-install"
  ln -sfn "$src" "$dst"
  info "linked $dst"
}

link .zshrc               "$HOME/.zshrc"
link .zsh_profile         "$HOME/.zsh_profile"
link tmux/.tmux.conf.local "$HOME/.tmux.conf.local"

# --- stow packages ----------------------------------------------------------
# pi/plannotator/herdr link into dirs that also hold untracked runtime state,
# so stow only the tracked files/dirs (stow folds around existing content).
mkdir -p "$HOME/.pi/agent/extensions" "$HOME/.pi/agent/skills" \
         "$HOME/.plannotator" "$HOME/.config"
info "stowing herdr pi plannotator"
stow -t "$HOME" --restow herdr pi plannotator

# --- pi extensions ----------------------------------------------------------
if [[ -d pi/.pi/agent/extensions/pi-subagent && ! -d pi/.pi/agent/extensions/pi-subagent/node_modules ]]; then
  info "installing pi-subagent deps"
  (cd pi/.pi/agent/extensions/pi-subagent && npm install --silent)
fi

# herdr <-> pi sidebar integration (herdr manages/updates this file)
if command -v herdr >/dev/null; then
  info "installing herdr pi integration"
  herdr integration install pi >/dev/null || true
fi

# pi npm packages (plannotator, extmgr, anthropic auth) install themselves
# from pi/.pi/agent/settings.json "packages" on the next `pi` launch.

info "done. Restart your shell; herdr reloads config with prefix+r."
