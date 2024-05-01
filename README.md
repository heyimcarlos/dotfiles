# Dotfiles Repository

This repository contains personal configuration files (dotfiles) that I use to customize my system setup. These configurations help streamline my development environment and maintain consistency across various setups.

## Contents

- **.config/**
  - **nvim/**: My personal Neovim setup as a submodule.
  - **tmux/**: Configuration files for tmux, tailored specifically for macOS.
  - **starship/**: Replacement for p10k, written in Rust.
- **bin/**: Custom scripts to enhance productivity.
- **.gitconfig**: Git configuration settings.
- **.gitignore**: Specifies intentionally untracked files to ignore.
- **.gitmodules**: Tracks the submodules associated with this repository.
- **.zsh_profile**: Custom Zsh configurations.
- **iterm2-profile.json**: iTerm2 terminal settings for macOS.

## Setup

### Cloning the Repository

To clone this repository, including its submodules, run the following command:

```bash
git clone --recurse-submodules https://github.com/yourusername/dotfiles.git
```

If you've already cloned the repository and missed the submodules, you can fetch them with:

```bash
git submodule update --init --recursive
```

To clone and install, run the following command:

```bash
git clone --recurse-submodules https://github.com/heyimcarlos/dotfiles.git "${XDG_CONFIG_HOME:-$HOME}"
```

### Configuration Details

- **Neovim**:
  - The Neovim configuration is maintained as a submodule pointing to [kickstart.nvim](https://github.com/heyimcarlos/kickstart.nvim).
- **Tmux**:
  - `macos.conf`: Tmux settings optimized for macOS.
  - `statusline.conf`: Customizes the tmux status line.
  - `tmux.conf`: Main tmux configuration file.
  - `utility.conf`: Additional utilities for tmux.
- **Scripts**:
  - `open_vertical_pane`: Script to open new panes vertically in tmux.
  - `tmux-sessionizer`: A quick session management script for tmux.
