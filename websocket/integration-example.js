/**
 * Integration Example: WebSocket with Camera Control
 *
 * This shows how to integrate WebSocket for INSTANT response
 * Copy these event listeners to your camera-control.js or camera-control-ultra.js
 */

// ============================================
// WEBSOCKET EVENT LISTENERS
// ============================================

// Listen for instant capture completion
window.addEventListener('captureComplete', function(e) {
    const detail = e.detail;
    console.log('Image ready!', detail.imageUrl, 'in', detail.duration, 'ms');

    // Update image IMMEDIATELY - no polling needed!
    const img = document.getElementById('pic');
    if (img) {
        img.src = detail.imageUrl;
    }

    // Hide loading indicator
    const btn = document.getElementById('takePicBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Capture Image';
    }
});

// Listen for capture started
window.addEventListener('captureStarted', function(e) {
    console.log('Capture in progress...');

    // Show loading indicator
    const btn = document.getElementById('takePicBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Capturing...';
    }
});

// Listen for live frame ready - instant update
window.addEventListener('liveFrameReady', function(e) {
    const img = document.getElementById('liveImg');
    if (img) {
        img.src = e.detail.imageUrl;
    }
});

// Listen for camera status updates
window.addEventListener('cameraStatusUpdate', function(e) {
    const detail = e.detail;

    // Update UI with latest status
    document.getElementById('memoryStatus').textContent = detail.memory;
    document.getElementById('tempStatus').textContent = detail.temperature;
    document.getElementById('pingStatus').textContent = detail.latency;
    document.getElementById('signalStatus').textContent = detail.signal;

    // Update online indicator
    const statusEl = document.getElementById('cameraStatus');
    if (statusEl) {
        statusEl.className = detail.online ? 'online' : 'offline';
        statusEl.textContent = detail.online ? 'Online' : 'Offline';
    }
});

// Listen for camera connection events
window.addEventListener('cameraConnected', function(e) {
    console.log('Camera is now online!');
    // Enable controls
    document.getElementById('controlPanel').classList.remove('disabled');
});

window.addEventListener('cameraDisconnected', function(e) {
    console.log('Camera went offline!');
    // Disable controls
    document.getElementById('controlPanel').classList.add('disabled');
});

// ============================================
// CAPTURE BUTTON - INSTANT COMMAND
// ============================================

document.getElementById('takePicBtn').addEventListener('click', function() {
    if (!CameraWebSocket.isConnected()) {
        alert('WebSocket not connected');
        return;
    }

    // Send capture command - camera receives it INSTANTLY
    CameraWebSocket.capture();

    // That's it! No polling, no waiting
    // When capture is done, 'captureComplete' event fires automatically
});

// ============================================
// LIVE STREAM CONTROL
// ============================================

document.getElementById('liveToggle').addEventListener('click', function() {
    const isActive = this.dataset.active === 'true';

    if (isActive) {
        CameraWebSocket.stopLive();
        this.dataset.active = 'false';
        this.textContent = 'Start Live';
    } else {
        const quality = document.getElementById('qualitySelect').value;
        CameraWebSocket.startLive(quality);
        this.dataset.active = 'true';
        this.textContent = 'Stop Live';
    }
});

// ============================================
// SETTINGS UPDATE - INSTANT
// ============================================

document.getElementById('settingsForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const settings = {
        resolution: document.getElementById('resolution').value,
        compression: document.getElementById('compression').value,
        rotation: document.getElementById('rotation').value,
        effect: document.getElementById('effect').value
    };

    // Send to camera INSTANTLY
    CameraWebSocket.updateSettings(settings);

    alert('Settings updated!');
});

// ============================================
// FLOW COMPARISON
// ============================================

/*
OLD WAY (HTTP Polling):
1. User clicks "Capture"
2. Browser writes file via AJAX
3. SFTP syncs file to Pi (1-3 seconds)
4. Pi sees file, captures image (2-5 seconds)
5. Pi uploads image via SFTP (3-10 seconds)
6. Browser polls for image (every 50ms)
7. Finally sees new image
TOTAL: 6-20 seconds delay

NEW WAY (WebSocket):
1. User clicks "Capture"
2. Browser sends WebSocket message (instant)
3. VPS forwards to Pi (instant)
4. Pi captures image (2-5 seconds)
5. Pi uploads image (3-10 seconds)
6. Pi sends "complete" via WebSocket (instant)
7. Browser receives event, shows image (instant)
TOTAL: 5-15 seconds, but with INSTANT FEEDBACK

The difference:
- No polling = less CPU/network usage
- Instant "capture started" feedback
- Instant "capture complete" notification
- Real-time progress updates
- Better user experience
*/

// ============================================
// PERFORMANCE TIPS
// ============================================

/*
1. Use WebSocket for:
   - Commands (capture, settings, live control)
   - Status updates
   - Notifications

2. Keep HTTP/SFTP for:
   - Actual image data (too large for WebSocket)

3. The WebSocket tells you WHEN the image is ready
   Then you fetch it via HTTP

This hybrid approach gives:
- Instant feedback (WebSocket)
- Efficient image transfer (HTTP)
- Maximum responsiveness
*/
