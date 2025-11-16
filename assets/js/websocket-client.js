/**
 * WebSocket Client for Real-time Camera Status
 *
 * Connects to VPS WebSocket server for instant status updates
 * Falls back to HTTP polling if WebSocket unavailable
 *
 * @version 1.0.0
 */

'use strict';

(function(window) {
    // Configuration - Uses PHP config or defaults
    const WS_CONFIG = {
        // Server URL (from PHP config or default)
        SERVER_URL: window.WEBSOCKET_SERVER_URL || 'ws://193.160.119.136:8080',

        // Reconnect settings
        RECONNECT_DELAY: 3000,      // 3 seconds
        MAX_RECONNECT_DELAY: 30000, // Max 30 seconds
        RECONNECT_MULTIPLIER: 1.5   // Exponential backoff
    };

    // State
    let ws = null;
    let reconnectDelay = WS_CONFIG.RECONNECT_DELAY;
    let reconnectTimer = null;
    let isConnected = false;

    /**
     * Connect to WebSocket server
     */
    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        console.log('[WebSocket] Connecting to', WS_CONFIG.SERVER_URL);

        try {
            ws = new WebSocket(WS_CONFIG.SERVER_URL);

            ws.onopen = function() {
                console.log('[WebSocket] Connected');
                isConnected = true;
                reconnectDelay = WS_CONFIG.RECONNECT_DELAY; // Reset delay

                // Request current status
                ws.send(JSON.stringify({ type: 'get_status' }));
            };

            ws.onmessage = function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (err) {
                    console.error('[WebSocket] Parse error:', err);
                }
            };

            ws.onclose = function() {
                console.log('[WebSocket] Disconnected');
                isConnected = false;
                scheduleReconnect();
            };

            ws.onerror = function(err) {
                console.error('[WebSocket] Error:', err);
                isConnected = false;
            };

        } catch (err) {
            console.error('[WebSocket] Connection failed:', err);
            scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    function scheduleReconnect() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }

        console.log('[WebSocket] Reconnecting in', reconnectDelay / 1000, 'seconds');

        reconnectTimer = setTimeout(() => {
            connect();
            // Increase delay for next attempt (exponential backoff)
            reconnectDelay = Math.min(
                reconnectDelay * WS_CONFIG.RECONNECT_MULTIPLIER,
                WS_CONFIG.MAX_RECONNECT_DELAY
            );
        }, reconnectDelay);
    }

    /**
     * Handle incoming WebSocket messages
     */
    function handleMessage(message) {
        switch (message.type) {
            case 'status':
                updateCameraStatus(message);
                break;

            case 'notification':
                showNotification(message.title, message.body);
                break;

            default:
                console.log('[WebSocket] Unknown message type:', message.type);
        }
    }

    /**
     * Update camera status in UI
     */
    function updateCameraStatus(status) {
        // Update global status variables
        window.cameraOnlineStatus = status.online;
        window.secondsSinceUpdate = status.online ? 0 : 999;

        // Parse status data (memory,temp,ping,signal)
        const parts = (status.data || 'N/A,N/A,N/A,N/A').split(',');

        // Trigger status update event
        const event = new CustomEvent('cameraStatusUpdate', {
            detail: {
                online: status.online,
                memory: parts[0] || 'N/A',
                temperature: parts[1] || 'N/A',
                latency: parts[2] || 'N/A',
                signal: parts[3] || 'N/A',
                timestamp: status.timestamp
            }
        });
        window.dispatchEvent(event);

        // Update status indicator if exists
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = 'status-indicator ' + (status.online ? 'online' : 'offline');
            indicator.textContent = status.online ? 'Connected (Online)' : 'Disconnected (Offline)';
        }

        console.log('[WebSocket] Status update:', status.online ? 'ONLINE' : 'OFFLINE');
    }

    /**
     * Show browser notification
     */
    function showNotification(title, body) {
        // Don't notify if page is focused
        if (document.visibilityState === 'visible' && document.hasFocus()) {
            return;
        }

        // Check permission
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const notification = new Notification(title, {
            body: body,
            icon: 'assets/images/logo.ico',
            tag: 'camera-status',
            renotify: true
        });

        setTimeout(() => notification.close(), 10000);

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }

    /**
     * Check if WebSocket is connected
     */
    function isWebSocketConnected() {
        return isConnected && ws && ws.readyState === WebSocket.OPEN;
    }

    /**
     * Get connection status
     */
    function getConnectionStatus() {
        if (!ws) return 'disconnected';

        switch (ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'unknown';
        }
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Auto-connect on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // Expose API
    window.CameraWebSocket = {
        connect: connect,
        isConnected: isWebSocketConnected,
        getStatus: getConnectionStatus,
        config: WS_CONFIG
    };

})(window);
