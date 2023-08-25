local status, telescope = pcall(require, 'telescope')
if (not status) then return end
local builtin = require('telescope.builtin')
local actions = require('telescope.actions')


telescope.setup {
    defaults = {
        mappings = {
            n = {
                ["q"] = actions.close
            },
        },
    },
    --    extensions = {
    --        file_browser = {
    -- theme = "dropdown",
    -- disable netrw
    -- hijack_netrw = true
    --  }
    -- }
}

-- telescope.load_extension('file_browser')
telescope.load_extension('fzf')

vim.keymap.set('n', '<leader>sf', builtin.find_files, { desc = '[S]earch [F]iles' })
vim.keymap.set('n', '<leader>sh', builtin.help_tags, { desc = '[S]earch [H]elp' })
vim.keymap.set('n', '<leader>sb', builtin.buffers, { desc = '[S]earch [B]uffers' })
vim.keymap.set('n', '<leader>sg', builtin.live_grep, { desc = '[S]earch [G]rep' })
vim.keymap.set('n', '<leader>/', function()
    builtin.current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
        winblend = 10,
        previewer = false,
    })
end, { desc = '[/] Fuzzily search in current buffer' })
vim.keymap.set('n', '<C-p>', builtin.git_files, {})
