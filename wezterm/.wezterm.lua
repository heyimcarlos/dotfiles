-- -- Pull in the wezterm API
local wezterm = require("wezterm")

local config = {}

if wezterm.config_builder then
	config = wezterm.config_builder()
end

config.font = wezterm.font_with_fallback({
	"MesloLGS Nerd Font",
})

-- Font
config.font_size = 12
config.line_height = 1.1
config.cell_width = 0.9

config.use_fancy_tab_bar = false
config.enable_tab_bar = false
config.color_scheme = "Github Dark"
config.window_background_opacity = 0.925
config.window_decorations = "RESIZE"
config.enable_scroll_bar = false

-- config.enable_wayland = true
-- config.front_end = "WebGpu"

config.max_fps = 120

config.window_padding = {
	left = 0,
	right = 0,
	top = 0,
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
