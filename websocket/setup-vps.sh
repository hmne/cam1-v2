#!/bin/bash

# WebSocket Server Setup for Debian 9
# Run as root on your VPS

echo "=== Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "=== Creating WebSocket Server ==="
mkdir -p /opt/cam-websocket
cd /opt/cam-websocket

# Initialize npm project
npm init -y

# Install dependencies
npm install ws express

echo "=== Setup Complete ==="
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"
echo ""
echo "Next: Copy server.js to /opt/cam-websocket/"
echo "Then: node server.js"
