#!/bin/bash

# Check if the lid is actually closed
if grep -q open /proc/acpi/button/lid/LID*/state; then
    hyprctl keyword monitor "eDP-2, 2560x1600@165.04, 3849x0, 1.25"
else
    hyprctl keyword monitor "eDP-2, disable"
fi

