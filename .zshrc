# Reevaluate the prompt string each time it's displaying a prompt
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

source ~/.config/antigen/antigen.zsh
antigen use oh-my-zsh
antigen bundle git
antigen bundle zsh-users/zsh-autosuggestions
antigen bundle marlonrichert/zsh-autocomplete@main
antigen apply

# starship
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml

export SHELL=/usr/bin/zsh

export LANG=en_US.UTF-8

# pnpm
alias pn="pnpm"

# Git
alias gc="git commit -m"
alias gca="git commit -a -m"
alias gp="git push origin HEAD"
alias gpu="git pull origin"
alias gst="git status"
alias glog="git log --graph --topo-order --pretty='%w(100,0,6)%C(yellow)%h%C(bold)%C(black)%d %C(cyan)%ar %C(green)%an%n%C(bold)%C(white)%s %N' --abbrev-commit"
alias gdiff="git diff"
alias gco="git checkout"
alias gb='git branch'
alias gba='git branch -a'
alias gadd='git add'
alias ga='git add -p'
alias gcoall='git checkout -- .'
alias gr='git remote'
alias gre='git reset'
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

source /usr/share/nvm/init-nvm.sh

# Eza
alias l="eza -l --icons --git -a"
alias lt="eza --tree --level=2 --long --icons --git"

export GOPATH="$HOME/go"
export PATH="$PATH:/usr/lib/go/bin:$GOPATH/bin"

# custom scripts folder
export PATH="$HOME/.local/bin:$PATH"

export PATH="$HOME/dotfiles/bin:$PATH"

source ~/.zsh_profile

# CUDA
export CUDA_HOME=/opt/cuda
export PATH=$PATH:$CUDA_HOME/bin
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH


# fzf
eval "$(fzf --zsh)"

# bun completions
[ -s "/home/ren/.bun/_bun" ] && source "/home/ren/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

. "$HOME/.cargo/env"

# opencode
export PATH=/home/ren/.opencode/bin:$PATH

# editor
export EDITOR=nvim

eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv zsh)"
