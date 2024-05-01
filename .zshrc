# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(
    git
)

# Reevaluate the prompt string each time it's displaying a prompt
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
# compinit

source $ZSH/oh-my-zsh.sh

source $(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# starship
eval "$(starship init zsh)"
export STARSHIP_CONFIG=~/.config/starship/starship.toml

export LANG=en_US.UTF-8

export EDITOR=/opt/homebrew/bin/nvim

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

# Dirs
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias .....="cd ../../../.."
alias ......="cd ../../../../.."

# Example aliases
alias g="git"
alias vi="nvim"
alias vim="nvim"
alias python="python3"
alias py="python3"
alias pip="pip3"
alias rs="rustc"

# GOROOT -> where packages are installed
export GOROOT=/usr/local/go

# GOPATH -> where work directory is
export GOPATH=$HOME/go
export PATH=$GOPATH/bin:$GOROOT/bin:$PATH

# Python 3.9
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# custom scripts folder
export PATH="$HOME/bin:$PATH"

source ~/.zsh_profile

export NVM_DIR="$HOME/.nvm"
  [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"  # This loads nvm
  [ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

export LDFLAGS="-L/opt/homebrew/opt/llvm/lib"
export CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
export OPENSSL_DIR=$(brew --prefix openssl)
export OPENSSL_LIB_DIR=$(brew --prefix openssl)/lib
export OPENSSL_INCLUDE_DIR=$(brew --prefix openssl)/include
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"

# fzf
eval "$(fzf --zsh)"

# zoxide
eval "$(zoxide init zsh)"
