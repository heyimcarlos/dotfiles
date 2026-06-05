#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/monitor-lib.sh"

LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
LOG_FILE="$LOG_DIR/lid.log"
mkdir -p "$LOG_DIR"

log() {
    printf '%s %s\n' "$(date --iso-8601=seconds)" "$*" >> "$LOG_FILE"
}

suspend_system() {
    reason="$1"
    log "$reason: suspending system"
    systemctl suspend >> "$LOG_FILE" 2>&1 || log "$reason: WARNING systemctl suspend failed"
}

# The built-in panel disappears from Hyprland when the lid is closed on this
# laptop. On lid open, wait for the panel to reappear by stable description,
# then re-enable its current connector name with auto placement.
enable_laptop_after_open() {
    log "lid open: waiting for laptop panel '$LAPTOP_MONITOR_DESCRIPTION' to appear, then enabling with auto layout"
    for delay in 0 0.25 0.5 1 2 3; do
        sleep "$delay"
        if laptop_present_in_hyprland; then
            laptop="$(laptop_monitor_name)"
            log "lid open: resolved laptop panel as $laptop"
            hyprctl keyword monitor "$laptop, preferred, auto, $LAPTOP_MONITOR_SCALE" >> "$LOG_FILE" 2>&1 || true
            hyprctl dispatch dpms on "$laptop" >> "$LOG_FILE" 2>&1 || true
            if hyprctl monitors all 2>/dev/null | awk -v laptop="$laptop" '
                $1 == "Monitor" && $2 == laptop { in_laptop=1 }
                in_laptop && /disabled: false/ { enabled=1 }
                in_laptop && /dpmsStatus: 1/ { dpms=1 }
                /^$/ { in_laptop=0 }
                END { exit (enabled && dpms) ? 0 : 1 }
            '; then
                log "lid open: $laptop enabled and DPMS on"
                return 0
            fi
        else
            log "lid open: laptop panel not present yet after ${delay}s"
        fi
    done
    log "lid open: WARNING laptop panel did not become ready"
    return 1
}

handle_lid_closed() {
    # Let Hyprland/kernel process the lid-close output change first.
    sleep 0.5
    externals="$(active_external_count)"
    if [ "${externals:-0}" -gt 0 ]; then
        log "lid closed: $externals external monitor(s) active; staying awake"
        # If the laptop panel is still present briefly after close, disable it.
        # On this laptop it may also disappear by itself; both outcomes are OK.
        if laptop_present_in_hyprland; then
            laptop="$(laptop_monitor_name)"
            log "lid closed: disabling $laptop while docked"
            hyprctl keyword monitor "$laptop, disable" >> "$LOG_FILE" 2>&1 || true
        fi
    else
        suspend_system "lid closed with no external monitors"
    fi
}

if lid_is_open; then
    enable_laptop_after_open
else
    handle_lid_closed
fi
