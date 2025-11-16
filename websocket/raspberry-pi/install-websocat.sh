#!/bin/bash
#
# Install websocat for Raspberry Pi
# Lightweight WebSocket client (no Node.js needed)
#

set -e

echo "Installing websocat for Raspberry Pi..."

# Detect architecture
ARCH=$(uname -m)
VERSION="1.11.0"

case "$ARCH" in
    aarch64|arm64)
        URL="https://github.com/vi/websocat/releases/download/v${VERSION}/websocat.aarch64-unknown-linux-musl"
        ;;
    armv7l|armhf)
        URL="https://github.com/vi/websocat/releases/download/v${VERSION}/websocat.arm-unknown-linux-musleabihf"
        ;;
    armv6l)
        URL="https://github.com/vi/websocat/releases/download/v${VERSION}/websocat.arm-unknown-linux-musleabi"
        ;;
    *)
        echo "Unknown architecture: $ARCH"
        exit 1
        ;;
esac

echo "Downloading websocat for $ARCH..."
sudo wget -q "$URL" -O /usr/local/bin/websocat

echo "Setting permissions..."
sudo chmod +x /usr/local/bin/websocat

echo "Verifying installation..."
if websocat --version; then
    echo "✓ websocat installed successfully!"
else
    echo "✗ Installation failed"
    exit 1
fi
