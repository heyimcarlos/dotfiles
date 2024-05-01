-- -- Pull in the wezterm API
local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
	config = wezterm.config_builder()
end

-- config.font = wezterm.font_with_fallback({
-- 	"Fira Code",
-- 	"MesloLGS NF",
-- })

config.use_fancy_tab_bar = false
config.color_scheme = "Catppuccin Mocha"
config.enable_tab_bar = false
config.font_size = 14.0
config.macos_window_background_blur = 40
config.window_background_opacity = 0.7
config.window_decorations = "RESIZE"
config.enable_scroll_bar = false

config.window_padding = {
	left = 5,
	right = 0,
	top = 14,
	bottom = 0,
}

config.keys = {
	{
		key = "F",
		mods = "CTRL",
		action = wezterm.action.ToggleFullScreen,
	},
}

config.mouse_bindings = {
	-- Ctrl-click will open the link under the mouse cursor
	{
		event = { Up = { streak = 1, button = "Left" } },
		mods = "CTRL",
		action = wezterm.action.OpenLinkAtMouseCursor,
	},
}

return config
