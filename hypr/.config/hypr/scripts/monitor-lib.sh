#!/usr/bin/env bash
# Shared Hyprland monitor helpers for this laptop.

# Stable identity for the built-in laptop panel. The connector name is normally
# eDP-2, but the description/make/model is a better persistent identifier.
LAPTOP_MONITOR_FALLBACK_NAME="eDP-2"
LAPTOP_MONITOR_DESCRIPTION="AU Optronics 0xC1A5 0x0000C1A5"
LAPTOP_MONITOR_MAKE="AU Optronics"
LAPTOP_MONITOR_MODEL="0xC1A5"
LAPTOP_MONITOR_SCALE="1.25"

lid_is_open() {
    grep -q open /proc/acpi/button/lid/LID*/state 2>/dev/null
}

# Print the current Hyprland output name for the laptop panel, e.g. eDP-2.
# Prefer matching by exact description, then make/model, then eDP fallback.
resolve_laptop_monitor() {
    hyprctl monitors all 2>/dev/null | awk \
        -v fallback="$LAPTOP_MONITOR_FALLBACK_NAME" \
        -v want_desc="$LAPTOP_MONITOR_DESCRIPTION" \
        -v want_make="$LAPTOP_MONITOR_MAKE" \
        -v want_model="$LAPTOP_MONITOR_MODEL" '
        function finish() {
            if (name == "") return
            if (desc == want_desc) desc_match = name
            if (make == want_make && model == want_model) makemodel_match = name
            if (name == fallback) fallback_match = name
        }
        /^Monitor / {
            finish()
            name=$2; desc=""; make=""; model=""
            next
        }
        /^[[:space:]]+description:/ {
            sub(/^[[:space:]]+description:[[:space:]]*/, "")
            desc=$0
            next
        }
        /^[[:space:]]+make:/ {
            sub(/^[[:space:]]+make:[[:space:]]*/, "")
            make=$0
            next
        }
        /^[[:space:]]+model:/ {
            sub(/^[[:space:]]+model:[[:space:]]*/, "")
            model=$0
            next
        }
        END {
            finish()
            if (desc_match != "") print desc_match
            else if (makemodel_match != "") print makemodel_match
            else if (fallback_match != "") print fallback_match
        }
    '
}

laptop_monitor_name() {
    resolved="$(resolve_laptop_monitor)"
    if [ -n "$resolved" ]; then
        printf '%s\n' "$resolved"
    else
        printf '%s\n' "$LAPTOP_MONITOR_FALLBACK_NAME"
    fi
}

laptop_present_in_hyprland() {
    [ -n "$(resolve_laptop_monitor)" ]
}

active_external_count() {
    laptop="$(laptop_monitor_name)"
    hyprctl monitors all 2>/dev/null | awk -v laptop="$laptop" '
        $1 == "Monitor" { name=$2; in_monitor=1; disabled=0 }
        in_monitor && /disabled: true/ { disabled=1 }
        /^$/ {
            if (in_monitor && name != laptop && disabled == 0) count++
            in_monitor=0; name=""; disabled=0
        }
        END {
            if (in_monitor && name != laptop && disabled == 0) count++
            print count + 0
        }
    '
}
