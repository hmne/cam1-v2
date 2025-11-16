# VPS WebSocket Server - Installation Guide

## المتطلبات
- Debian 9+ or Ubuntu 18+
- Root access
- Port 8080 open

---

## التركيب (3 خطوات فقط)

### 1. تثبيت Node.js

```bash
ssh root@193.160.119.136

# تثبيت Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# تأكد
node -v   # v18.x.x
npm -v    # 9.x.x
```

### 2. نسخ وتشغيل الخادم

```bash
# إنشاء المجلد
mkdir -p /opt/cam-websocket
cd /opt/cam-websocket

# انسخ الملفات من جهازك
scp server.js package.json root@193.160.119.136:/opt/cam-websocket/

# تثبيت المتطلبات
npm install

# اختبار (اضغط Ctrl+C للإيقاف)
node server.js
```

### 3. تشغيل كخدمة دائمة

```bash
# انسخ ملف الخدمة
cp cam-websocket.service /etc/systemd/system/

# تفعيل وتشغيل
systemctl daemon-reload
systemctl enable cam-websocket
systemctl start cam-websocket

# تأكد
systemctl status cam-websocket
```

---

## فتح المنفذ (إذا مغلق)

```bash
# iptables
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
apt-get install iptables-persistent
netfilter-persistent save

# أو UFW
ufw allow 8080/tcp
```

---

## الأوامر المفيدة

```bash
# حالة الخدمة
systemctl status cam-websocket

# إعادة تشغيل
systemctl restart cam-websocket

# مشاهدة السجلات
journalctl -u cam-websocket -f

# فحص الصحة
curl http://localhost:8080/health
```

---

## اختبار من المتصفح

افتح:
```
http://193.160.119.136:8080/health
```

يجب أن ترى:
```json
{
  "status": "healthy",
  "camera": "disconnected",
  "browsers": 0,
  "uptime": 123,
  "memory": "15MB"
}
```

---

## الملفات

- `server.js` - الخادم الرئيسي
- `package.json` - تبعيات Node.js
- `cam-websocket.service` - ملف خدمة systemd

---

## تغيير المنفذ

عدّل في `cam-websocket.service`:
```
Environment=WS_PORT=8080
```

ثم:
```bash
systemctl daemon-reload
systemctl restart cam-websocket
```
