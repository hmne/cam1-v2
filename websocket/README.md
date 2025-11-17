# WebSocket VPS Server Files

## هذا المجلد لا يُرفع مع الموقع!

الملفات هنا للـ VPS فقط. انسخها يدوياً إلى VPS.

---

## الملفات

- `server.js` - خادم WebSocket
- `package.json` - تبعيات Node.js
- `cam-websocket.service` - خدمة systemd

---

## التركيب على VPS

```bash
# على VPS
mkdir -p /opt/cam-websocket

# من جهازك
scp server.js package.json root@VPS_IP:/opt/cam-websocket/
scp cam-websocket.service root@VPS_IP:/etc/systemd/system/

# على VPS
cd /opt/cam-websocket
npm install
systemctl enable cam-websocket
systemctl start cam-websocket
```

---

## لا ترفع هذا المجلد!

عند رفع الموقع، تجاهل مجلد `websocket/` بالكامل.

الملفات المطلوبة للموقع:
- `assets/js/websocket-client.js` ✓
- `config/app-config.php` (مع إعدادات WebSocket) ✓
- `script/shwebsocket_` (للراسبيري، ينزل تلقائياً) ✓
