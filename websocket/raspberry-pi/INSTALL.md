# Raspberry Pi WebSocket Client - Installation

## المتطلبات
- Raspberry Pi Zero 2 W (or any Pi with camera)
- raspistill installed
- SSH/SCP configured
- Internet connection

---

## التركيب (4 خطوات)

### 1. تثبيت websocat

```bash
# على الراسبيري باي
cd ~/cam

# انسخ السكربت
scp install-websocat.sh pi@PI_IP:~/cam/

# شغّله
chmod +x install-websocat.sh
sudo ./install-websocat.sh

# تأكد
websocat --version
```

### 2. نسخ السكربت الرئيسي

```bash
# من جهازك
scp shwebsocket_ pi@PI_IP:~/cam/websocket.sh

# على الراسبيري
chmod +x ~/cam/websocket.sh
```

### 3. تعديل الإعدادات

```bash
nano ~/cam/websocket.sh
```

غيّر:
```bash
# عنوان VPS الخاص بك
readonly WEBSOCKET_SERVER="ws://193.160.119.136:8080"

# اسم الكاميرا
readonly DEVICE_ID="cam1"

# إعدادات SFTP (نفس shmain_)
readonly SFTP_USER="user"
readonly SFTP_HOST="netstorm.site"
readonly SFTP_PATH="/home/user/cam1/"
```

### 4. التشغيل التلقائي

#### الطريقة 1: Crontab (مثل shmain_)
```bash
crontab -e

# أضف:
@reboot /home/pi/cam/websocket.sh &
```

#### الطريقة 2: Systemd Service
```bash
sudo nano /etc/systemd/system/cam-websocket.service
```

```ini
[Unit]
Description=Camera WebSocket Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/cam
ExecStart=/home/pi/cam/websocket.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cam-websocket
sudo systemctl start cam-websocket
```

---

## الاختبار

```bash
# تشغيل يدوي
./websocket.sh

# يجب أن ترى:
# [INFO] Starting WebSocket client for cam1
# [INFO] Connecting to ws://193.160.119.136:8080
```

على VPS:
```bash
journalctl -u cam-websocket -f
# يجب أن ترى: Camera connected
```

---

## الأوامر

```bash
# حالة الخدمة
sudo systemctl status cam-websocket

# مشاهدة السجلات
tail -f /var/log/websocket.log

# إعادة تشغيل
sudo systemctl restart cam-websocket

# إيقاف
sudo systemctl stop cam-websocket
```

---

## استكشاف الأخطاء

### websocat not found
```bash
sudo ./install-websocat.sh
```

### Connection refused
- تأكد VPS شغال: `curl http://193.160.119.136:8080/health`
- تأكد المنفذ مفتوح

### raspistill failed
- تأكد الكاميرا مفعلة: `sudo raspi-config`
- اختبر: `raspistill -o test.jpg`

### Upload failed
- تأكد SCP يعمل: `scp test.jpg user@host:/path/`
- تأكد SSH keys configured

---

## الملفات

- `shwebsocket_` → `websocket.sh` - السكربت الرئيسي
- `install-websocat.sh` - مثبت websocat
- `/var/log/websocket.log` - سجلات التشغيل
- `/var/tmp/status.tmp` - حالة النظام
- `/var/tmp/web_live.tmp` - حالة البث المباشر
