/**
 * WebSocket Client - Browser Integration
 * Production-ready, integrates with existing camera-control.js
 *
 * @version 2.0.0
 * @author Net Storm
 */

'use strict';

(function(window, document) {
    // ==========================================================================
    // CONFIGURATION
    // ==========================================================================

    const CONFIG = {
        SERVER: window.WEBSOCKET_SERVER_URL || 'ws://193.160.119.136:8080',
        RECONNECT_DELAY: 2000,
        MAX_RECONNECT_DELAY: 30000,
        RECONNECT_MULTIPLIER: 1.5
    };

    // ==========================================================================
    // STATE
    // ==========================================================================

    const state = {
        ws: null,
        connected: false,
        reconnectDelay: CONFIG.RECONNECT_DELAY,
        reconnectTimer: null
    };

    // ==========================================================================
    // CONNECTION
    // ==========================================================================

    function connect() {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            return;
        }

        console.log('[WS] Connecting to', CONFIG.SERVER);

        try {
            state.ws = new WebSocket(CONFIG.SERVER);

            state.ws.onopen = function() {
                console.log('[WS] Connected');
                state.connected = true;
                state.reconnectDelay = CONFIG.RECONNECT_DELAY;

                // Identify as browser
                send({ type: 'identify', role: 'browser' });

                // Notify app
                trigger('ws:connected');
            };

            state.ws.onmessage = function(event) {
                try {
                    const msg = JSON.parse(event.data);
                    handleMessage(msg);
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            state.ws.onclose = function() {
                console.log('[WS] Disconnected');
                state.connected = false;
                trigger('ws:disconnected');
                scheduleReconnect();
            };

            state.ws.onerror = function(err) {
                console.error('[WS] Error:', err);
            };

        } catch (err) {
            console.error('[WS] Connection failed:', err);
            scheduleReconnect();
        }
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
        }

        state.reconnectTimer = setTimeout(function() {
            connect();
            state.reconnectDelay = Math.min(
                state.reconnectDelay * CONFIG.RECONNECT_MULTIPLIER,
                CONFIG.MAX_RECONNECT_DELAY
            );
        }, state.reconnectDelay);
    }

    function send(data) {
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // ==========================================================================
    // MESSAGE HANDLER
    // ==========================================================================

    function handleMessage(msg) {
        console.log('[WS] Received:', msg.type);

        switch (msg.type) {
            // Initial status
            case 'init':
                trigger('ws:init', msg.status);
                updateStatus(msg.status);
                break;

            // Status update
            case 'status':
                updateStatus(msg.status);
                break;

            // Camera online
            case 'camera_online':
                trigger('camera:online');
                notify('Camera Connected', 'Camera is now online');
                break;

            // Camera offline
            case 'camera_offline':
                trigger('camera:offline');
                notify('Camera Disconnected', 'Connection lost');
                break;

            // Capture started
            case 'capture_started':
                trigger('capture:started', { id: msg.id });
                updateCaptureUI(true);
                break;

            // Capture done - INSTANT!
            case 'capture_done':
                trigger('capture:done', {
                    id: msg.id,
                    url: msg.url,
                    duration: msg.duration
                });
                updateCaptureUI(false);
                updateImage(msg.url);
                notify('Capture Complete', 'Image captured in ' + msg.duration + 'ms');
                break;

            // Capture timeout
            case 'capture_timeout':
                trigger('capture:timeout', { id: msg.id });
                updateCaptureUI(false);
                notify('Capture Timeout', 'Image capture took too long');
                break;

            // Live frame
            case 'live_frame':
                trigger('live:frame', { url: msg.url });
                updateLiveImage(msg.url);
                break;

            // Live status
            case 'live_status':
                trigger('live:status', { active: msg.active });
                break;

            // Error
            case 'error':
                console.error('[WS] Server error:', msg.message);
                trigger('ws:error', { message: msg.message });
                break;

            default:
                console.log('[WS] Unknown message:', msg.type);
        }
    }

    // ==========================================================================
    // UI UPDATES
    // ==========================================================================

    function updateStatus(status) {
        if (!status) return;

        // Parse data
        const parts = (status.data || 'N/A,N/A,N/A,N/A').split(',');
        const memory = parts[0] || 'N/A';
        const temp = parts[1] || 'N/A';
        const ping = parts[2] || 'N/A';
        const signal = parts[3] || 'N/A';

        // Update status elements if they exist
        const memEl = document.getElementById('memoryStatus');
        const tempEl = document.getElementById('tempStatus');
        const pingEl = document.getElementById('pingStatus');
        const signalEl = document.getElementById('signalStatus');

        if (memEl) memEl.textContent = memory;
        if (tempEl) tempEl.textContent = temp;
        if (pingEl) pingEl.textContent = ping;
        if (signalEl) signalEl.textContent = signal;

        // Update online indicator
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            if (status.online) {
                indicator.className = 'status-indicator online';
                indicator.textContent = 'Connected (Online)';
            } else {
                indicator.className = 'status-indicator offline';
                indicator.textContent = 'Disconnected (Offline)';
            }
        }

        // Expose to global
        window.cameraStatus = status;
    }

    function updateCaptureUI(capturing) {
        const btn = document.getElementById('takePicBtn');
        if (!btn) return;

        if (capturing) {
            btn.disabled = true;
            btn.classList.add('capturing');
            btn.textContent = btn.dataset.captureText || 'Capturing...';
        } else {
            btn.disabled = false;
            btn.classList.remove('capturing');
            btn.textContent = btn.dataset.normalText || 'Capture Image';
        }
    }

    function updateImage(url) {
        const img = document.getElementById('pic');
        if (img) {
            img.src = url;
        }
    }

    function updateLiveImage(url) {
        const img = document.getElementById('liveImg');
        if (img) {
            img.src = url;
        }
    }

    // ==========================================================================
    // NOTIFICATIONS
    // ==========================================================================

    function notify(title, body) {
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

        setTimeout(function() { notification.close(); }, 8000);

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }

    // Request permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    function trigger(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data || {} });
        window.dispatchEvent(event);
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    const API = {
        // Connection
        connect: connect,

        isConnected: function() {
            return state.connected;
        },

        // Camera commands
        capture: function() {
            return send({ type: 'capture' });
        },

        startLive: function(quality) {
            return send({
                type: 'live_start',
                quality: quality || 'medium'
            });
        },

        stopLive: function() {
            return send({ type: 'live_stop' });
        },

        updateSettings: function(settings) {
            return send({
                type: 'settings',
                data: settings
            });
        },

        // Raw send
        send: send
    };

    // ==========================================================================
    // AUTO-CONNECT
    // ==========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

    // Expose API
    window.CameraWS = API;

})(window, document);
