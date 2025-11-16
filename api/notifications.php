<?php

declare(strict_types=1);

/**
 * Notification API Endpoint
 *
 * Handles notification triggers and status monitoring for camera
 * connection and disconnection events.
 *
 * @category  API
 * @package   CameraControl
 * @author    Net Storm
 * @license   Proprietary
 * @version   1.0.0
 * @standards PSR-12, OWASP, RESTful
 */

// =============================================================================
// INITIALIZATION
// =============================================================================

require_once __DIR__ . '/../config/app-config.php';
require_once __DIR__ . '/../includes/utilities.php';
require_once __DIR__ . '/../includes/NotificationHelper.php';

// Security headers
sendSecurityHeaders();
sendNoCacheHeaders();
header('Content-Type: application/json; charset=UTF-8');

// =============================================================================
// REQUEST HANDLING
// =============================================================================

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    switch ($action) {
        case 'check_status':
            handleStatusCheck();
            break;

        case 'notify_connect':
            handleConnectNotification();
            break;

        case 'notify_disconnect':
            handleDisconnectNotification();
            break;

        case 'notify_error':
            handleErrorNotification();
            break;

        case 'test':
            handleTestNotification();
            break;

        case 'stats':
            handleGetStatistics();
            break;

        case 'reset':
            handleResetState();
            break;

        default:
            sendJsonResponse(['error' => 'Invalid action'], 400);
    }
} catch (Throwable $e) {
    logMessage("Notification API error: " . $e->getMessage(), 'ERROR');
    sendJsonResponse(['error' => 'Internal server error'], 500);
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

/**
 * Check camera status and send notification if state changed
 */
function handleStatusCheck(): void
{
    $currentStatus = isCameraCurrentlyOnline();
    $previousStatus = getPreviousOnlineStatus();

    $statusChanged = ($currentStatus !== $previousStatus);
    $notificationSent = false;

    if ($statusChanged) {
        if ($currentStatus) {
            // Camera came online
            $notificationSent = sendOnlineNotification();
        } else {
            // Camera went offline
            $notificationSent = sendOfflineNotification();
        }

        // Update previous status
        savePreviousOnlineStatus($currentStatus);
    }

    sendJsonResponse([
        'success' => true,
        'current_status' => $currentStatus ? 'online' : 'offline',
        'previous_status' => $previousStatus ? 'online' : 'offline',
        'status_changed' => $statusChanged,
        'notification_sent' => $notificationSent,
        'timestamp' => date('Y-m-d H:i:s'),
        'camera_id' => CAMERA_ID,
        'camera_name' => CAMERA_DISPLAY_NAME
    ]);
}

/**
 * Manually trigger connect notification
 */
function handleConnectNotification(): void
{
    validateAdminToken();

    $extraData = getStatusExtraData();
    $result = notifyCameraConnected($extraData);

    sendJsonResponse([
        'success' => $result,
        'message' => $result ? 'Connect notification sent' : 'Failed to send notification',
        'camera_id' => CAMERA_ID,
        'camera_name' => CAMERA_DISPLAY_NAME
    ]);
}

/**
 * Manually trigger disconnect notification
 */
function handleDisconnectNotification(): void
{
    validateAdminToken();

    $extraData = [
        'last_seen' => getLastSeenTime(),
        'offline_duration' => getOfflineDuration(),
        'reason' => $_POST['reason'] ?? 'Unknown'
    ];

    $result = notifyCameraDisconnected($extraData);

    sendJsonResponse([
        'success' => $result,
        'message' => $result ? 'Disconnect notification sent' : 'Failed to send notification',
        'camera_id' => CAMERA_ID,
        'camera_name' => CAMERA_DISPLAY_NAME
    ]);
}

/**
 * Send error notification
 */
function handleErrorNotification(): void
{
    validateAdminToken();

    $errorMessage = $_POST['error'] ?? 'Unknown error';

    $extraData = [
        'file' => $_POST['file'] ?? '',
        'line' => $_POST['line'] ?? ''
    ];

    $result = notifyCameraError($errorMessage, $extraData);

    sendJsonResponse([
        'success' => $result,
        'message' => $result ? 'Error notification sent' : 'Failed to send notification'
    ]);
}

/**
 * Send test notification
 */
function handleTestNotification(): void
{
    validateAdminToken();

    $helper = createNotificationHelper();
    $result = $helper->sendTestNotification();

    sendJsonResponse([
        'success' => $result,
        'message' => $result ? 'Test notification sent successfully' : 'Failed to send test notification',
        'configured' => [
            'bot_token' => !empty(TELEGRAM_BOT_TOKEN) ? 'Set' : 'Not configured',
            'chat_id' => !empty(TELEGRAM_CHAT_ID) ? 'Set' : 'Not configured',
            'enabled' => NOTIFICATIONS_ENABLED
        ]
    ]);
}

/**
 * Get notification statistics
 */
function handleGetStatistics(): void
{
    $helper = createNotificationHelper();
    $stats = $helper->getStatistics();

    sendJsonResponse([
        'success' => true,
        'statistics' => $stats,
        'camera_id' => CAMERA_ID,
        'camera_name' => CAMERA_DISPLAY_NAME
    ]);
}

/**
 * Reset notification state
 */
function handleResetState(): void
{
    validateAdminToken();

    $helper = createNotificationHelper();
    $result = $helper->resetState();

    sendJsonResponse([
        'success' => $result,
        'message' => $result ? 'Notification state reset' : 'Failed to reset state'
    ]);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if camera is currently online
 *
 * @return bool True if online
 */
function isCameraCurrentlyOnline(): bool
{
    if (!file_exists(CAMERA_STATUS_FILE)) {
        return false;
    }

    $lastModified = filemtime(CAMERA_STATUS_FILE);
    if ($lastModified === false) {
        return false;
    }

    $secondsSinceUpdate = time() - $lastModified;
    return $secondsSinceUpdate <= CAMERA_ONLINE_TIMEOUT_SECONDS;
}

/**
 * Get previous online status from state file
 *
 * @return bool Previous status
 */
function getPreviousOnlineStatus(): bool
{
    $stateFile = TMP_DIR . '/previous_online_status.tmp';

    if (!file_exists($stateFile)) {
        return false;
    }

    $content = readFileSecure($stateFile, 'false');
    return $content === 'true';
}

/**
 * Save current online status to state file
 *
 * @param bool $status Current status
 * @return void
 */
function savePreviousOnlineStatus(bool $status): void
{
    $stateFile = TMP_DIR . '/previous_online_status.tmp';
    writeFileAtomic($stateFile, $status ? 'true' : 'false');
}

/**
 * Get extra data from camera status for notifications
 *
 * @return array Extra data
 */
function getStatusExtraData(): array
{
    $statusData = readFileSecure(CAMERA_STATUS_FILE, '');
    $parts = explode(',', $statusData);

    $extraData = [];

    if (isset($parts[0]) && $parts[0] !== 'N/A') {
        $extraData['memory'] = $parts[0];
    }

    if (isset($parts[1]) && $parts[1] !== 'N/A') {
        $extraData['temperature'] = $parts[1];
    }

    if (isset($parts[3]) && $parts[3] !== 'N/A') {
        $extraData['signal'] = $parts[3];
    }

    // Try to get IP address
    $ipFile = TMP_DIR . '/ip.tmp';
    if (file_exists($ipFile)) {
        $ip = readFileSecure($ipFile, '');
        if (!empty($ip)) {
            $extraData['ip'] = $ip;
        }
    }

    // Try to get uptime from system_info
    if (file_exists(SYSTEM_INFO_FILE)) {
        $systemInfo = readFileSecure(SYSTEM_INFO_FILE, '');
        if (preg_match('/uptime=([^|]+)/', $systemInfo, $matches)) {
            $extraData['uptime'] = trim($matches[1]);
        }
    }

    return $extraData;
}

/**
 * Get last seen time
 *
 * @return string Formatted time
 */
function getLastSeenTime(): string
{
    if (!file_exists(CAMERA_STATUS_FILE)) {
        return 'Unknown';
    }

    $timestamp = filemtime(CAMERA_STATUS_FILE);
    if ($timestamp === false) {
        return 'Unknown';
    }

    return date('Y-m-d H:i:s', $timestamp);
}

/**
 * Get offline duration
 *
 * @return string Formatted duration
 */
function getOfflineDuration(): string
{
    if (!file_exists(CAMERA_STATUS_FILE)) {
        return 'Unknown';
    }

    $timestamp = filemtime(CAMERA_STATUS_FILE);
    if ($timestamp === false) {
        return 'Unknown';
    }

    $seconds = time() - $timestamp;

    if ($seconds < 60) {
        return "{$seconds} seconds";
    }

    $minutes = floor($seconds / 60);
    if ($minutes < 60) {
        return "{$minutes} minutes";
    }

    $hours = floor($minutes / 60);
    $remainingMinutes = $minutes % 60;

    if ($hours < 24) {
        return "{$hours}h {$remainingMinutes}m";
    }

    $days = floor($hours / 24);
    $remainingHours = $hours % 24;

    return "{$days}d {$remainingHours}h";
}

/**
 * Send online notification with camera data
 *
 * @return bool Success status
 */
function sendOnlineNotification(): bool
{
    $extraData = getStatusExtraData();
    return notifyCameraConnected($extraData);
}

/**
 * Send offline notification with camera data
 *
 * @return bool Success status
 */
function sendOfflineNotification(): bool
{
    $extraData = [
        'last_seen' => getLastSeenTime(),
        'offline_duration' => getOfflineDuration()
    ];

    // Get last known temperature
    $statusData = readFileSecure(CAMERA_STATUS_FILE, '');
    $parts = explode(',', $statusData);
    if (isset($parts[1]) && $parts[1] !== 'N/A') {
        $extraData['last_temperature'] = $parts[1];
    }

    return notifyCameraDisconnected($extraData);
}

/**
 * Send JSON response
 *
 * @param array $data       Response data
 * @param int   $statusCode HTTP status code
 * @return void
 */
function sendJsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}
