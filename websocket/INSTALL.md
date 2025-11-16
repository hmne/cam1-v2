# WebSocket Server Installation Guide

## VPS Setup (Debian 9)

### 1. Install Node.js
```bash
ssh root@193.160.119.136

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify
node -v  # Should show v18.x
npm -v
```

### 2. Setup WebSocket Server
```bash
# Create directory
mkdir -p /opt/cam-websocket
cd /opt/cam-websocket

# Copy files (from your local machine)
# scp websocket/server.js root@193.160.119.136:/opt/cam-websocket/
# scp websocket/package.json root@193.160.119.136:/opt/cam-websocket/

# Install dependencies
npm install

# Test run
node server.js
# Should show: "Camera WebSocket Server Running on port 8080"
# Press Ctrl+C to stop
```

### 3. Configure Firewall
```bash
# Allow WebSocket port
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Save rules (Debian 9)
apt-get install iptables-persistent
netfilter-persistent save
```

### 4. Run as Service (Auto-start)
```bash
# Copy service file
cp cam-websocket.service /etc/systemd/system/

# Enable and start
systemctl daemon-reload
systemctl enable cam-websocket
systemctl start cam-websocket

# Check status
systemctl status cam-websocket

# View logs
journalctl -u cam-websocket -f
```

### 5. Alternative: Use PM2 (Process Manager)
```bash
# Install PM2
npm install -g pm2

# Start server
cd /opt/cam-websocket
pm2 start server.js --name cam-websocket

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## Website Configuration

### 1. Add WebSocket Client to index.php

Add before closing `</body>` tag:

```html
<!-- WebSocket for real-time updates -->
<script src="assets/js/websocket-client.js"></script>
```

### 2. Update Server IP

Edit `assets/js/websocket-client.js`:

```javascript
const WS_CONFIG = {
    SERVER_URL: 'ws://193.160.119.136:8080',  // Your VPS IP
    // ...
};
```

---

## Raspberry Pi Setup

### 1. Install websocat (WebSocket client)
```bash
# ARM64 (Raspberry Pi 3/4)
wget https://github.com/vi/websocat/releases/download/v1.11.0/websocat.aarch64-unknown-linux-musl -O /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat

# ARM32 (Older Pi)
wget https://github.com/vi/websocat/releases/download/v1.11.0/websocat.arm-unknown-linux-musleabihf -O /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat
```

### 2. Copy sender script
```bash
# Copy shwebsocket_ to Pi
scp script/shwebsocket_ pi@camera-ip:/home/pi/cam/websocket.sh
chmod +x /home/pi/cam/websocket.sh
```

### 3. Update configuration in script
```bash
nano /home/pi/cam/websocket.sh
# Change WEBSOCKET_SERVER to your VPS IP
```

### 4. Add to crontab
```bash
crontab -e
# Add:
@reboot /home/pi/cam/websocket.sh &
```

---

## Testing

### 1. Test WebSocket Server
```bash
# On VPS
curl http://193.160.119.136:8080/health
# Should return: {"status":"ok","clients":0,"uptime":123}
```

### 2. Test from Browser Console
```javascript
// Open browser console on your camera website
CameraWebSocket.isConnected()  // Should return true
CameraWebSocket.getStatus()    // Should return "connected"
```

### 3. Monitor Connections
```bash
# On VPS
journalctl -u cam-websocket -f
# Should show connection messages when browsers connect
```

---

## Benefits of WebSocket

1. **Instant Updates** - Status changes appear immediately (not waiting 2 seconds)
2. **Lower Server Load** - No HTTP polling, persistent connection
3. **Battery Efficient** - Less network requests on mobile devices
4. **Real-time Notifications** - Camera online/offline alerts instantly
5. **Scalable** - Can handle many browser connections efficiently

---

## Troubleshooting

### Connection Refused
- Check firewall: `iptables -L -n | grep 8080`
- Check server running: `systemctl status cam-websocket`
- Check port listening: `netstat -tlnp | grep 8080`

### No Updates from Camera
- Check Pi script running: `ps aux | grep websocket`
- Check network connectivity from Pi to VPS
- Check logs: `/var/log/websocket_sender.log`

### Browser Not Connecting
- Check browser console for errors
- Verify correct IP in websocket-client.js
- Test with: `wscat -c ws://193.160.119.136:8080`
