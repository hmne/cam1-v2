#!/usr/bin/env node
/**
 * Raspberry Pi WebSocket Client
 * Receives commands instantly and responds immediately
 *
 * Features:
 * - Instant capture on command
 * - Real-time status reporting
 * - Settings updates
 * - Live stream control
 *
 * Usage: node pi-client.js
 * Or: ./pi-client.js (make executable first)
 */

const WebSocket = require('ws');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration - EDIT THESE
const CONFIG = {
    // WebSocket server (your VPS)
    WS_SERVER: 'ws://193.160.119.136:8080',

    // Reconnect settings
    RECONNECT_DELAY: 2000,
    MAX_RECONNECT_DELAY: 30000,

    // Status update interval (ms)
    STATUS_INTERVAL: 2000,  // Every 2 seconds

    // SFTP settings for image upload
    SFTP_USER: 'your_user',
    SFTP_HOST: 'netstorm.site',
    SFTP_PATH: '/home/user/cam1/',

    // Camera settings
    IMAGE_PATH: '/tmp/pic.jpg',
    LIVE_PATH: '/tmp/live.jpg',
    SETTINGS_FILE: '/var/tmp/var.tmp'
};

// State
let ws = null;
let reconnectDelay = CONFIG.RECONNECT_DELAY;
let statusInterval = null;
let liveStreamActive = false;
let liveStreamProcess = null;

// Logging
function log(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
    fs.appendFileSync('/var/log/pi-websocket.log', `[${timestamp}] ${msg}\n`);
}

// Get system status
function getSystemStatus() {
    let memory = 'N/A', temp = 'N/A', ping = 'N/A', wifi = 'N/A';

    try {
        // Memory usage
        const memInfo = execSync('free -m | grep Mem:', { encoding: 'utf8', timeout: 2000 });
        const memParts = memInfo.trim().split(/\s+/);
        const total = parseInt(memParts[1]);
        const used = parseInt(memParts[2]);
        memory = Math.round((used / total) * 100) + '%';
    } catch (e) {}

    try {
        // CPU temperature
        const tempData = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        temp = (parseInt(tempData) / 1000).toFixed(1) + 'C';
    } catch (e) {}

    try {
        // Network ping
        const pingResult = execSync('ping -c 1 -W 2 8.8.8.8 2>/dev/null | grep "time=" | sed "s/.*time=\\([0-9.]*\\).*/\\1/"', {
            encoding: 'utf8',
            timeout: 3000,
            shell: '/bin/bash'
        }).trim();
        if (pingResult) ping = pingResult + 'ms';
    } catch (e) {}

    try {
        // WiFi signal
        const wifiData = execSync('iwconfig 2>/dev/null | grep "Link Quality"', { encoding: 'utf8', timeout: 2000 });
        const match = wifiData.match(/Link Quality=(\d+)\/(\d+)/);
        if (match) {
            wifi = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100) + '%';
        }
    } catch (e) {}

    return `${memory},${temp},${ping},${wifi}`;
}

// Capture image immediately
async function captureImage(captureId) {
    const startTime = Date.now();
    log(`📸 Starting capture: ${captureId}`);

    try {
        // Read current settings
        let resolution = '1920x1080';
        let compression = '25';
        let rotation = '0';

        if (fs.existsSync(CONFIG.SETTINGS_FILE)) {
            const settings = fs.readFileSync(CONFIG.SETTINGS_FILE, 'utf8').trim().split(/\s+/);
            // Map resolution index to actual size
            const resolutions = ['1280x960', '1920x1080', '2592x1944', '3200x2400'];
            if (settings[0]) resolution = resolutions[parseInt(settings[0]) - 1] || resolution;
            if (settings[1]) compression = settings[1];
            if (settings[4]) rotation = settings[4];
        }

        const [width, height] = resolution.split('x');

        // Capture with raspistill (fast timeout)
        const cmd = `raspistill -w ${width} -h ${height} -q ${100 - parseInt(compression)} -rot ${rotation} -t 1 -o ${CONFIG.IMAGE_PATH}`;

        log(`Executing: ${cmd}`);

        await new Promise((resolve, reject) => {
            exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Upload via SFTP immediately
        log('📤 Uploading image...');
        const uploadCmd = `scp -o StrictHostKeyChecking=no ${CONFIG.IMAGE_PATH} ${CONFIG.SFTP_USER}@${CONFIG.SFTP_HOST}:${CONFIG.SFTP_PATH}pic.jpg`;

        await new Promise((resolve, reject) => {
            exec(uploadCmd, { timeout: 30000 }, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        const duration = Date.now() - startTime;
        log(`✅ Capture complete in ${duration}ms`);

        // Notify server immediately
        sendMessage({
            type: 'capture_complete',
            captureId: captureId,
            imageUrl: 'pic.jpg',
            duration: duration
        });

    } catch (error) {
        log(`❌ Capture failed: ${error.message}`);
        sendMessage({
            type: 'capture_error',
            captureId: captureId,
            error: error.message
        });
    }
}

// Update camera settings
function updateSettings(settings) {
    log(`⚙️ Updating settings: ${JSON.stringify(settings)}`);

    try {
        let current = '1 25 0 -35 0 none 25'.split(' ');

        if (fs.existsSync(CONFIG.SETTINGS_FILE)) {
            current = fs.readFileSync(CONFIG.SETTINGS_FILE, 'utf8').trim().split(/\s+/);
        }

        // Update specific settings
        if (settings.resolution !== undefined) current[0] = settings.resolution;
        if (settings.compression !== undefined) current[1] = settings.compression;
        if (settings.iso !== undefined) current[2] = settings.iso;
        if (settings.saturation !== undefined) current[3] = settings.saturation;
        if (settings.rotation !== undefined) current[4] = settings.rotation;
        if (settings.effect !== undefined) current[5] = settings.effect;
        if (settings.sharpness !== undefined) current[6] = settings.sharpness;

        fs.writeFileSync(CONFIG.SETTINGS_FILE, current.join(' ') + '\n');
        log('✅ Settings updated');

    } catch (error) {
        log(`❌ Settings update failed: ${error.message}`);
    }
}

// Start live stream
function startLiveStream(quality) {
    if (liveStreamActive) return;

    log(`🎥 Starting live stream (${quality})`);
    liveStreamActive = true;

    // Quality presets
    const presets = {
        'very-low': { w: 480, h: 360, q: 8 },
        'low': { w: 640, h: 480, q: 15 },
        'medium': { w: 800, h: 600, q: 24 },
        'high': { w: 1280, h: 720, q: 50 },
        'very-high': { w: 1920, h: 1080, q: 75 }
    };

    const preset = presets[quality] || presets['medium'];

    // Continuous capture loop
    const captureLoop = async () => {
        while (liveStreamActive) {
            try {
                const cmd = `raspistill -w ${preset.w} -h ${preset.h} -q ${preset.q} -t 1 -o ${CONFIG.LIVE_PATH}`;
                await new Promise((resolve, reject) => {
                    exec(cmd, { timeout: 5000 }, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });

                // Upload
                const uploadCmd = `scp -o StrictHostKeyChecking=no ${CONFIG.LIVE_PATH} ${CONFIG.SFTP_USER}@${CONFIG.SFTP_HOST}:${CONFIG.SFTP_PATH}live.jpg`;
                await new Promise((resolve) => {
                    exec(uploadCmd, { timeout: 10000 }, () => resolve());
                });

                // Notify browser immediately
                sendMessage({ type: 'live_frame_ready' });

            } catch (error) {
                log(`Live stream error: ${error.message}`);
            }

            // Small delay between frames
            await new Promise(r => setTimeout(r, 100));
        }
    };

    captureLoop();
    sendMessage({ type: 'live_status', active: true });
}

// Stop live stream
function stopLiveStream() {
    log('🛑 Stopping live stream');
    liveStreamActive = false;
    sendMessage({ type: 'live_status', active: false });
}

// Send message to server
function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Connect to WebSocket server
function connect() {
    log(`🔌 Connecting to ${CONFIG.WS_SERVER}`);

    ws = new WebSocket(CONFIG.WS_SERVER);

    ws.on('open', () => {
        log('✅ Connected to server');
        reconnectDelay = CONFIG.RECONNECT_DELAY;

        // Identify as camera
        sendMessage({ type: 'identify', role: 'camera' });

        // Start status updates
        if (statusInterval) clearInterval(statusInterval);
        statusInterval = setInterval(() => {
            const status = getSystemStatus();
            sendMessage({
                type: 'status_update',
                data: status
            });
        }, CONFIG.STATUS_INTERVAL);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            // Handle commands from server
            switch (message.type) {
                case 'capture':
                    captureImage(message.captureId);
                    break;

                case 'settings_update':
                    updateSettings(message.settings);
                    break;

                case 'live_control':
                    if (message.action === 'start') {
                        startLiveStream(message.quality);
                    } else if (message.action === 'stop') {
                        stopLiveStream();
                    }
                    break;

                default:
                    log(`Unknown message type: ${message.type}`);
            }

        } catch (error) {
            log(`Message parse error: ${error.message}`);
        }
    });

    ws.on('close', () => {
        log('❌ Disconnected from server');
        if (statusInterval) clearInterval(statusInterval);
        scheduleReconnect();
    });

    ws.on('error', (error) => {
        log(`WebSocket error: ${error.message}`);
    });
}

// Reconnect with exponential backoff
function scheduleReconnect() {
    log(`🔄 Reconnecting in ${reconnectDelay / 1000}s...`);

    setTimeout(() => {
        connect();
        reconnectDelay = Math.min(reconnectDelay * 1.5, CONFIG.MAX_RECONNECT_DELAY);
    }, reconnectDelay);
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down...');
    liveStreamActive = false;
    if (statusInterval) clearInterval(statusInterval);
    if (ws) ws.close();
    process.exit(0);
});

// Start
log('🚀 Starting Pi WebSocket Client');
connect();
