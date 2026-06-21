#!/bin/bash
# smoothscroll-setup.sh
# Setup script for SmoothScroll on Linux Wayland
# Run this once after installing SmoothScroll

set -e

echo "SmoothScroll Wayland Setup"
echo "========================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Error: Do not run as root. Run as your normal user."
    exit 1
fi

# Check if already in input group
if groups | grep -q '\binput\b'; then
    echo "[OK] User is already in 'input' group"
else
    echo "[INFO] Adding user to 'input' group..."
    sudo gpasswd -a "$USER" input
    echo "[OK] User added to 'input' group"
fi

# Check/create udev rule
UDEV_RULE="/etc/udev/rules.d/99-smoothscroll.rules"
if [ -f "$UDEV_RULE" ]; then
    echo "[OK] udev rule already exists at $UDEV_RULE"
else
    echo "[INFO] Creating udev rule..."
    echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
        | sudo tee "$UDEV_RULE"
    echo "[OK] udev rule created"
fi

# Reload udev
echo "[INFO] Reloading udev rules..."
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=input
echo "[OK] udev rules reloaded"

echo ""
echo "================================"
echo "Setup complete!"
echo ""
echo "IMPORTANT: Please log out and log back in for group changes to take effect."
echo "After logging back in, start SmoothScroll."
echo ""
