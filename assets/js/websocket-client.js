/**
 * WebSocket Client with Automatic Fallback
 *
 * Features:
 * - Automatic fallback to HTTP mode if WebSocket fails
 * - Seamless integration with existing camera-control.js
 * - No interference with existing functionality
 *
 * @version 2.0.0
 * @author Net Storm
 */

'use strict';

(function(window, document) {
    // ==========================================================================
    // CONFIG
    // ==========================================================================

    var CONFIG = {
        SERVER: window.WEBSOCKET_SERVER_URL || '',
        MAX_FAILURES: 3,        // After 3 failures, use HTTP mode
        RETRY_AFTER: 60000,     // Try WebSocket again after 60s
        RECONNECT_DELAY: 2000,
        MAX_RECONNECT_DELAY: 30000
    };

    // ==========================================================================
    // STATE
    // ==========================================================================

    var state = {
        ws: null,
        connected: false,
        failureCount: 0,
        httpMode: false,        // true = using HTTP fallback
        reconnectTimer: null,
        reconnectDelay: CONFIG.RECONNECT_DELAY
    };

    // ==========================================================================
    // SAFETY CHECK
    // ==========================================================================

    // If no server configured, don't do anything
    if (!CONFIG.SERVER) {
        console.log('[WS] Not configured - using HTTP mode');
        window.CameraWS = { enabled: false };
        return;
    }

    // ==========================================================================
    // FALLBACK LOGIC
    // ==========================================================================

    function switchToHttpMode() {
        state.httpMode = true;
        console.log('[WS] Switching to HTTP mode (fallback)');
        trigger('ws:fallback');

        // Try WebSocket again later
        setTimeout(function() {
            state.httpMode = false;
            state.failureCount = 0;
            console.log('[WS] Retrying WebSocket connection...');
            connect();
        }, CONFIG.RETRY_AFTER);
    }

    // ==========================================================================
    // CONNECTION
    // ==========================================================================

    function connect() {
        if (state.httpMode) {
            return;  // In HTTP mode, don't connect
        }

        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            return;  // Already connected
        }

        console.log('[WS] Connecting to', CONFIG.SERVER);

        try {
            state.ws = new WebSocket(CONFIG.SERVER);

            state.ws.onopen = function() {
                console.log('[WS] Connected');
                state.connected = true;
                state.failureCount = 0;  // Reset on success
                state.reconnectDelay = CONFIG.RECONNECT_DELAY;

                // Identify as browser
                send({ type: 'identify', role: 'browser' });
                trigger('ws:connected');
            };

            state.ws.onmessage = function(event) {
                try {
                    var msg = JSON.parse(event.data);
                    handleMessage(msg);
                } catch (err) {
                    console.error('[WS] Parse error:', err);
                }
            };

            state.ws.onclose = function() {
                console.log('[WS] Disconnected');
                state.connected = false;
                state.failureCount++;

                if (state.failureCount >= CONFIG.MAX_FAILURES) {
                    switchToHttpMode();
                } else {
                    trigger('ws:disconnected');
                    scheduleReconnect();
                }
            };

            state.ws.onerror = function(err) {
                console.error('[WS] Error:', err);
                state.failureCount++;
            };

        } catch (err) {
            console.error('[WS] Connection failed:', err);
            state.failureCount++;

            if (state.failureCount >= CONFIG.MAX_FAILURES) {
                switchToHttpMode();
            } else {
                scheduleReconnect();
            }
        }
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
        }

        if (state.httpMode) {
            return;  // Don't reconnect in HTTP mode
        }

        state.reconnectTimer = setTimeout(function() {
            connect();
            state.reconnectDelay = Math.min(
                state.reconnectDelay * 1.5,
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
            case 'init':
                trigger('ws:init', msg.status);
                updateStatus(msg.status);
                break;

            case 'status':
                updateStatus(msg.status);
                break;

            case 'camera_online':
                trigger('camera:online');
                notify('Camera Connected', 'Camera is now online');
                break;

            case 'camera_offline':
                trigger('camera:offline');
                notify('Camera Disconnected', 'Connection lost');
                break;

            case 'capture_started':
                trigger('capture:started', { id: msg.id });
                setCaptureUI(true);
                break;

            case 'capture_done':
                trigger('capture:done', {
                    id: msg.id,
                    url: msg.url,
                    duration: msg.duration
                });
                setCaptureUI(false);
                setImage(msg.url);
                notify('Capture Complete', 'Image captured in ' + msg.duration + 'ms');
                break;

            case 'capture_timeout':
                trigger('capture:timeout', { id: msg.id });
                setCaptureUI(false);
                break;

            case 'live_frame':
                trigger('live:frame', { url: msg.url });
                setLiveImage(msg.url);
                break;

            case 'live_status':
                trigger('live:status', { active: msg.active });
                break;

            case 'error':
                console.error('[WS] Server error:', msg.message);
                break;
        }
    }

    // ==========================================================================
    // UI UPDATES (optional - won't break if elements don't exist)
    // ==========================================================================

    function updateStatus(status) {
        if (!status) return;

        var parts = (status.data || 'N/A,N/A,N/A,N/A').split(',');

        var memEl = document.getElementById('memoryStatus');
        var tempEl = document.getElementById('tempStatus');
        var pingEl = document.getElementById('pingStatus');
        var sigEl = document.getElementById('signalStatus');

        if (memEl) memEl.textContent = parts[0] || 'N/A';
        if (tempEl) tempEl.textContent = parts[1] || 'N/A';
        if (pingEl) pingEl.textContent = parts[2] || 'N/A';
        if (sigEl) sigEl.textContent = parts[3] || 'N/A';

        var indicator = document.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = 'status-indicator ' + (status.online ? 'online' : 'offline');
            indicator.textContent = status.online ? 'Connected (Online)' : 'Disconnected (Offline)';
        }

        window.cameraStatus = status;
    }

    function setCaptureUI(capturing) {
        var btn = document.getElementById('takePicBtn');
        if (!btn) return;

        if (capturing) {
            btn.disabled = true;
            btn.textContent = 'Capturing...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Capture Image';
        }
    }

    function setImage(url) {
        var img = document.getElementById('pic');
        if (img) img.src = url;
    }

    function setLiveImage(url) {
        var img = document.getElementById('liveImg');
        if (img) img.src = url;
    }

    // ==========================================================================
    // NOTIFICATIONS
    // ==========================================================================

    function notify(title, body) {
        if (document.visibilityState === 'visible' && document.hasFocus()) {
            return;  // Page is focused, no need to notify
        }

        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        var n = new Notification(title, {
            body: body,
            icon: 'assets/images/logo.ico',
            tag: 'camera',
            renotify: true
        });

        setTimeout(function() { n.close(); }, 8000);
        n.onclick = function() {
            window.focus();
            n.close();
        };
    }

    // Request permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // ==========================================================================
    // EVENTS
    // ==========================================================================

    function trigger(name, data) {
        var event = new CustomEvent(name, { detail: data || {} });
        window.dispatchEvent(event);
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    window.CameraWS = {
        enabled: true,

        isConnected: function() {
            return state.connected;
        },

        isHttpMode: function() {
            return state.httpMode;
        },

        capture: function() {
            if (state.httpMode) {
                return false;  // Let camera-control.js handle it
            }
            return send({ type: 'capture' });
        },

        startLive: function(quality) {
            if (state.httpMode) {
                return false;
            }
            return send({
                type: 'live_start',
                quality: quality || 'medium'
            });
        },

        stopLive: function() {
            if (state.httpMode) {
                return false;
            }
            return send({ type: 'live_stop' });
        },

        updateSettings: function(settings) {
            if (state.httpMode) {
                return false;
            }
            return send({
                type: 'settings',
                data: settings
            });
        }
    };

    // ==========================================================================
    // AUTO-CONNECT
    // ==========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

})(window, document);
