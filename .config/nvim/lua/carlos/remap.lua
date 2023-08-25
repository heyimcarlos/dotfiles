local keymap = vim.keymap

-- leader key
vim.g.mapleader = " "

-- disable netrw banner
vim.g.netrw_banner = 0

-- move code in visual selection
keymap.set("v", 'J', ":m '>+1<CR>gv=gv")
keymap.set("v", 'K', ":m '<-2<CR>gv=gv")

-- cut code into same line | J keeps cursor in place
keymap.set("n", 'J', "mzJ`z")

-- copy into os clipboard
keymap.set("n", '<leader>y', "\"+y")
keymap.set("v", '<leader>y', "\"+y")
keymap.set("n", '<leader>Y', "\"+Y")

-- keep cursor intact when searching | [n]ext and [N]previous?
keymap.set('n', 'n', 'nzzzv')
keymap.set('n', 'N', 'Nzzzv')

-- code block jumping | <C-d> and <C-u> keeping cursor in place
keymap.set('n', '<C-d>', '<C-d>zz')
keymap.set('n', '<C-u>', '<C-u>zz')

-- esc
keymap.set("i", "jj", "<Esc>")
keymap.set("i", "jk", "<Esc>")

-- New tab
keymap.set('n', 'te', ':tabedit')

-- tab movement
keymap.set('n', '<Tab>', ':tabnext<Return>')
keymap.set('n', '<S-Tab>', ':tabprev<Return>')

-- Split window
keymap.set('n', 'ss', ':split<Return><C-w>w')
keymap.set('n', 'sv', ':vsplit<Return><C-w>w')

-- Move window
keymap.set('n', '<Space>', '<C-w>w')
keymap.set('', 'sh', '<C-w>h')
keymap.set('', 'sk', '<C-w>k')
keymap.set('', 'sj', '<C-w>j')
keymap.set('', 'sl', '<C-w>l')

-- Resize window
keymap.set('n', '<C-w><left>', '<C-w><')
keymap.set('n', '<C-w><right>', '<C-w>>')
keymap.set('n', '<C-w><up>', '<C-w>+')
keymap.set('n', '<C-w><down>', '<C-w>-')

keymap.set("n", "<leader>pv", vim.cmd.Ex)

keymap.set("n", "<leader>f", vim.lsp.buf.format)
keymap.set("n", "<leader>x", "<cmd>!chmod +x %<CR>", { silent = true })

keymap.set("n", "<leader>vpp", "<cmd>e ~/.dotfiles/nvim/.config/nvim/lua/carlos/packer.lua<CR>");

keymap.set("n", "<leader><leader>", function()
    vim.cmd("so")
end)
