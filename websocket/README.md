# WebSocket System - Complete Installation Guide

## نظام WebSocket للتحكم الفوري بالكاميرا

---

## البنية

```
websocket/
├── vps/                    # خادم WebSocket (يعمل على VPS)
│   ├── server.js           # الخادم الرئيسي
│   ├── package.json        # تبعيات Node.js
│   ├── cam-websocket.service  # خدمة systemd
│   └── INSTALL.md          # دليل التركيب
│
├── raspberry-pi/           # عميل الكاميرا (يعمل على Pi)
│   ├── shwebsocket_        # السكربت الرئيسي (مثل shmain_)
│   ├── install-websocat.sh # مثبت websocat
│   └── INSTALL.md          # دليل التركيب
│
├── website/                # عميل المتصفح
│   ├── websocket-client.js # JavaScript للمتصفح
│   └── INSTALL.md          # دليل التركيب
│
└── README.md               # هذا الملف
```

---

## التركيب الكامل (15 دقيقة)

### الخطوة 1: VPS (10 دقائق)

```bash
# 1. SSH إلى VPS
ssh root@193.160.119.136

# 2. تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 3. إنشاء المجلد
mkdir -p /opt/cam-websocket
cd /opt/cam-websocket

# 4. انسخ الملفات (من جهازك)
# على جهازك المحلي:
scp websocket/vps/server.js root@193.160.119.136:/opt/cam-websocket/
scp websocket/vps/package.json root@193.160.119.136:/opt/cam-websocket/
scp websocket/vps/cam-websocket.service root@193.160.119.136:/etc/systemd/system/

# 5. تثبيت وتشغيل (على VPS)
npm install
systemctl daemon-reload
systemctl enable cam-websocket
systemctl start cam-websocket

# 6. فتح المنفذ
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# 7. اختبار
curl http://localhost:8080/health
```

### الخطوة 2: Raspberry Pi (3 دقائق)

```bash
# على جهازك:
scp websocket/raspberry-pi/shwebsocket_ pi@PI_IP:~/cam/websocket.sh
scp websocket/raspberry-pi/install-websocat.sh pi@PI_IP:~/cam/

# على Pi:
cd ~/cam
chmod +x install-websocat.sh websocket.sh
sudo ./install-websocat.sh

# تعديل الإعدادات
nano websocket.sh
# غيّر WEBSOCKET_SERVER إلى عنوان VPS

# تشغيل تلقائي
crontab -e
# أضف: @reboot /home/pi/cam/websocket.sh &
```

### الخطوة 3: الموقع (دقيقة واحدة)

```bash
# الملف موجود بالفعل في assets/js/websocket-client.js

# فعّل في الإعدادات:
nano config/app-config.php
```

```php
define('WEBSOCKET_ENABLED', true);
define('WEBSOCKET_SERVER_URL', 'ws://193.160.119.136:8080');
```

---

## التحقق من العمل

### 1. فحص VPS
```bash
curl http://193.160.119.136:8080/health
```

يجب أن ترى:
```json
{
  "status": "healthy",
  "camera": "connected",
  "browsers": 1
}
```

### 2. فحص Pi
```bash
tail -f /var/log/websocket.log
```

يجب أن ترى:
```
[INFO] Connecting to ws://193.160.119.136:8080
[INFO] Camera identified
```

### 3. فحص المتصفح
افتح Console (F12) وافحص:
```javascript
CameraWS.isConnected()  // true
```

---

## التبديل بين الأوضاع

### تفعيل WebSocket:
```php
define('WEBSOCKET_ENABLED', true);
```

### تعطيل (العودة للعادي):
```php
define('WEBSOCKET_ENABLED', false);
```

**لا يحتاج تعديل كود! سطر واحد فقط.**

---

## المميزات

| الميزة | HTTP العادي | WebSocket |
|--------|-------------|-----------|
| وقت الاستجابة | 2-5 ثواني | فوري |
| تأكيد التقاط | بعد polling | فوري |
| استهلاك CPU | عالي (polling) | منخفض |
| عدد الاتصالات | كثيرة | واحد مستمر |
| الإشعارات | متأخرة | فورية |

---

## استكشاف الأخطاء

### VPS لا يستجيب
```bash
systemctl status cam-websocket
journalctl -u cam-websocket -f
```

### Pi لا يتصل
```bash
# تأكد websocat مثبت
websocat --version

# تأكد الشبكة تعمل
ping 193.160.119.136
```

### المتصفح لا يتصل
- افتح Console (F12)
- ابحث عن أخطاء WebSocket
- تأكد `WEBSOCKET_ENABLED = true`

---

## الأوامر السريعة

### VPS:
```bash
systemctl restart cam-websocket  # إعادة تشغيل
journalctl -u cam-websocket -f   # مشاهدة السجلات
```

### Pi:
```bash
sudo systemctl restart cam-websocket  # إعادة تشغيل
tail -f /var/log/websocket.log        # مشاهدة السجلات
```

### متصفح:
```javascript
CameraWS.capture()               // التقاط صورة
CameraWS.startLive('medium')     // بدء البث
CameraWS.stopLive()              // إيقاف البث
CameraWS.isConnected()           // فحص الاتصال
```

---

## الأمان

- WebSocket يعمل على منفذ 8080
- لا توجد معلومات حساسة تمر عبره
- يمكن إضافة SSL لاحقاً (wss://)
- الخادم يرفض الرسائل الكبيرة (>10KB)

---

## الترقية لـ SSL (اختياري)

لتفعيل wss:// بدلاً من ws://:

1. احصل على شهادة SSL (Let's Encrypt)
2. عدّل server.js لاستخدام https
3. غيّر URL في config

---

## الدعم

- راجع `INSTALL.md` في كل مجلد للتفاصيل
- سجلات VPS: `journalctl -u cam-websocket`
- سجلات Pi: `/var/log/websocket.log`
- سجلات المتصفح: Console (F12)
