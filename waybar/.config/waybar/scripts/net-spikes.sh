#!/bin/bash
interface="wlan0"
while true; do
  R1=$(cat /sys/class/net/$interface/statistics/rx_bytes)
  sleep 1
  R2=$(cat /sys/class/net/$interface/statistics/rx_bytes)
  echo "$(( (R2 - R1) / 1024 )) KB/s"
done
