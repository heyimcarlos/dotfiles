# Git worktree helpers, ported from dmmulroy's fish functions.
#
# Layout assumption (see the worktrees pi skill): worktrees live as siblings,
# either under a canonical bare root (<repo>/.bare + <repo>/<branch>) or next
# to a normal checkout. Override the location with WT_DIR.
#
#   wt <branch> [base]    create worktree + branch (base defaults to main)
#   wtl                   list worktrees
#   wtcd <dir>            cd into a worktree
#   wtd <branch> [dir]    fetch origin/<branch> into a detached review worktree
#   wtr [-k] <dir>        remove worktree (+ its branch unless -k/--keep)
#   wtp                   prune stale worktree metadata

# Resolve the directory that holds this repo's worktrees.
__wt_dir() {
  if [[ -n "${WT_DIR:-}" ]]; then
    print -r -- "${WT_DIR:A}"
    return
  fi

  local common_dir
  common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1

  # Bare-root layouts keep .bare and all worktrees in the same directory.
  if [[ "${common_dir:t}" == .bare ]]; then
    print -r -- "${common_dir:h}"
    return
  fi

  local top_level
  top_level=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  print -r -- "${top_level:h}"
}

# Create a worktree and matching branch from main, or an optional base branch.
wt() {
  local branch=$1 base=${2:-main}
  if [[ -z "$branch" ]]; then
    echo "Usage: wt branch [base]" >&2
    return 1
  fi
  local worktree_dir
  worktree_dir=$(__wt_dir) || return 1
  git worktree add -b "$branch" "$worktree_dir/$branch" "$base"
}

# List all worktrees registered in the current Git repository.
wtl() { git worktree list }

# Change into a worktree directory.
wtcd() {
  local directory=$1
  if [[ -z "$directory" ]]; then
    echo "Usage: wtcd directory" >&2
    return 1
  fi
  local worktree_dir
  worktree_dir=$(__wt_dir) || return 1
  cd "$worktree_dir/$directory"
}

# Fetch a remote branch and create a detached worktree for reviewing it.
wtd() {
  local branch=$1 directory=${2:-}
  if [[ -z "$branch" ]]; then
    echo "Usage: wtd branch [directory]" >&2
    return 1
  fi
  [[ -z "$directory" ]] && directory=${branch//\//-}
  local worktree_dir
  worktree_dir=$(__wt_dir) || return 1
  git fetch origin "$branch" &&
    git worktree add --detach "$worktree_dir/$directory" "origin/$branch"
}

# Remove a worktree and its checked-out branch unless -k/--keep preserves it.
wtr() {
  local keep=0
  while [[ "$1" == -* ]]; do
    case "$1" in
      -k|--keep) keep=1; shift ;;
      *) echo "Usage: wtr [-k|--keep] directory" >&2; return 1 ;;
    esac
  done
  if [[ $# -ne 1 ]]; then
    echo "Usage: wtr [-k|--keep] directory" >&2
    return 1
  fi

  local worktree_dir worktree
  worktree_dir=$(__wt_dir) || return 1
  if [[ "$1" == /* ]]; then
    worktree=${1:A}
  else
    worktree=${worktree_dir}/$1
    worktree=${worktree:A}
  fi

  local branch
  branch=$(git -C "$worktree" symbolic-ref --quiet --short HEAD 2>/dev/null)

  git worktree remove "$worktree" || return 1
  if (( ! keep )) && [[ -n "$branch" ]]; then
    git branch -d "$branch"
  fi
}

# Prune stale worktree metadata left by manually deleted directories.
wtp() { git worktree prune -v }
