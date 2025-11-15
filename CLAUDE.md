# CLAUDE.md - Camera Control System Documentation

## Project Overview

**cam1-v2** is an enterprise-grade, headless camera management and monitoring system designed for remote Raspberry Pi camera control. The system provides real-time streaming, image capture, status monitoring, and tunnel management through a web-based interface.

**Version:** 2.0.0
**Primary Language:** PHP 8.0+ (Backend), JavaScript/jQuery (Frontend)
**Target Platform:** Raspberry Pi (headless) + Web Server
**Author:** Net Storm
**License:** Proprietary

### Key Features

- **Live Video Streaming** - Real-time camera feed with quality presets
- **Remote Image Capture** - High-resolution image capture with conflict prevention
- **Status Monitoring** - Real-time system stats (temperature, memory, network, disk)
- **Tunnel Management** - Multi-server SSH tunnel support (cloudflared, ngrok, etc.)
- **Network Monitoring** - Continuous connectivity monitoring with automatic recovery
- **Remote Administration** - Reboot, shutdown, and cleanup operations
- **Plugin System** - Extensible architecture for custom functionality
- **Security** - CSRF protection, input validation, atomic file operations

---

## Technology Stack

### Backend
- **PHP 8.0+** with strict typing (`declare(strict_types=1)`)
- **Bash Scripts** for system operations and camera control
- **raspistill** for Raspberry Pi camera interface

### Frontend
- **HTML5** with responsive design
- **CSS3** with glassmorphism UI effects
- **JavaScript (ES5+)** with jQuery 3.7.1
- **AJAX** for real-time updates

### Infrastructure
- **Cloudflared** for secure tunneling
- **SSH/SFTP** for remote access
- **File-based state management** (no database required)

---

## Codebase Structure

```
cam1-v2/
├── admin/                     # Administrative endpoints
│   ├── clear.php             # File cleanup operations
│   ├── clean.php             # Targeted cleanup
│   ├── reboot.php            # System reboot
│   └── shutdown.php          # System shutdown
│
├── assets/                    # Static resources
│   ├── css/
│   │   ├── file.css          # Main stylesheet
│   │   └── file.min.css      # Minified version (SPEED_MODE)
│   ├── js/
│   │   ├── camera-control.js           # Main controller (jQuery)
│   │   ├── camera-control-vanilla.js   # Vanilla JS alternative
│   │   ├── jquery-3.7.1.min.js
│   │   └── *.min.js          # Minified versions
│   ├── images/               # UI assets, icons
│   └── videos/               # Background video (if not SPEED_MODE)
│
├── config/                    # Configuration files
│   └── app-config.php        # Main configuration (constants, paths, settings)
│
├── downloads/                 # File downloads directory
│   └── index.html
│
├── includes/                  # Shared modules
│   ├── utilities.php         # Helper functions (validation, I/O, logging)
│   ├── SSHHelper.php         # SSH connection utilities
│   └── plugins/              # Plugin system
│       ├── manifest.json     # Plugin registry
│       ├── plugins-loader.php # Dynamic plugin loader
│       ├── php/              # PHP plugins
│       ├── scripts/          # Script plugins
│       └── others/           # Other plugin types
│
├── log/                       # Application logs
│   ├── log.txt               # Main application log
│   ├── ping.txt              # Network monitoring log
│   ├── combined.log          # Combined logs
│   ├── sync.log              # File sync operations
│   ├── tunel*.log            # Tunnel logs
│   └── php_errors.log        # PHP error log
│
├── script/                    # Bash scripts for Raspberry Pi
│   ├── shmain_               # Main camera control loop
│   ├── shboot_               # Boot initialization
│   ├── shmonitor_            # Monitoring daemon
│   ├── shlive_               # Live streaming handler
│   ├── shtunel*_             # Tunnel management (1-4)
│   ├── shsync_               # File synchronization
│   ├── shcleanup_            # Cleanup operations
│   ├── pemcert_              # SSL certificate
│   └── ymlconfig_            # YAML configuration
│
├── tmp/                       # Runtime state files
│   ├── var.tmp               # Camera settings (resolution, compression, etc.)
│   ├── onoff.tmp             # Capture trigger flag
│   ├── status.tmp            # Camera status (memory, temp, ping, signal)
│   ├── monitor.tmp           # Monitor state (on/off)
│   ├── web_live.tmp          # Live stream state
│   ├── web_live_quality.tmp  # Stream quality settings
│   ├── url*.tmp              # Tunnel URLs (1-4)
│   ├── ssh2.tmp              # SSH connection info
│   ├── system_info.tmp       # System information
│   ├── batmon/               # Battery monitoring data
│   └── netmon/               # Network monitoring data
│
├── web/                       # Additional web resources
│   ├── pinch-zoom.js         # Mobile zoom functionality
│   └── file_mon.css          # Monitoring styles
│
├── index.php                  # Main web interface
├── index2-no-jquery.php       # Vanilla JS version
├── mode.php                   # Camera status display module
├── ping.php                   # Network status monitor
├── log.php                    # Log viewer
├── storage.php                # Unified storage API
├── buffer.jpg                 # Image buffer
└── *.jpg                      # Image files (pic.jpg, live.jpg, test.jpg)
```

---

## Architecture & Design Patterns

### File Naming Convention (Security Feature)

The system uses a dual naming convention for security:

- **Web files:** No extension (e.g., `shboot_`, `shmain_`) - Prevents direct execution via web browser
- **Camera files:** With extension (e.g., `boot.sh`, `main.sh`) - Enables execution on Raspberry Pi

Example: `script/shboot_` (website) → `boot.sh` (deployed to camera)

### State Management

All application state is stored in **flat files** in the `tmp/` directory:

- **No database required** - Simplifies deployment
- **Atomic operations** - Uses temp files + rename for consistency
- **File locking** - Prevents race conditions
- **Default values** - Graceful degradation when files are missing

### Request Flow

```
User Browser
    ↓
index.php (Main Interface)
    ↓
├─→ mode.php (Status Display - included dynamically)
├─→ AJAX Endpoints (Write requests, image checks)
└─→ assets/js/camera-control.js (Client-side logic)
        ↓
    HTTP/AJAX Requests
        ↓
    ├─→ storage.php (File operations)
    ├─→ admin/*.php (Admin operations)
    └─→ Raspberry Pi Scripts (via file triggers)
            ↓
        raspistill (Camera capture)
            ↓
        SFTP Sync back to server
```

### Plugin System

Plugins are autonomously loaded via `includes/plugins/plugins-loader.php`:

- **Manifest-driven** - Defined in `manifest.json`
- **Sandboxed** - Plugins cannot break core functionality
- **Type-based** - Supports PHP, Bash, HTML, and other types
- **Safe to delete** - No impact on core system

---

## Key Components

### 1. Main Interface (`index.php`)

**Purpose:** Primary user interface for camera control

**Features:**
- Camera settings form (resolution, compression, FPS, effects)
- Live streaming toggle with quality presets
- Capture button with conflict prevention
- Dynamic status display (via `mode.php`)
- Admin buttons (reboot, shutdown, cleanup)

**Security:**
- Session-based admin token (CSRF protection)
- Input validation via whitelists
- HTML escaping for all output
- No-cache headers

**Key Functions:**
- Settings update handler
- AJAX write handler for live control
- Capture trigger (direct file write)
- Plugin loader integration

### 2. Status Module (`mode.php`)

**Purpose:** Real-time camera and system status display

**Features:**
- Online/offline detection (timeout-based)
- System information (temp, memory, latency, signal)
- Server/tunnel access buttons
- Latest log entry display
- Control panel visibility management

**Data Sources:**
- `tmp/status.tmp` - Camera status data
- `tmp/url*.tmp` - Tunnel URLs
- `log/log.txt` - Latest log entries

### 3. Network Monitor (`ping.php`)

**Purpose:** Network connectivity and system health monitoring

**Features:**
- Real-time network status display
- System metrics (uptime, CPU load, disk usage)
- Log viewing with color-coded status
- Auto-refresh with adaptive intervals
- Download log functionality

**Display Modes:**
- System stats card (memory, temperature, load, disk, uptime)
- Scrollable log container
- Line count selector (50-1000 entries)

### 4. Storage API (`storage.php`)

**Purpose:** Unified endpoint for file operations

**Operations:**
- **Write:** Text/data file writing with validation
- **Upload:** Image file uploads with size limits

**Security:**
- Whitelist-based path validation
- Directory traversal prevention
- MIME type checking (uploads)
- Atomic writes with file locking

**Allowed Paths:**
- `tmp/*.tmp` files
- Image files (`*.jpg`)
- Log files (append-only)

### 5. Camera Control Scripts (`script/`)

**Main Script (`shmain_`):**
- Infinite loop camera operation
- Image capture with quality settings
- Network monitoring
- Auto-upload via SFTP
- Error recovery

**Monitor Script (`shmonitor_`):**
- System stats collection
- Status file updates
- Heartbeat mechanism

**Tunnel Scripts (`shtunel*_`):**
- Cloudflared tunnel management
- URL extraction and upload
- Auto-restart on failure

**Live Stream Script (`shlive_`):**
- Real-time JPEG streaming
- Quality adjustment
- Session management

### 6. Frontend Controller (`camera-control.js`)

**State Management:**
- Live stream state
- Session heartbeat
- Capture lock (prevents conflicts)
- Offline detection and recovery

**Key Functions:**
- `toggleWebLive()` - Start/stop live streaming
- `captureImage()` - Trigger image capture
- `updateStatus()` - Poll camera status
- `updateWebLive()` - Update live image
- `handleOfflineState()` - Offline recovery

**Configuration:**
```javascript
CONFIG = {
    STATUS_UPDATE_INTERVAL: 2000,     // Status polling
    LIVE_UPDATE_INTERVAL: 1500,       // Live stream refresh
    CAPTURE_CHECK_FAST: 25,           // Fast capture polling
    OFFLINE_THRESHOLD: 7,             // Seconds before offline
}
```

---

## Development Workflows

### Common Tasks for AI Assistants

#### 1. Adding a New Configuration Option

**Steps:**
1. Add constant to `config/app-config.php`
2. Add validation rule to `VALIDATION_RULES` array
3. Update form in `index.php` (add `<select>` or `<input>`)
4. Update sanitization in form handler
5. Update bash script to read new setting

**Example:**
```php
// config/app-config.php
define('NEW_SETTING_FILE', TMP_DIR . '/new_setting.tmp');

// In VALIDATION_RULES
'new_setting' => [
    'min' => 0,
    'max' => 100,
    'default' => 50
]
```

#### 2. Adding a New Status Field

**Steps:**
1. Update `script/shmonitor_` to collect data
2. Modify `tmp/status.tmp` format (comma-separated)
3. Update `mode.php` to parse and display
4. Add display element in HTML section

**Format:** `status.tmp` = `memory,temp,ping,signal,new_field`

#### 3. Creating a New Plugin

**Steps:**
1. Create plugin file in `includes/plugins/{type}/`
2. Update `manifest.json`:
```json
{
    "name": "my-plugin",
    "type": "php",
    "file": "php/my-plugin.php",
    "enabled": true,
    "priority": 10
}
```
3. Plugin file structure:
```php
<?php
// Check if loaded as part of main app
if (!isset($GLOBALS['_app_included'])) {
    exit('Direct access not allowed');
}

// Plugin code here
echo '<div class="plugin-container">...</div>';
?>
```

#### 4. Adding a New AJAX Endpoint

**Steps:**
1. Add handler in `index.php` or create new PHP file
2. Add security validation:
```php
if (isset($_GET['my_action'])) {
    sendAjaxHeaders('application/json');
    validateAdminToken(); // If admin-only

    // Process request
    $result = doSomething();

    echo json_encode(['status' => 'ok', 'data' => $result]);
    exit;
}
```
3. Add JavaScript client in `camera-control.js`:
```javascript
function callMyAction() {
    $.ajax({
        url: 'index.php?my_action=1',
        success: function(response) {
            console.log(response);
        }
    });
}
```

#### 5. Modifying Camera Settings

**Format of `tmp/var.tmp`:**
```
resolution compression iso saturation rotation effect sharpness
1 25 0 -35 0 none 25
```

**Mapping:**
- `resolution`: 1-4 (1280x960 to 3200x2400)
- `compression`: 5-25 (lower = higher quality)
- `iso`: 0, 33333, 16666, 8333, 4166, 2083, 1042 (FPS)
- `saturation`: -35 (color), -100 (grayscale)
- `rotation`: 0, 90, 180, 270
- `effect`: none, negative
- `sharpness`: 25, 75, 100

---

## File I/O Conventions

### Reading Files

**Always use:** `readFileSecure($filePath, $defaultValue)`

**Benefits:**
- Automatic validation
- Default value fallback
- Size limit checking (1MB max)
- Automatic trimming
- Error logging

**Example:**
```php
$status = readFileSecure(CAMERA_STATUS_FILE, 'N/A,N/A,N/A,N/A');
$parts = explode(',', $status);
```

### Writing Files

**Always use:** `writeFileAtomic($filePath, $data, $append = false)`

**Benefits:**
- Atomic operation (temp file + rename)
- File locking (prevents race conditions)
- Automatic directory creation
- Error logging
- Safe for concurrent access

**Example:**
```php
if (!writeFileAtomic(WEB_LIVE_STATUS_FILE, 'on')) {
    http_response_code(500);
    exit('Write failed');
}
```

### Input Validation

**For integers:**
```php
$value = sanitizeInteger($_POST['value'] ?? 0, $min, $max, $default);
```

**For strings (whitelist):**
```php
$value = sanitizeStringWhitelist($_POST['value'] ?? '', ['on', 'off'], 'off');
```

**For URLs:**
```php
$url = validateUrl($_POST['url'] ?? '');
if ($url === false) {
    // Invalid URL
}
```

### Output Escaping

**Always escape HTML:**
```php
echo escapeHtml($userInput);
```

**Never use:**
```php
echo $_GET['param']; // XSS vulnerability!
```

---

## Security Considerations

### OWASP Top 10 Compliance

1. **Injection** - Parameterized validation, no SQL (file-based)
2. **Broken Authentication** - Session-based tokens, no passwords exposed
3. **Sensitive Data Exposure** - Logs don't contain credentials
4. **XML External Entities** - Not applicable (no XML parsing)
5. **Broken Access Control** - Admin token validation, whitelist-based paths
6. **Security Misconfiguration** - Error display off, secure headers sent
7. **XSS** - All output escaped via `escapeHtml()`
8. **Insecure Deserialization** - No serialization used
9. **Using Components with Known Vulnerabilities** - jQuery 3.7.1 (recent)
10. **Insufficient Logging** - Comprehensive logging via `logMessage()`

### Admin Token System

**Generation:**
```php
session_start();
if (!isset($_SESSION['admin_token'])) {
    $_SESSION['admin_token'] = bin2hex(random_bytes(32));
}
```

**Validation:**
```php
validateAdminToken(); // In admin endpoints
```

**Usage:**
```javascript
// JavaScript passes token via URL
url: 'admin/reboot.php?token=' + window.ADMIN_TOKEN
```

### File Access Control

**Whitelisting:**
```php
$allowed = [
    'tmp/web_live.tmp',
    'tmp/status.tmp',
    // ...
];

if (!in_array($file, $allowed, true)) {
    http_response_code(403);
    exit('Forbidden');
}
```

### Security Headers

Automatically sent via `sendSecurityHeaders()`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## Coding Standards

### PHP Standards

**PSR-12 Compliance:**
- Strict typing: `declare(strict_types=1);`
- Type hints for all parameters and return values
- Camel case for functions: `readFileSecure()`
- Constants in UPPER_CASE: `CAMERA_STATUS_FILE`
- Braces on same line (control structures)

**Documentation:**
```php
/**
 * Brief description
 *
 * Detailed explanation if needed
 *
 * @param string $param Parameter description
 * @return bool Return value description
 */
function myFunction(string $param): bool
{
    // Implementation
}
```

### JavaScript Standards

**ES5+ with jQuery:**
- Strict mode: `'use strict';`
- IIFE pattern: `(function($, window, document) { ... })(jQuery, window, document);`
- Constants in UPPER_CASE: `CONFIG.STATUS_UPDATE_INTERVAL`
- Camel case for variables: `isLiveActive`
- JSDoc comments for functions

**Example:**
```javascript
/**
 * Toggle live streaming state
 * @returns {void}
 */
function toggleWebLive() {
    // Implementation
}
```

### Bash Standards

**Shell Script Conventions:**
- Shebang: `#!/usr/bin/env bash`
- Strict mode: `set -euo pipefail`
- IFS protection: `IFS=$'\n\t'`
- Readonly constants: `readonly DEVICE_ID="${DEVICE_ID:-cam1}"`
- Cleanup trap: `trap 'cleanup $?' EXIT INT TERM`
- Functions before usage

**Error Handling:**
```bash
if ! command; then
    log_message "[ FAIL ] Command failed"
    return 1
fi
```

---

## Testing & Debugging

### Testing Approach

**No automated tests currently** - Manual testing workflow:

1. **Local Testing:**
   - Test PHP files via web server (Apache/Nginx)
   - Verify file operations in `tmp/` directory
   - Check logs in `log/` directory

2. **Integration Testing:**
   - Test with actual Raspberry Pi camera
   - Verify SFTP sync operations
   - Test tunnel connections

3. **Frontend Testing:**
   - Test in Chrome, Firefox, Safari
   - Test on mobile devices (iOS/Android)
   - Verify AJAX endpoints with browser dev tools

### Debugging Tools

**PHP Errors:**
- Check `log/php_errors.log`
- Enable display errors temporarily:
```php
ini_set('display_errors', '1');
error_reporting(E_ALL);
```

**JavaScript Errors:**
- Browser console (F12)
- Network tab for AJAX requests

**Application Logs:**
- `log/log.txt` - Main application events
- `log/ping.txt` - Network monitoring
- `log/combined.log` - All system logs

**Custom Logging:**
```php
logMessage("Debug info: $variable", 'DEBUG');
```

**Bash Script Debugging:**
```bash
set -x  # Enable trace mode
# ... code to debug ...
set +x  # Disable trace mode
```

---

## Deployment

### Deployment Architecture

```
Web Server (netstorm.site)
    ├── cam1/ (this repository)
    └── cam2/ (optional additional cameras)

Raspberry Pi (Headless)
    ├── Scripts from script/ directory
    ├── Cloudflared tunnel
    ├── raspistill for camera
    └── SFTP sync to web server
```

### Deployment Steps

1. **Web Server Setup:**
```bash
# Clone repository
git clone <repo> /var/www/netstorm.site/cam1

# Set permissions
chmod 755 cam1/
chmod 777 cam1/tmp/ cam1/log/
chmod 644 cam1/*.php
```

2. **Raspberry Pi Setup:**
```bash
# Copy scripts from script/ to ~/cam/
cp script/sh* ~/cam/

# Add .sh extension
for f in ~/cam/sh*_; do
    mv "$f" "${f%_}.sh"
done

# Make executable
chmod +x ~/cam/*.sh

# Add to crontab
@reboot /home/pi/cam/boot.sh
```

3. **Configuration:**
- Update `CAMERA_BASE_URL` in `config/app-config.php`
- Update `BASE_URL` in bash scripts
- Configure cloudflared tunnel
- Set up SFTP credentials

### Environment Variables

**PHP (set in app-config.php):**
- `CAMERA_ID` - Unique camera identifier
- `CAMERA_DISPLAY_NAME` - Display name in UI
- `CAMERA_BASE_URL` - Base URL for remote access
- `SPEED_MODE` - Performance mode (true/false)

**Bash (set in scripts):**
- `DEVICE_ID` - Same as CAMERA_ID
- `BASE_URL` - Same as CAMERA_BASE_URL
- `SFTP_*` - SFTP connection details (in actual scripts)

---

## Common Pitfalls & Solutions

### 1. File Permissions

**Problem:** `tmp/` or `log/` files not writable

**Solution:**
```bash
chmod 777 tmp/ log/
# Or more secure:
chown www-data:www-data tmp/ log/
chmod 775 tmp/ log/
```

### 2. AJAX Requests Failing

**Problem:** CORS or CSRF blocking requests

**Solution:**
- Ensure requests are same-origin
- Check admin token is passed correctly
- Verify security headers not blocking

### 3. Live Streaming Not Working

**Problem:** Images not updating

**Solution:**
- Check `tmp/web_live.tmp` is 'on'
- Verify `script/shlive_` is running on Pi
- Check SFTP sync is working
- Verify `live.jpg` is being created

### 4. Camera Offline

**Problem:** Status shows "Disconnected (Offline)"

**Solution:**
- Check `tmp/status.tmp` exists and is recent (<7 seconds)
- Verify `script/shmonitor_` is running on Pi
- Check network connectivity
- Review `log/ping.txt` for network issues

### 5. Settings Not Applying

**Problem:** Camera settings changes not taking effect

**Solution:**
- Check `tmp/var.tmp` was written correctly
- Verify `tmp/libre.tmp` was deleted (triggers reload)
- Check `script/shmain_` detected change
- Review `log/log.txt` for errors

---

## Advanced Topics

### Performance Optimization

**SPEED_MODE:**
Set `define('SPEED_MODE', true);` in `config/app-config.php` for:
- Static background image (no video)
- Minified CSS/JS assets
- Faster page loads

**Image Compression:**
- Lower compression values = better quality but larger files
- Recommended: 10-20 for remote viewing

**Live Stream Quality:**
Adjust presets in `camera-control.js`:
```javascript
const QUALITY_PRESETS = {
    'very-low': [480, 360, 8],   // Slow connections
    'medium': [800, 600, 24],     // Recommended
};
```

### Scaling to Multiple Cameras

**Multi-camera setup:**
1. Clone repository to different directories:
   - `/var/www/netstorm.site/cam1/`
   - `/var/www/netstorm.site/cam2/`

2. Update `CAMERA_ID` and `CAMERA_BASE_URL` for each

3. Each camera has independent state in `tmp/`

4. Optional: Create master dashboard to view all cameras

### Custom Tunnel Providers

**Adding a new tunnel (e.g., ngrok):**

1. Create `script/shtunel5_`:
```bash
#!/usr/bin/env bash
# Start ngrok
ngrok http 80 > /tmp/ngrok.log 2>&1 &

# Extract URL
sleep 5
URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*')

# Upload to web server
echo "$URL" > /tmp/url5.tmp
```

2. Add to `TUNNEL_URL_FILES` in `config/app-config.php`:
```php
define('TUNNEL_URL_FILES', [
    TMP_DIR . '/url.tmp',
    // ...
    TMP_DIR . '/url5.tmp'  // New tunnel
]);
```

3. Update `mode.php` to display Server 5 button

---

## Git Workflow

### Branch Strategy

**Main Branch:** `main` (or master)
**Feature Branches:** `claude/claude-md-*` (current session branches)

### Commit Guidelines

**Format:**
```
<type>: <subject>

<body (optional)>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: Add battery monitoring plugin

fix: Resolve live stream memory leak in camera-control.js

docs: Update CLAUDE.md with deployment instructions
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push to remote: `git push -u origin feature/my-feature`
4. Create pull request
5. Request review
6. Merge after approval

---

## API Reference

### File-Based API

#### Status File Format

**`tmp/status.tmp`:**
```
transmitted_data,temperature,latency,signal_quality
1.2GB,45.3C,12ms,Excellent
```

**`tmp/system_info.tmp`** (new format):
```
uptime=up 3 days|load=0.12 0.14 0.09|disk=24%|temp=42.3C|mem=512/925MB
```

#### Control Files

**`tmp/web_live.tmp`:**
- Values: `on` | `off`
- Controls live streaming state

**`tmp/web_live_quality.tmp`:**
- Format: `width height quality`
- Example: `800 600 24`

**`tmp/onoff.tmp`:**
- Values: `on` | `off`
- Triggers image capture when set to `on`

**`tmp/monitor.tmp`:**
- Values: `on` | `off`
- External monitor state

**`tmp/var.tmp`:**
- Format: `res comp iso sat rot fx sharp`
- Example: `1 25 0 -35 0 none 25`

### HTTP Endpoints

#### POST /index.php (Write Action)
```
POST /index.php
Content-Type: application/x-www-form-urlencoded

action=write&file=tmp/web_live.tmp&data=on
```

**Response:** `OK` or error message

#### POST /storage.php (Upload)
```
POST /storage.php
Content-Type: multipart/form-data

upfile=<image file>
```

**Response:** `OK` or error message

#### GET /ping.php
```
GET /ping.php?lines=200
```

**Response:** HTML page with network status

#### GET /log.php
```
GET /log.php?file=log.txt&lines=100
```

**Response:** HTML page with log viewer

---

## Troubleshooting Guide

### Issue: "Forbidden file access attempt"

**Cause:** Attempted to write to non-whitelisted file

**Solution:** Add file path to `$allowed` array in `index.php` or `storage.php`

### Issue: "Write operation failed"

**Cause:** Insufficient permissions or disk space

**Solution:**
```bash
# Check permissions
ls -la tmp/

# Check disk space
df -h

# Fix permissions
chmod 777 tmp/
```

### Issue: JavaScript console shows CORS errors

**Cause:** Cross-origin request blocking

**Solution:** Ensure all AJAX requests are to same domain, verify server CORS headers

### Issue: Images not syncing from Pi

**Cause:** SFTP credentials or connectivity issue

**Solution:**
- Test SFTP manually: `sftp user@netstorm.site`
- Check credentials in bash scripts
- Review sync logs: `log/sync.log`

### Issue: High CPU usage

**Cause:** Too frequent polling or live streaming

**Solution:**
- Increase `CONFIG.LIVE_UPDATE_INTERVAL` in `camera-control.js`
- Enable `SPEED_MODE` in `config/app-config.php`
- Reduce live stream quality

---

## Resources & References

### Documentation
- [Raspberry Pi Camera Documentation](https://www.raspberrypi.com/documentation/accessories/camera.html)
- [Cloudflared Tunnel Guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [jQuery 3.7 Documentation](https://api.jquery.com/)

### Standards
- [PSR-12: Extended Coding Style](https://www.php-fig.org/psr/psr-12/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Clean Code Principles](https://github.com/ryanmcdermott/clean-code-javascript)

### Tools
- [PHP CodeSniffer](https://github.com/squizlabs/PHP_CodeSniffer) - PSR-12 validation
- [JSHint](https://jshint.com/) - JavaScript linting
- [ShellCheck](https://www.shellcheck.net/) - Bash script analysis

---

## Changelog

### Version 2.0.0 (Current)
- Enterprise-grade refactoring
- Plugin system implementation
- Security hardening (OWASP compliance)
- Atomic file operations
- Real-time status monitoring
- Multi-tunnel support

### Version 1.x (Legacy)
- Basic camera control
- Single tunnel support
- jQuery-based UI

---

## Support & Contact

**Repository:** cam1-v2
**Maintainer:** Net Storm
**Issues:** Check logs in `log/` directory
**Contributing:** Follow PSR-12 and clean code standards

---

## License

Proprietary - All rights reserved

---

**Last Updated:** 2025-11-15
**Document Version:** 1.0.0
**For Claude Code and AI Assistant Use**
