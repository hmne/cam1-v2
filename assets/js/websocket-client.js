/**
 * WebSocket Client for Full Camera Control
 *
 * Real-time bidirectional communication:
 * - Instant capture commands and responses
 * - Live stream control
 * - Settings synchronization
 * - Status monitoring
 *
 * @version 2.0.0
 */

'use strict';

(function(window) {
    // Configuration
    const WS_CONFIG = {
        SERVER_URL: window.WEBSOCKET_SERVER_URL || 'ws://193.160.119.136:8080',
        RECONNECT_DELAY: 2000,
        MAX_RECONNECT_DELAY: 30000,
        RECONNECT_MULTIPLIER: 1.5
    };

    // State
    let ws = null;
    let reconnectDelay = WS_CONFIG.RECONNECT_DELAY;
    let reconnectTimer = null;
    let isConnected = false;
    let pendingCapture = null;
    let captureCallbacks = {};

    /**
     * Connect to WebSocket server
     */
    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return;
        }

        console.log('[WS] Connecting to', WS_CONFIG.SERVER_URL);

        try {
            ws = new WebSocket(WS_CONFIG.SERVER_URL);

            ws.onopen = function() {
                console.log('[WS] Connected');
                isConnected = true;
                reconnectDelay = WS_CONFIG.RECONNECT_DELAY;

                // Identify as browser client
                sendMessage({ type: 'identify', role: 'browser' });

                // Trigger event
                window.dispatchEvent(new CustomEvent('wsConnected'));
            };

            ws.onmessage = function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            ws.onclose = function() {
                console.log('[WS] Disconnected');
                isConnected = false;
                window.dispatchEvent(new CustomEvent('wsDisconnected'));
                scheduleReconnect();
            };

            ws.onerror = function(err) {
                console.error('[WS] Error:', err);
            };

        } catch (err) {
            console.error('[WS] Connection failed:', err);
            scheduleReconnect();
        }
    }

    /**
     * Send message to server
     */
    function sendMessage(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    /**
     * Schedule reconnection
     */
    function scheduleReconnect() {
        if (reconnectTimer) clearTimeout(reconnectTimer);

        reconnectTimer = setTimeout(() => {
            connect();
            reconnectDelay = Math.min(
                reconnectDelay * WS_CONFIG.RECONNECT_MULTIPLIER,
                WS_CONFIG.MAX_RECONNECT_DELAY
            );
        }, reconnectDelay);
    }

    /**
     * Handle incoming messages
     */
    function handleMessage(message) {
        console.log('[WS] Received:', message.type);

        switch (message.type) {
            // Camera status
            case 'status':
                handleStatus(message);
                break;

            // Camera connected
            case 'camera_connected':
                window.dispatchEvent(new CustomEvent('cameraConnected', { detail: message }));
                showNotification('📷 Camera Connected', 'Camera is online and ready');
                break;

            // Camera disconnected
            case 'camera_disconnected':
                window.dispatchEvent(new CustomEvent('cameraDisconnected', { detail: message }));
                showNotification('🔴 Camera Disconnected', 'Connection lost!');
                break;

            // Capture started
            case 'capture_started':
                pendingCapture = message.captureId;
                window.dispatchEvent(new CustomEvent('captureStarted', { detail: message }));
                console.log('[WS] 📸 Capture started:', message.captureId);
                break;

            // Capture completed - THIS IS THE KEY FOR INSTANT RESPONSE
            case 'capture_complete':
                handleCaptureComplete(message);
                break;

            // Capture timeout
            case 'capture_timeout':
                pendingCapture = null;
                window.dispatchEvent(new CustomEvent('captureTimeout', { detail: message }));
                showNotification('⚠️ Capture Timeout', 'Image capture took too long');
                break;

            // Live stream frame ready
            case 'live_frame_ready':
                window.dispatchEvent(new CustomEvent('liveFrameReady', {
                    detail: { imageUrl: message.imageUrl }
                }));
                break;

            // Live stream status
            case 'live_status':
                window.dispatchEvent(new CustomEvent('liveStatusChanged', {
                    detail: { active: message.active }
                }));
                break;

            // Notifications
            case 'notification':
                showNotification(message.title, message.body);
                break;

            // Errors
            case 'error':
                console.error('[WS] Error:', message.message);
                window.dispatchEvent(new CustomEvent('wsError', { detail: message }));
                break;

            default:
                console.log('[WS] Unknown message:', message.type);
        }
    }

    /**
     * Handle status update
     */
    function handleStatus(status) {
        window.cameraOnlineStatus = status.online;
        window.cameraCapturing = status.capturing;
        window.cameraLiveStreaming = status.liveStreaming;

        const parts = (status.data || 'N/A,N/A,N/A,N/A').split(',');

        window.dispatchEvent(new CustomEvent('cameraStatusUpdate', {
            detail: {
                online: status.online,
                capturing: status.capturing,
                liveStreaming: status.liveStreaming,
                memory: parts[0] || 'N/A',
                temperature: parts[1] || 'N/A',
                latency: parts[2] || 'N/A',
                signal: parts[3] || 'N/A',
                timestamp: status.timestamp
            }
        }));

        // Update UI
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = 'status-indicator ' + (status.online ? 'online' : 'offline');
            indicator.textContent = status.online ? 'Connected (Online)' : 'Disconnected (Offline)';
        }
    }

    /**
     * Handle capture completion - INSTANT IMAGE DISPLAY
     */
    function handleCaptureComplete(message) {
        console.log('[WS] ✅ Capture complete in', message.duration, 'ms');

        pendingCapture = null;

        // Dispatch event for immediate image update
        window.dispatchEvent(new CustomEvent('captureComplete', {
            detail: {
                captureId: message.captureId,
                imageUrl: message.imageUrl,
                duration: message.duration,
                timestamp: message.timestamp
            }
        }));

        // Call any registered callback
        if (captureCallbacks[message.captureId]) {
            captureCallbacks[message.captureId](message);
            delete captureCallbacks[message.captureId];
        }

        // Show notification
        showNotification('📸 Capture Complete', 'Image captured in ' + message.duration + 'ms');
    }

    /**
     * CAPTURE IMAGE - Instant command to camera
     */
    function captureImage(callback) {
        if (!isConnected) {
            console.error('[WS] Not connected');
            return false;
        }

        const captureId = Date.now().toString();

        if (callback) {
            captureCallbacks[captureId] = callback;
        }

        return sendMessage({ type: 'capture' });
    }

    /**
     * START LIVE STREAM
     */
    function startLiveStream(quality) {
        return sendMessage({
            type: 'live_control',
            action: 'start',
            quality: quality || 'medium'
        });
    }

    /**
     * STOP LIVE STREAM
     */
    function stopLiveStream() {
        return sendMessage({
            type: 'live_control',
            action: 'stop'
        });
    }

    /**
     * UPDATE SETTINGS - Instant to camera
     */
    function updateSettings(settings) {
        return sendMessage({
            type: 'settings_update',
            settings: settings
        });
    }

    /**
     * Show browser notification
     */
    function showNotification(title, body) {
        // Don't notify if page is focused
        if (document.visibilityState === 'visible' && document.hasFocus()) {
            return;
        }

        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const notification = new Notification(title, {
            body: body,
            icon: 'assets/images/logo.ico',
            tag: 'camera-ws',
            renotify: true
        });

        setTimeout(() => notification.close(), 8000);
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }

    /**
     * Check connection status
     */
    function isWebSocketConnected() {
        return isConnected && ws && ws.readyState === WebSocket.OPEN;
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Auto-connect
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // Expose API
    window.CameraWebSocket = {
        // Connection
        connect: connect,
        isConnected: isWebSocketConnected,
        sendMessage: sendMessage,

        // Camera Control - INSTANT
        capture: captureImage,
        startLive: startLiveStream,
        stopLive: stopLiveStream,
        updateSettings: updateSettings,

        // Config
        config: WS_CONFIG
    };

})(window);
