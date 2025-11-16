/**
 * WebSocket Server - Full Camera Control
 * Production-ready, follows Google/Facebook best practices
 *
 * @version 2.0.0
 * @author Net Storm
 * @license Proprietary
 */

'use strict';

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    PORT: process.env.WS_PORT || 8080,
    PING_INTERVAL: 30000,
    CAMERA_TIMEOUT: 15000,
    MAX_MESSAGE_SIZE: 1024 * 10, // 10KB max
    LOG_FILE: '/var/log/cam-websocket.log'
};

// =============================================================================
// LOGGING (Production-grade)
// =============================================================================

function log(level, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}`;
    console.log(logLine);

    try {
        fs.appendFileSync(CONFIG.LOG_FILE, logLine + '\n');
    } catch (err) {
        // Ignore log write errors
    }
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

const state = {
    camera: null,
    browsers: new Set(),
    status: {
        online: false,
        data: 'N/A,N/A,N/A,N/A',
        timestamp: 0,
        capturing: false,
        liveActive: false
    },
    pendingCaptures: new Map()
};

// =============================================================================
// HTTP SERVER
// =============================================================================

const httpServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            camera: state.camera ? 'connected' : 'disconnected',
            browsers: state.browsers.size,
            uptime: Math.floor(process.uptime()),
            memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Camera WebSocket Server v2.0');
});

// =============================================================================
// WEBSOCKET SERVER
// =============================================================================

const wss = new WebSocket.Server({
    server: httpServer,
    maxPayload: CONFIG.MAX_MESSAGE_SIZE
});

// Broadcast to all browsers
function broadcast(message) {
    const data = JSON.stringify(message);
    state.browsers.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (err) {
                log('ERROR', `Broadcast failed: ${err.message}`);
            }
        }
    });
}

// Send to camera
function sendToCamera(message) {
    if (!state.camera || state.camera.readyState !== WebSocket.OPEN) {
        return false;
    }
    try {
        state.camera.send(JSON.stringify(message));
        return true;
    } catch (err) {
        log('ERROR', `Send to camera failed: ${err.message}`);
        return false;
    }
}

// =============================================================================
// CONNECTION HANDLER
// =============================================================================

wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    log('INFO', `New connection from ${ip}`);

    ws.isAlive = true;
    ws.clientType = 'unknown';

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (rawMessage) => {
        let message;
        try {
            message = JSON.parse(rawMessage);
        } catch (err) {
            log('WARN', `Invalid JSON from ${ip}`);
            return;
        }

        handleMessage(ws, message, ip);
    });

    ws.on('close', () => {
        handleDisconnect(ws, ip);
    });

    ws.on('error', (err) => {
        log('ERROR', `WebSocket error from ${ip}: ${err.message}`);
    });
});

// =============================================================================
// MESSAGE HANDLERS
// =============================================================================

function handleMessage(ws, message, ip) {
    const { type } = message;

    // Identification
    if (type === 'identify') {
        if (message.role === 'camera') {
            identifyAsCamera(ws, ip);
        } else if (message.role === 'browser') {
            identifyAsBrowser(ws, ip);
        }
        return;
    }

    // Camera messages
    if (ws.clientType === 'camera') {
        handleCameraMessage(message);
        return;
    }

    // Browser messages
    if (ws.clientType === 'browser') {
        handleBrowserMessage(ws, message);
        return;
    }

    log('WARN', `Unidentified client sent: ${type}`);
}

function identifyAsCamera(ws, ip) {
    if (state.camera) {
        log('WARN', 'Replacing existing camera connection');
        state.camera.close();
    }

    state.camera = ws;
    ws.clientType = 'camera';
    state.status.online = true;
    state.status.timestamp = Date.now();

    log('INFO', `Camera connected from ${ip}`);

    broadcast({
        type: 'camera_online',
        timestamp: Date.now()
    });
}

function identifyAsBrowser(ws, ip) {
    state.browsers.add(ws);
    ws.clientType = 'browser';

    log('INFO', `Browser connected from ${ip} (total: ${state.browsers.size})`);

    // Send current status
    ws.send(JSON.stringify({
        type: 'init',
        status: state.status
    }));
}

function handleCameraMessage(message) {
    const { type } = message;

    switch (type) {
        case 'heartbeat':
            state.status.data = message.data || state.status.data;
            state.status.timestamp = Date.now();
            state.status.online = true;
            broadcast({ type: 'status', status: state.status });
            break;

        case 'capture_done':
            state.status.capturing = false;
            const captureId = message.id;

            log('INFO', `Capture complete: ${captureId} (${message.duration}ms)`);

            broadcast({
                type: 'capture_done',
                id: captureId,
                url: message.url + '?t=' + Date.now(),
                duration: message.duration
            });

            if (state.pendingCaptures.has(captureId)) {
                clearTimeout(state.pendingCaptures.get(captureId));
                state.pendingCaptures.delete(captureId);
            }
            break;

        case 'live_frame':
            broadcast({
                type: 'live_frame',
                url: 'live.jpg?t=' + Date.now()
            });
            break;

        case 'live_status':
            state.status.liveActive = message.active;
            broadcast({ type: 'live_status', active: message.active });
            break;

        default:
            log('WARN', `Unknown camera message: ${type}`);
    }
}

function handleBrowserMessage(ws, message) {
    const { type } = message;

    switch (type) {
        case 'capture':
            requestCapture(ws);
            break;

        case 'live_start':
            sendToCamera({
                type: 'live_start',
                quality: message.quality || 'medium'
            });
            break;

        case 'live_stop':
            sendToCamera({ type: 'live_stop' });
            break;

        case 'settings':
            sendToCamera({
                type: 'settings',
                data: message.data
            });
            log('INFO', 'Settings update sent to camera');
            break;

        default:
            log('WARN', `Unknown browser message: ${type}`);
    }
}

function requestCapture(ws) {
    if (!state.status.online) {
        ws.send(JSON.stringify({ type: 'error', message: 'Camera offline' }));
        return;
    }

    if (state.status.capturing) {
        ws.send(JSON.stringify({ type: 'error', message: 'Capture in progress' }));
        return;
    }

    const captureId = Date.now().toString();
    state.status.capturing = true;

    log('INFO', `Capture requested: ${captureId}`);

    const sent = sendToCamera({
        type: 'capture',
        id: captureId
    });

    if (!sent) {
        state.status.capturing = false;
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to send command' }));
        return;
    }

    broadcast({ type: 'capture_started', id: captureId });

    // Timeout protection
    const timeout = setTimeout(() => {
        if (state.status.capturing) {
            state.status.capturing = false;
            broadcast({ type: 'capture_timeout', id: captureId });
            log('WARN', `Capture timeout: ${captureId}`);
        }
        state.pendingCaptures.delete(captureId);
    }, 60000);

    state.pendingCaptures.set(captureId, timeout);
}

function handleDisconnect(ws, ip) {
    if (ws.clientType === 'camera') {
        state.camera = null;
        state.status.online = false;
        state.status.capturing = false;
        state.status.liveActive = false;

        log('INFO', `Camera disconnected from ${ip}`);

        broadcast({
            type: 'camera_offline',
            timestamp: Date.now()
        });
    } else if (ws.clientType === 'browser') {
        state.browsers.delete(ws);
        log('INFO', `Browser disconnected from ${ip} (total: ${state.browsers.size})`);
    }
}

// =============================================================================
// HEALTH CHECKS
// =============================================================================

// Camera timeout check
setInterval(() => {
    if (state.status.online && Date.now() - state.status.timestamp > CONFIG.CAMERA_TIMEOUT) {
        state.status.online = false;
        log('WARN', 'Camera timeout - no heartbeat');
        broadcast({ type: 'camera_offline', reason: 'timeout' });
    }
}, 5000);

// Client ping
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            log('INFO', 'Terminating dead connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, CONFIG.PING_INTERVAL);

// =============================================================================
// STARTUP
// =============================================================================

httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
    log('INFO', `Server started on port ${CONFIG.PORT}`);
    console.log(`
┌─────────────────────────────────────────┐
│     Camera WebSocket Server v2.0        │
│     Port: ${CONFIG.PORT}                            │
│     Status: http://YOUR_IP:${CONFIG.PORT}/health   │
└─────────────────────────────────────────┘
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('INFO', 'Shutting down gracefully...');
    wss.close(() => {
        httpServer.close(() => {
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    log('INFO', 'Shutting down...');
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    log('ERROR', `Uncaught exception: ${err.message}`);
});
