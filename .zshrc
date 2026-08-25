# Reevaluate the prompt string each time it's displaying a prompt
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

# Homebrew (macOS) / Linuxbrew
if [[ "$OSTYPE" == darwin* ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv zsh)"
fi

source ~/.config/antigen/antigen.zsh
antigen use oh-my-zsh
antigen bundle git
antigen bundle zsh-users/zsh-autosuggestions
antigen apply

# starship
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml

export LANG=en_US.UTF-8

# Git
alias g="git"

# LazyGit
alias gg=lazygit
alias lg=lazygit

# Dirs
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias ......="cd ../../../../.."

# Vim
alias v="nvim"
alias vi="nvim"
alias vim="nvim"

alias python="python3"
alias py="python3"
alias pip="pip3"
alias rs="rustc"

# Node: fnm (macOS) / nvm (Linux)
if command -v fnm &> /dev/null; then
  eval "$(fnm env --use-on-cd --shell zsh)"
elif [[ -s /usr/share/nvm/init-nvm.sh ]]; then
  source /usr/share/nvm/init-nvm.sh
fi

# Eza
alias l="eza -l --icons --git -a"
alias lt="eza --tree --level=2 --long --icons --git"

# Go
export GOPATH="$HOME/go"
export PATH="$PATH:$GOPATH/bin"
[[ -d /usr/lib/go/bin ]] && export PATH="$PATH:/usr/lib/go/bin"

# custom scripts folder
export PATH="$HOME/.local/bin:$PATH"

[[ -d "$HOME/repos/dotfiles/bin" ]] && export PATH="$HOME/repos/dotfiles/bin:$PATH"
[[ -d "$HOME/dotfiles/bin" ]] && export PATH="$HOME/dotfiles/bin:$PATH"

source ~/.zsh_profile

# CUDA (Linux only)
if [[ -d /opt/cuda ]]; then
  export CUDA_HOME=/opt/cuda
  export PATH=$PATH:$CUDA_HOME/bin
  export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
fi

# fzf
eval "$(fzf --zsh)"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
[[ -s "$HOME/.bun/_bun" ]] && source "$HOME/.bun/_bun"

# Rust: rustup via brew (macOS) / rustup.rs (Linux)
[[ -d /opt/homebrew/opt/rustup/bin ]] && export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"

# opencode
[[ -d "$HOME/.opencode/bin" ]] && export PATH="$HOME/.opencode/bin:$PATH"

# editor
export EDITOR=nvim

# fnm (node + globally installed CLIs like pi); uses the "default" alias
command -v fnm >/dev/null && eval "$(fnm env)"
