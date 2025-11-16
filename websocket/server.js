/**
 * WebSocket Server for Camera Status
 * Simple, fast, real-time status broadcasting
 *
 * Run: node server.js
 * Port: 8080
 */

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = 8080;
const PING_INTERVAL = 30000; // 30 seconds

// Create HTTP server
const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            clients: wss.clients.size,
            uptime: process.uptime()
        }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Camera WebSocket Server Running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store latest camera status
let cameraStatus = {
    online: false,
    data: 'N/A,N/A,N/A,N/A',
    timestamp: 0
};

// Broadcast to all connected clients
function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Handle new connections
wss.on('connection', (ws, req) => {
    console.log(`[${new Date().toISOString()}] Client connected from ${req.socket.remoteAddress}`);

    // Send current status immediately
    ws.send(JSON.stringify({
        type: 'status',
        ...cameraStatus
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Camera sending status update
            if (data.type === 'camera_update') {
                const wasOnline = cameraStatus.online;

                cameraStatus = {
                    online: true,
                    data: data.data || 'N/A,N/A,N/A,N/A',
                    timestamp: Date.now()
                };

                // Broadcast to all browsers
                broadcast({
                    type: 'status',
                    ...cameraStatus
                });

                // Notify if status changed
                if (!wasOnline) {
                    broadcast({
                        type: 'notification',
                        title: 'Camera Connected',
                        body: 'Camera is now online'
                    });
                }

                console.log(`[${new Date().toISOString()}] Camera update: ${data.data}`);
            }

            // Browser requesting current status
            if (data.type === 'get_status') {
                ws.send(JSON.stringify({
                    type: 'status',
                    ...cameraStatus
                }));
            }

        } catch (err) {
            console.error('Invalid message:', err.message);
        }
    });

    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected`);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });

    // Keep connection alive
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

// Check for offline camera (no update in 10 seconds)
setInterval(() => {
    if (cameraStatus.online && Date.now() - cameraStatus.timestamp > 10000) {
        cameraStatus.online = false;

        broadcast({
            type: 'status',
            ...cameraStatus
        });

        broadcast({
            type: 'notification',
            title: 'Camera Disconnected',
            body: 'Camera connection lost!'
        });

        console.log(`[${new Date().toISOString()}] Camera offline (timeout)`);
    }
}, 5000);

// Ping clients to keep connections alive
setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, PING_INTERVAL);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
============================================
  Camera WebSocket Server
  Port: ${PORT}
  Started: ${new Date().toISOString()}
============================================

  Endpoints:
  - ws://YOUR_VPS_IP:${PORT} (WebSocket)
  - http://YOUR_VPS_IP:${PORT}/health (Status)

  Ready for connections...
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});
