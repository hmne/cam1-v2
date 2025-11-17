# WebSocket - Real-time Camera Control

## اختياري 100%

إذا ما فعّلته أو فشل، النظام يرجع للطريقة العادية **تلقائياً**.

---

## التركيب (10 دقائق)

### 1. VPS

```bash
ssh root@YOUR_VPS_IP

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# المجلد
mkdir -p /opt/cam-websocket
```

**من جهازك:**
```bash
scp websocket/vps/* root@YOUR_VPS_IP:/opt/cam-websocket/
scp websocket/vps/cam-websocket.service root@YOUR_VPS_IP:/etc/systemd/system/
```

**على VPS:**
```bash
cd /opt/cam-websocket
npm install

systemctl daemon-reload
systemctl enable cam-websocket
systemctl start cam-websocket

iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

### 2. الموقع

في `config/app-config.php`:
```php
define('WEBSOCKET_ENABLED', true);
define('WEBSOCKET_SERVER_URL', 'ws://YOUR_VPS_IP:8080');
```

### 3. Raspberry Pi

**تثبيت websocat:**
```bash
wget https://github.com/vi/websocat/releases/download/v1.11.0/websocat.aarch64-unknown-linux-musl -O /usr/local/bin/websocat
chmod +x /usr/local/bin/websocat
```

**في boot.sh (قبل تشغيل السكربتات):**
```bash
export WS_SERVER="YOUR_VPS_IP:8080"
```

**السكربت يشتغل تلقائياً من `script/shwebsocket_`**

---

## Fallback تلقائي

- VPS فشل → HTTP mode
- Pi مش مفعل → HTTP mode
- الموقع مش مفعل → HTTP mode

**ما في شي ينكسر!**

---

## إيقاف

**الموقع:**
```php
define('WEBSOCKET_ENABLED', false);
```

**Pi:** لا تحدد `WS_SERVER`

---

## الفحص

```bash
curl http://YOUR_VPS_IP:8080/health
```

---

## الملفات

```
websocket/vps/
├── server.js
├── package.json
└── cam-websocket.service

script/shwebsocket_              # سكربت Pi

assets/js/websocket-client.js    # عميل المتصفح
```
