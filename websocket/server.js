/**
 * WebSocket Server for Full Camera Control
 * Real-time bidirectional communication for instant response
 *
 * Features:
 * - Instant capture command → camera
 * - Instant capture completion → browser
 * - Real-time settings updates
 * - Live stream control
 * - Status monitoring
 *
 * Run: node server.js
 * Port: 8080
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = 8080;
const PING_INTERVAL = 30000;
const CAMERA_TIMEOUT = 10000; // 10 seconds

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            browsers: browserClients.size,
            camera: cameraClient ? 'connected' : 'disconnected',
            uptime: process.uptime()
        }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Camera WebSocket Server v2.0 - Full Control');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Separate client tracking
let cameraClient = null;
const browserClients = new Set();

// Camera state
let cameraStatus = {
    online: false,
    data: 'N/A,N/A,N/A,N/A',
    timestamp: 0,
    capturing: false,
    liveStreaming: false
};

// Pending capture requests
const pendingCaptures = new Map();

// Broadcast to all browsers
function broadcastToBrowsers(message) {
    const data = JSON.stringify(message);
    browserClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Send to camera
function sendToCamera(message) {
    if (cameraClient && cameraClient.readyState === WebSocket.OPEN) {
        cameraClient.send(JSON.stringify(message));
        return true;
    }
    return false;
}

// Handle new connections
wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] New connection from ${clientIP}`);

    // Wait for client to identify itself
    ws.clientType = 'unknown';

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ======================
            // CLIENT IDENTIFICATION
            // ======================
            if (data.type === 'identify') {
                if (data.role === 'camera') {
                    // Raspberry Pi camera client
                    if (cameraClient) {
                        cameraClient.close();
                    }
                    cameraClient = ws;
                    ws.clientType = 'camera';
                    cameraStatus.online = true;
                    cameraStatus.timestamp = Date.now();

                    console.log(`[${new Date().toISOString()}] 📷 Camera connected`);

                    broadcastToBrowsers({
                        type: 'camera_connected',
                        timestamp: Date.now()
                    });

                    broadcastToBrowsers({
                        type: 'notification',
                        title: '📷 Camera Connected',
                        body: 'Camera is online and ready'
                    });

                } else if (data.role === 'browser') {
                    // Browser client
                    browserClients.add(ws);
                    ws.clientType = 'browser';

                    console.log(`[${new Date().toISOString()}] 🌐 Browser connected (total: ${browserClients.size})`);

                    // Send current status
                    ws.send(JSON.stringify({
                        type: 'status',
                        ...cameraStatus
                    }));
                }
                return;
            }

            // ======================
            // CAMERA → SERVER
            // ======================
            if (ws.clientType === 'camera') {
                // Status update
                if (data.type === 'status_update') {
                    cameraStatus.data = data.data || 'N/A,N/A,N/A,N/A';
                    cameraStatus.timestamp = Date.now();
                    cameraStatus.online = true;

                    broadcastToBrowsers({
                        type: 'status',
                        ...cameraStatus
                    });
                }

                // Capture completed
                if (data.type === 'capture_complete') {
                    cameraStatus.capturing = false;
                    const captureId = data.captureId;
                    const imageUrl = data.imageUrl || 'pic.jpg';
                    const duration = data.duration || 0;

                    console.log(`[${new Date().toISOString()}] ✅ Capture complete: ${imageUrl} (${duration}ms)`);

                    // Notify all browsers IMMEDIATELY
                    broadcastToBrowsers({
                        type: 'capture_complete',
                        captureId: captureId,
                        imageUrl: imageUrl + '?t=' + Date.now(),
                        duration: duration,
                        timestamp: Date.now()
                    });

                    // Clean up pending capture
                    if (pendingCaptures.has(captureId)) {
                        clearTimeout(pendingCaptures.get(captureId));
                        pendingCaptures.delete(captureId);
                    }
                }

                // Live stream frame ready
                if (data.type === 'live_frame_ready') {
                    broadcastToBrowsers({
                        type: 'live_frame_ready',
                        imageUrl: 'live.jpg?t=' + Date.now(),
                        timestamp: Date.now()
                    });
                }

                // Live stream status changed
                if (data.type === 'live_status') {
                    cameraStatus.liveStreaming = data.active;
                    broadcastToBrowsers({
                        type: 'live_status',
                        active: data.active
                    });
                }
            }

            // ======================
            // BROWSER → SERVER → CAMERA
            // ======================
            if (ws.clientType === 'browser') {
                // Capture request
                if (data.type === 'capture') {
                    if (!cameraStatus.online) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Camera is offline'
                        }));
                        return;
                    }

                    if (cameraStatus.capturing) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Capture already in progress'
                        }));
                        return;
                    }

                    const captureId = Date.now().toString();
                    cameraStatus.capturing = true;

                    console.log(`[${new Date().toISOString()}] 📸 Capture requested: ${captureId}`);

                    // Send to camera immediately
                    const sent = sendToCamera({
                        type: 'capture',
                        captureId: captureId,
                        timestamp: Date.now()
                    });

                    if (sent) {
                        // Notify browser that capture started
                        broadcastToBrowsers({
                            type: 'capture_started',
                            captureId: captureId,
                            timestamp: Date.now()
                        });

                        // Timeout for capture (30 seconds max)
                        const timeout = setTimeout(() => {
                            if (cameraStatus.capturing) {
                                cameraStatus.capturing = false;
                                broadcastToBrowsers({
                                    type: 'capture_timeout',
                                    captureId: captureId
                                });
                            }
                            pendingCaptures.delete(captureId);
                        }, 30000);

                        pendingCaptures.set(captureId, timeout);
                    } else {
                        cameraStatus.capturing = false;
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Failed to send capture command'
                        }));
                    }
                }

                // Live stream control
                if (data.type === 'live_control') {
                    sendToCamera({
                        type: 'live_control',
                        action: data.action, // 'start' or 'stop'
                        quality: data.quality || 'medium'
                    });
                }

                // Settings update
                if (data.type === 'settings_update') {
                    sendToCamera({
                        type: 'settings_update',
                        settings: data.settings
                    });

                    console.log(`[${new Date().toISOString()}] ⚙️ Settings update sent`);
                }

                // Request current status
                if (data.type === 'get_status') {
                    ws.send(JSON.stringify({
                        type: 'status',
                        ...cameraStatus
                    }));
                }
            }

        } catch (err) {
            console.error('Message error:', err.message);
        }
    });

    ws.on('close', () => {
        if (ws.clientType === 'camera') {
            cameraClient = null;
            cameraStatus.online = false;
            cameraStatus.capturing = false;
            cameraStatus.liveStreaming = false;

            console.log(`[${new Date().toISOString()}] 📷 Camera disconnected`);

            broadcastToBrowsers({
                type: 'camera_disconnected',
                timestamp: Date.now()
            });

            broadcastToBrowsers({
                type: 'notification',
                title: '🔴 Camera Disconnected',
                body: 'Connection lost!'
            });
        } else if (ws.clientType === 'browser') {
            browserClients.delete(ws);
            console.log(`[${new Date().toISOString()}] 🌐 Browser disconnected (total: ${browserClients.size})`);
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });

    // Keep alive
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
});

// Check for camera timeout
setInterval(() => {
    if (cameraStatus.online && Date.now() - cameraStatus.timestamp > CAMERA_TIMEOUT) {
        cameraStatus.online = false;

        broadcastToBrowsers({
            type: 'status',
            ...cameraStatus
        });

        broadcastToBrowsers({
            type: 'notification',
            title: '⚠️ Camera Timeout',
            body: 'No heartbeat received'
        });

        console.log(`[${new Date().toISOString()}] ⚠️ Camera timeout`);
    }
}, 5000);

// Ping all clients
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, PING_INTERVAL);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║   Camera WebSocket Server v2.0           ║
║   Full Real-time Control                 ║
╠══════════════════════════════════════════╣
║   Port: ${PORT}                              ║
║   Started: ${new Date().toISOString()}   ║
╠══════════════════════════════════════════╣
║   Features:                              ║
║   • Instant capture commands             ║
║   • Real-time status updates             ║
║   • Live stream control                  ║
║   • Settings synchronization             ║
╚══════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wss.close(() => server.close(() => process.exit(0)));
});
