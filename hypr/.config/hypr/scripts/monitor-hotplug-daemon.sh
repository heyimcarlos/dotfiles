#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/monitor-lib.sh"

LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/hypr"
LOG_FILE="$LOG_DIR/monitor-hotplug.log"
mkdir -p "$LOG_DIR"

log() {
    printf '%s %s\n' "$(date --iso-8601=seconds)" "$*" >> "$LOG_FILE"
}

# Best effort startup assertion only when lid is open. If the lid is closed,
# the laptop panel may not exist; lid-open handling will fix it later.
if lid_is_open && laptop_present_in_hyprland; then
    laptop="$(laptop_monitor_name)"
    hyprctl keyword monitor "$laptop, preferred, auto, $LAPTOP_MONITOR_SCALE" >> "$LOG_FILE" 2>&1 || true
    hyprctl dispatch dpms on "$laptop" >> "$LOG_FILE" 2>&1 || true
fi

RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
SIG="${HYPRLAND_INSTANCE_SIGNATURE:-}"
if [ -z "$SIG" ]; then
    SIG="$(ls -t "$RUNTIME_DIR/hypr" 2>/dev/null | head -n1 || true)"
fi
SOCKET="$RUNTIME_DIR/hypr/$SIG/.socket2.sock"

if [ ! -S "$SOCKET" ]; then
    log "WARNING Hyprland event socket not found: $SOCKET"
    exit 0
fi

log "watching monitor events on $SOCKET"
export SOCKET LOG_FILE \
    LAPTOP_MONITOR_FALLBACK_NAME \
    LAPTOP_MONITOR_DESCRIPTION \
    LAPTOP_MONITOR_MAKE \
    LAPTOP_MONITOR_MODEL \
    LAPTOP_MONITOR_SCALE
python3 - <<'PY'
import datetime
import os
import socket
import subprocess
import time

sock_path = os.environ["SOCKET"]
log_file = os.environ["LOG_FILE"]
fallback_name = os.environ["LAPTOP_MONITOR_FALLBACK_NAME"]
want_desc = os.environ["LAPTOP_MONITOR_DESCRIPTION"]
want_make = os.environ["LAPTOP_MONITOR_MAKE"]
want_model = os.environ["LAPTOP_MONITOR_MODEL"]
scale = os.environ["LAPTOP_MONITOR_SCALE"]

def log(msg):
    ts = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"{ts} {msg}\n")

def run(cmd):
    with open(log_file, "a", encoding="utf-8") as f:
        return subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT).returncode

def hyprctl(*args):
    return run(["hyprctl", *args])

def lid_is_open():
    try:
        for root, _, files in os.walk("/proc/acpi/button/lid"):
            for name in files:
                if name == "state":
                    with open(os.path.join(root, name), encoding="utf-8") as f:
                        if "open" in f.read():
                            return True
        return False
    except Exception:
        return True

def monitors_text():
    return subprocess.run(["hyprctl", "monitors", "all"], text=True, capture_output=True).stdout

def parse_monitors():
    monitors = []
    current = None
    for line in monitors_text().splitlines() + [""]:
        if line.startswith("Monitor "):
            if current:
                monitors.append(current)
            current = {"name": line.split()[1], "description": "", "make": "", "model": "", "disabled": False}
        elif current and line.strip().startswith("description:"):
            current["description"] = line.split("description:", 1)[1].strip()
        elif current and line.strip().startswith("make:"):
            current["make"] = line.split("make:", 1)[1].strip()
        elif current and line.strip().startswith("model:"):
            current["model"] = line.split("model:", 1)[1].strip()
        elif current and "disabled: true" in line:
            current["disabled"] = True
        elif line == "" and current:
            monitors.append(current)
            current = None
    return monitors

def resolve_laptop_monitor():
    monitors = parse_monitors()
    for m in monitors:
        if m["description"] == want_desc:
            return m["name"]
    for m in monitors:
        if m["make"] == want_make and m["model"] == want_model:
            return m["name"]
    for m in monitors:
        if m["name"] == fallback_name:
            return m["name"]
    return None

def active_external_count():
    laptop = resolve_laptop_monitor() or fallback_name
    return sum(1 for m in parse_monitors() if m["name"] != laptop and not m["disabled"])

def ensure_laptop_auto_if_open():
    if not lid_is_open():
        log("lid closed: not enabling laptop panel; it may be absent")
        return
    for delay in (0, 0.25, 0.5, 1, 2):
        time.sleep(delay)
        laptop = resolve_laptop_monitor()
        if laptop:
            log(f"lid open: resolved laptop panel as {laptop}; enabling with auto layout")
            hyprctl("keyword", "monitor", f"{laptop}, preferred, auto, {scale}")
            hyprctl("dispatch", "dpms", "on", laptop)
            return
        log(f"lid open: laptop panel not present yet after hotplug delay {delay}s")

def handle_hotplug(event):
    log(f"event: {event}")
    # Wait for Hyprland to settle after monitor add/remove.
    time.sleep(0.75)
    externals = active_external_count()
    if lid_is_open():
        log(f"lid open after hotplug: {externals} external monitor(s) active")
        ensure_laptop_auto_if_open()
    else:
        if externals > 0:
            log(f"lid closed after hotplug: {externals} external monitor(s) active; staying awake")
            laptop = resolve_laptop_monitor()
            if laptop:
                log(f"lid closed after hotplug: disabling {laptop} while docked")
                hyprctl("keyword", "monitor", f"{laptop}, disable")
        else:
            log("lid closed after hotplug: no external monitors active; suspending system")
            run(["systemctl", "suspend"])

while True:
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect(sock_path)
        buf = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                raise ConnectionError("Hyprland event socket closed")
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                event = line.decode("utf-8", "replace").strip()
                if event.startswith("monitoradded") or event.startswith("monitorremoved"):
                    handle_hotplug(event)
    except Exception as e:
        log(f"watcher reconnect after error: {e}")
        time.sleep(2)
PY
