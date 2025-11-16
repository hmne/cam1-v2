<?php

declare(strict_types=1);

/**
 * Notification Helper - Camera Status Alerts
 *
 * Sends notifications for camera connection and disconnection events
 * via Telegram Bot API. Includes cooldown management and state tracking.
 *
 * @category  Notifications
 * @package   CameraControl
 * @author    Net Storm
 * @license   Proprietary
 * @version   1.0.0
 * @standards PSR-12, Clean Code
 */

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

class NotificationType
{
    public const CONNECT = 'connect';
    public const DISCONNECT = 'disconnect';
    public const ERROR = 'error';
    public const WARNING = 'warning';
    public const INFO = 'info';
}

// =============================================================================
// MAIN NOTIFICATION CLASS
// =============================================================================

class NotificationHelper
{
    private string $botToken;
    private string $chatId;
    private string $cameraId;
    private string $cameraName;
    private string $stateFile;
    private int $cooldownSeconds;
    private bool $enabled;

    /**
     * Constructor
     *
     * @param string $botToken       Telegram bot token
     * @param string $chatId         Telegram chat ID
     * @param string $cameraId       Camera identifier (e.g., 'cam1')
     * @param string $cameraName     Camera display name (e.g., 'N.S-Cam1')
     * @param string $stateFile      Path to state file
     * @param int    $cooldownSeconds Cooldown between notifications
     * @param bool   $enabled        Enable/disable notifications
     */
    public function __construct(
        string $botToken = '',
        string $chatId = '',
        string $cameraId = 'cam1',
        string $cameraName = 'Camera',
        string $stateFile = '',
        int $cooldownSeconds = 300,
        bool $enabled = true
    ) {
        $this->botToken = $botToken;
        $this->chatId = $chatId;
        $this->cameraId = $cameraId;
        $this->cameraName = $cameraName;
        $this->stateFile = $stateFile;
        $this->cooldownSeconds = $cooldownSeconds;
        $this->enabled = $enabled;
    }

    /**
     * Send camera connected notification
     *
     * @param array $extraData Additional data to include
     * @return bool True on success, false on failure
     */
    public function sendConnectNotification(array $extraData = []): bool
    {
        if (!$this->enabled || !NOTIFY_ON_CONNECT) {
            return false;
        }

        if (!$this->canSendNotification(NotificationType::CONNECT)) {
            return false;
        }

        $emoji = '🟢';
        $title = "Camera Connected";
        $message = $this->buildConnectMessage($extraData);

        $result = $this->sendTelegramMessage($emoji, $title, $message);

        if ($result) {
            $this->updateNotificationState(NotificationType::CONNECT);
            $this->logNotification(NotificationType::CONNECT, 'SUCCESS');
        }

        return $result;
    }

    /**
     * Send camera disconnected notification
     *
     * @param array $extraData Additional data to include
     * @return bool True on success, false on failure
     */
    public function sendDisconnectNotification(array $extraData = []): bool
    {
        if (!$this->enabled || !NOTIFY_ON_DISCONNECT) {
            return false;
        }

        if (!$this->canSendNotification(NotificationType::DISCONNECT)) {
            return false;
        }

        $emoji = '🔴';
        $title = "Camera Disconnected";
        $message = $this->buildDisconnectMessage($extraData);

        $result = $this->sendTelegramMessage($emoji, $title, $message);

        if ($result) {
            $this->updateNotificationState(NotificationType::DISCONNECT);
            $this->logNotification(NotificationType::DISCONNECT, 'SUCCESS');
        }

        return $result;
    }

    /**
     * Send error notification
     *
     * @param string $errorMessage Error description
     * @param array  $extraData    Additional data
     * @return bool True on success, false on failure
     */
    public function sendErrorNotification(string $errorMessage, array $extraData = []): bool
    {
        if (!$this->enabled || !NOTIFY_ON_ERROR) {
            return false;
        }

        if (!$this->canSendNotification(NotificationType::ERROR)) {
            return false;
        }

        $emoji = '⚠️';
        $title = "Camera Error";
        $message = $this->buildErrorMessage($errorMessage, $extraData);

        $result = $this->sendTelegramMessage($emoji, $title, $message);

        if ($result) {
            $this->updateNotificationState(NotificationType::ERROR);
            $this->logNotification(NotificationType::ERROR, 'SUCCESS', $errorMessage);
        }

        return $result;
    }

    /**
     * Build connect notification message
     *
     * @param array $extraData Additional data
     * @return string Formatted message
     */
    private function buildConnectMessage(array $extraData = []): string
    {
        $timestamp = date('Y-m-d H:i:s');
        $timezone = date('T');

        $message = "Camera <b>{$this->cameraName}</b> (ID: <code>{$this->cameraId}</code>) is now <b>ONLINE</b>\n\n";
        $message .= "📅 Time: <code>{$timestamp} {$timezone}</code>\n";

        if (!empty($extraData['ip'])) {
            $message .= "🌐 IP: <code>{$extraData['ip']}</code>\n";
        }

        if (!empty($extraData['temperature'])) {
            $message .= "🌡️ Temperature: <code>{$extraData['temperature']}</code>\n";
        }

        if (!empty($extraData['memory'])) {
            $message .= "💾 Memory: <code>{$extraData['memory']}</code>\n";
        }

        if (!empty($extraData['signal'])) {
            $message .= "📶 Signal: <code>{$extraData['signal']}</code>\n";
        }

        if (!empty($extraData['uptime'])) {
            $message .= "⏱️ Uptime: <code>{$extraData['uptime']}</code>\n";
        }

        $message .= "\n✅ Camera is ready for operation.";

        return $message;
    }

    /**
     * Build disconnect notification message
     *
     * @param array $extraData Additional data
     * @return string Formatted message
     */
    private function buildDisconnectMessage(array $extraData = []): string
    {
        $timestamp = date('Y-m-d H:i:s');
        $timezone = date('T');

        $message = "Camera <b>{$this->cameraName}</b> (ID: <code>{$this->cameraId}</code>) is now <b>OFFLINE</b>\n\n";
        $message .= "📅 Time: <code>{$timestamp} {$timezone}</code>\n";

        if (!empty($extraData['last_seen'])) {
            $message .= "👁️ Last seen: <code>{$extraData['last_seen']}</code>\n";
        }

        if (!empty($extraData['offline_duration'])) {
            $message .= "⏰ Offline for: <code>{$extraData['offline_duration']}</code>\n";
        }

        if (!empty($extraData['last_temperature'])) {
            $message .= "🌡️ Last temperature: <code>{$extraData['last_temperature']}</code>\n";
        }

        if (!empty($extraData['reason'])) {
            $message .= "❓ Reason: <code>{$extraData['reason']}</code>\n";
        }

        $message .= "\n⚠️ Please check camera connectivity.";

        return $message;
    }

    /**
     * Build error notification message
     *
     * @param string $errorMessage Error description
     * @param array  $extraData    Additional data
     * @return string Formatted message
     */
    private function buildErrorMessage(string $errorMessage, array $extraData = []): string
    {
        $timestamp = date('Y-m-d H:i:s');
        $timezone = date('T');

        $message = "Error on camera <b>{$this->cameraName}</b> (ID: <code>{$this->cameraId}</code>)\n\n";
        $message .= "📅 Time: <code>{$timestamp} {$timezone}</code>\n";
        $message .= "❌ Error: <code>" . htmlspecialchars($errorMessage) . "</code>\n";

        if (!empty($extraData['file'])) {
            $message .= "📁 File: <code>{$extraData['file']}</code>\n";
        }

        if (!empty($extraData['line'])) {
            $message .= "📍 Line: <code>{$extraData['line']}</code>\n";
        }

        $message .= "\n🔧 Please investigate immediately.";

        return $message;
    }

    /**
     * Send message via Telegram Bot API
     *
     * @param string $emoji   Emoji prefix
     * @param string $title   Message title
     * @param string $message Message body
     * @return bool True on success, false on failure
     */
    private function sendTelegramMessage(string $emoji, string $title, string $message): bool
    {
        if (empty($this->botToken) || empty($this->chatId)) {
            $this->logNotification('telegram', 'SKIPPED', 'Bot token or chat ID not configured');
            return false;
        }

        $fullMessage = "{$emoji} <b>{$title}</b>\n\n{$message}";

        $url = "https://api.telegram.org/bot{$this->botToken}/sendMessage";

        $data = [
            'chat_id' => $this->chatId,
            'text' => $fullMessage,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true
        ];

        $options = [
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/x-www-form-urlencoded',
                'content' => http_build_query($data),
                'timeout' => 10,
                'ignore_errors' => true
            ]
        ];

        $context = stream_context_create($options);
        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            $this->logNotification('telegram', 'FAILED', 'Network error');
            return false;
        }

        $result = json_decode($response, true);

        if (!isset($result['ok']) || $result['ok'] !== true) {
            $errorDesc = $result['description'] ?? 'Unknown error';
            $this->logNotification('telegram', 'FAILED', $errorDesc);
            return false;
        }

        return true;
    }

    /**
     * Check if notification can be sent (cooldown management)
     *
     * @param string $type Notification type
     * @return bool True if can send, false if in cooldown
     */
    private function canSendNotification(string $type): bool
    {
        $state = $this->getNotificationState();

        if (!isset($state[$type])) {
            return true;
        }

        $lastSent = $state[$type]['timestamp'] ?? 0;
        $elapsed = time() - $lastSent;

        return $elapsed >= $this->cooldownSeconds;
    }

    /**
     * Get current notification state
     *
     * @return array State data
     */
    private function getNotificationState(): array
    {
        if (empty($this->stateFile) || !file_exists($this->stateFile)) {
            return [];
        }

        $content = @file_get_contents($this->stateFile);
        if ($content === false) {
            return [];
        }

        $state = @json_decode($content, true);
        return is_array($state) ? $state : [];
    }

    /**
     * Update notification state after sending
     *
     * @param string $type Notification type
     * @return void
     */
    private function updateNotificationState(string $type): void
    {
        if (empty($this->stateFile)) {
            return;
        }

        $state = $this->getNotificationState();

        $state[$type] = [
            'timestamp' => time(),
            'count' => ($state[$type]['count'] ?? 0) + 1
        ];

        $state['last_notification'] = [
            'type' => $type,
            'timestamp' => time()
        ];

        $dir = dirname($this->stateFile);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        @file_put_contents($this->stateFile, json_encode($state, JSON_PRETTY_PRINT));
    }

    /**
     * Log notification event
     *
     * @param string $type    Notification type
     * @param string $status  Status (SUCCESS, FAILED, SKIPPED)
     * @param string $message Optional message
     * @return void
     */
    private function logNotification(string $type, string $status, string $message = ''): void
    {
        if (!function_exists('logMessage')) {
            return;
        }

        $logMsg = "Notification [{$type}] - {$status}";
        if (!empty($message)) {
            $logMsg .= " - {$message}";
        }

        $level = ($status === 'SUCCESS') ? 'INFO' : 'WARNING';
        logMessage($logMsg, $level, [
            'camera_id' => $this->cameraId,
            'camera_name' => $this->cameraName
        ]);
    }

    /**
     * Get notification statistics
     *
     * @return array Statistics data
     */
    public function getStatistics(): array
    {
        $state = $this->getNotificationState();

        return [
            'total_connect' => $state[NotificationType::CONNECT]['count'] ?? 0,
            'total_disconnect' => $state[NotificationType::DISCONNECT]['count'] ?? 0,
            'total_errors' => $state[NotificationType::ERROR]['count'] ?? 0,
            'last_notification' => $state['last_notification'] ?? null,
            'cooldown_seconds' => $this->cooldownSeconds,
            'enabled' => $this->enabled
        ];
    }

    /**
     * Reset notification state
     *
     * @return bool True on success
     */
    public function resetState(): bool
    {
        if (empty($this->stateFile)) {
            return false;
        }

        return @unlink($this->stateFile) || !file_exists($this->stateFile);
    }

    /**
     * Test notification (sends a test message)
     *
     * @return bool True on success
     */
    public function sendTestNotification(): bool
    {
        $emoji = '🧪';
        $title = "Test Notification";

        $timestamp = date('Y-m-d H:i:s T');
        $message = "This is a test notification from camera <b>{$this->cameraName}</b> (ID: <code>{$this->cameraId}</code>)\n\n";
        $message .= "📅 Time: <code>{$timestamp}</code>\n";
        $message .= "✅ Notification system is working correctly.";

        return $this->sendTelegramMessage($emoji, $title, $message);
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create notification helper instance from config
 *
 * @return NotificationHelper Configured instance
 */
function createNotificationHelper(): NotificationHelper
{
    return new NotificationHelper(
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        CAMERA_ID,
        CAMERA_DISPLAY_NAME,
        NOTIFICATION_STATE_FILE,
        NOTIFICATION_COOLDOWN,
        NOTIFICATIONS_ENABLED
    );
}

/**
 * Quick function to send connect notification
 *
 * @param array $extraData Additional data
 * @return bool Success status
 */
function notifyCameraConnected(array $extraData = []): bool
{
    $helper = createNotificationHelper();
    return $helper->sendConnectNotification($extraData);
}

/**
 * Quick function to send disconnect notification
 *
 * @param array $extraData Additional data
 * @return bool Success status
 */
function notifyCameraDisconnected(array $extraData = []): bool
{
    $helper = createNotificationHelper();
    return $helper->sendDisconnectNotification($extraData);
}

/**
 * Quick function to send error notification
 *
 * @param string $errorMessage Error message
 * @param array  $extraData    Additional data
 * @return bool Success status
 */
function notifyCameraError(string $errorMessage, array $extraData = []): bool
{
    $helper = createNotificationHelper();
    return $helper->sendErrorNotification($errorMessage, $extraData);
}
