# Website Integration - WebSocket Client

## الملفات

- `websocket-client.js` - عميل WebSocket للمتصفح

---

## التركيب (خطوتين)

### 1. انسخ الملف

```bash
cp websocket-client.js /path/to/cam1/assets/js/
```

### 2. فعّل في الإعدادات

في `config/app-config.php`:

```php
// غيّر من false إلى true
define('WEBSOCKET_ENABLED', true);

// عنوان VPS الخاص بك
define('WEBSOCKET_SERVER_URL', 'ws://193.160.119.136:8080');
```

خلاص! الآن الموقع يستخدم WebSocket.

---

## كيف يعمل

عند تفعيل WebSocket:

1. **index.php** يحمّل `websocket-client.js` تلقائياً
2. العميل يتصل بـ VPS
3. كل الأوامر تمر عبر WebSocket (فوري)
4. لما تضغط "Capture" → الكاميرا تستجيب فوراً

---

## استخدام الـ API

```javascript
// التقاط صورة - سطر واحد
CameraWS.capture();

// Live stream
CameraWS.startLive('medium');
CameraWS.stopLive();

// تحديث إعدادات
CameraWS.updateSettings('2 15 0 -35 0 none 25');

// فحص الاتصال
if (CameraWS.isConnected()) {
    console.log('متصل');
}
```

---

## الأحداث المتاحة

```javascript
// الكاميرا اتصلت
window.addEventListener('camera:online', function() {
    console.log('Camera is online!');
});

// الكاميرا انقطعت
window.addEventListener('camera:offline', function() {
    console.log('Camera is offline!');
});

// بدأ التقاط
window.addEventListener('capture:started', function(e) {
    console.log('Capturing...', e.detail.id);
});

// انتهى التقاط - الأهم!
window.addEventListener('capture:done', function(e) {
    console.log('Done in', e.detail.duration, 'ms');
    console.log('Image URL:', e.detail.url);
});

// Live frame جديد
window.addEventListener('live:frame', function(e) {
    console.log('New frame:', e.detail.url);
});
```

---

## التبديل بين الأوضاع

### تفعيل WebSocket:
```php
define('WEBSOCKET_ENABLED', true);
```

### تعطيل WebSocket (العودة للعادي):
```php
define('WEBSOCKET_ENABLED', false);
```

لا يحتاج تعديل أي كود آخر!

---

## التوافق

الكود يعمل بجانب `camera-control.js` الموجود:
- إذا WebSocket مفعل → يستخدم WebSocket
- إذا WebSocket معطل → يستخدم HTTP العادي

لا يوجد تعارض.
