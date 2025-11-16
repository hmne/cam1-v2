#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Camera Status Monitor - Cron Script
 *
 * Monitors camera connection status and sends notifications
 * when the camera goes online or offline.
 *
 * Usage:
 * - Add to crontab: * * * * * /usr/bin/php /path/to/status_monitor.php
 * - Or run manually: php status_monitor.php
 *
 * @category  Monitoring
 * @package   CameraControl
 * @author    Net Storm
 * @license   Proprietary
 * @version   1.0.0
 */

// Ensure CLI execution
if (php_sapi_name() !== 'cli' && !defined('CRON_MODE')) {
    echo "This script must be run from command line\n";
    exit(1);
}

// Change to application directory
chdir(dirname(__DIR__));

// Load dependencies
require_once __DIR__ . '/../config/app-config.php';
require_once __DIR__ . '/../includes/utilities.php';
require_once __DIR__ . '/../includes/NotificationHelper.php';

// =============================================================================
// MAIN MONITORING LOGIC
// =============================================================================

class StatusMonitor
{
    private string $lockFile;
    private string $statusFile;
    private string $previousStatusFile;
    private NotificationHelper $notifier;

    public function __construct()
    {
        $this->lockFile = TMP_DIR . '/status_monitor.lock';
        $this->statusFile = CAMERA_STATUS_FILE;
        $this->previousStatusFile = TMP_DIR . '/previous_online_status.tmp';
        $this->notifier = createNotificationHelper();
    }

    /**
     * Run the monitoring check
     *
     * @return void
     */
    public function run(): void
    {
        // Prevent concurrent execution
        if (!$this->acquireLock()) {
            $this->log('Another instance is running, exiting');
            return;
        }

        try {
            $this->checkAndNotify();
        } finally {
            $this->releaseLock();
        }
    }

    /**
     * Check camera status and send notification if changed
     *
     * @return void
     */
    private function checkAndNotify(): void
    {
        $currentStatus = $this->isCameraOnline();
        $previousStatus = $this->getPreviousStatus();

        $this->log(sprintf(
            'Status check: current=%s, previous=%s',
            $currentStatus ? 'online' : 'offline',
            $previousStatus ? 'online' : 'offline'
        ));

        // Check if status changed
        if ($currentStatus !== $previousStatus) {
            $this->log('Status changed! Sending notification...');

            if ($currentStatus) {
                $this->handleCameraOnline();
            } else {
                $this->handleCameraOffline();
            }

            // Save new status
            $this->savePreviousStatus($currentStatus);
        } else {
            $this->log('Status unchanged, no notification needed');
        }
    }

    /**
     * Handle camera coming online
     *
     * @return void
     */
    private function handleCameraOnline(): void
    {
        $extraData = $this->getStatusData();

        $this->log('Camera is now ONLINE');
        $this->log('Extra data: ' . json_encode($extraData));

        $result = $this->notifier->sendConnectNotification($extraData);

        if ($result) {
            $this->log('Connect notification sent successfully');
        } else {
            $this->log('Failed to send connect notification');
        }
    }

    /**
     * Handle camera going offline
     *
     * @return void
     */
    private function handleCameraOffline(): void
    {
        $lastSeen = $this->getLastSeenTime();
        $offlineDuration = $this->getOfflineDuration();
        $lastTemp = $this->getLastTemperature();

        $extraData = [
            'last_seen' => $lastSeen,
            'offline_duration' => $offlineDuration
        ];

        if (!empty($lastTemp)) {
            $extraData['last_temperature'] = $lastTemp;
        }

        $this->log('Camera is now OFFLINE');
        $this->log('Last seen: ' . $lastSeen);
        $this->log('Offline duration: ' . $offlineDuration);

        $result = $this->notifier->sendDisconnectNotification($extraData);

        if ($result) {
            $this->log('Disconnect notification sent successfully');
        } else {
            $this->log('Failed to send disconnect notification');
        }
    }

    /**
     * Check if camera is currently online
     *
     * @return bool True if online
     */
    private function isCameraOnline(): bool
    {
        if (!file_exists($this->statusFile)) {
            return false;
        }

        $lastModified = filemtime($this->statusFile);
        if ($lastModified === false) {
            return false;
        }

        $secondsSinceUpdate = time() - $lastModified;
        return $secondsSinceUpdate <= CAMERA_ONLINE_TIMEOUT_SECONDS;
    }

    /**
     * Get previous online status
     *
     * @return bool Previous status
     */
    private function getPreviousStatus(): bool
    {
        if (!file_exists($this->previousStatusFile)) {
            // First run, assume offline
            return false;
        }

        $content = trim(file_get_contents($this->previousStatusFile));
        return $content === 'true';
    }

    /**
     * Save current status for next check
     *
     * @param bool $status Current status
     * @return void
     */
    private function savePreviousStatus(bool $status): void
    {
        file_put_contents($this->previousStatusFile, $status ? 'true' : 'false');
    }

    /**
     * Get camera status data
     *
     * @return array Status data
     */
    private function getStatusData(): array
    {
        $data = [];

        if (file_exists($this->statusFile)) {
            $content = trim(file_get_contents($this->statusFile));
            $parts = explode(',', $content);

            if (isset($parts[0]) && $parts[0] !== 'N/A' && !empty($parts[0])) {
                $data['memory'] = $parts[0];
            }

            if (isset($parts[1]) && $parts[1] !== 'N/A' && !empty($parts[1])) {
                $data['temperature'] = $parts[1];
            }

            if (isset($parts[3]) && $parts[3] !== 'N/A' && !empty($parts[3])) {
                $data['signal'] = $parts[3];
            }
        }

        // IP address
        $ipFile = TMP_DIR . '/ip.tmp';
        if (file_exists($ipFile)) {
            $ip = trim(file_get_contents($ipFile));
            if (!empty($ip)) {
                $data['ip'] = $ip;
            }
        }

        // Uptime from system_info
        if (file_exists(SYSTEM_INFO_FILE)) {
            $systemInfo = file_get_contents(SYSTEM_INFO_FILE);
            if (preg_match('/uptime=([^|]+)/', $systemInfo, $matches)) {
                $data['uptime'] = trim($matches[1]);
            }
        }

        return $data;
    }

    /**
     * Get last seen time
     *
     * @return string Formatted time
     */
    private function getLastSeenTime(): string
    {
        if (!file_exists($this->statusFile)) {
            return 'Unknown';
        }

        $timestamp = filemtime($this->statusFile);
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
    private function getOfflineDuration(): string
    {
        if (!file_exists($this->statusFile)) {
            return 'Unknown';
        }

        $timestamp = filemtime($this->statusFile);
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
     * Get last temperature reading
     *
     * @return string Temperature or empty string
     */
    private function getLastTemperature(): string
    {
        if (!file_exists($this->statusFile)) {
            return '';
        }

        $content = trim(file_get_contents($this->statusFile));
        $parts = explode(',', $content);

        if (isset($parts[1]) && $parts[1] !== 'N/A') {
            return $parts[1];
        }

        return '';
    }

    /**
     * Acquire lock to prevent concurrent execution
     *
     * @return bool True if lock acquired
     */
    private function acquireLock(): bool
    {
        // Check if lock file exists and is stale (older than 5 minutes)
        if (file_exists($this->lockFile)) {
            $lockAge = time() - filemtime($this->lockFile);
            if ($lockAge > 300) {
                // Stale lock, remove it
                unlink($this->lockFile);
            } else {
                return false;
            }
        }

        return file_put_contents($this->lockFile, (string)getmypid()) !== false;
    }

    /**
     * Release lock
     *
     * @return void
     */
    private function releaseLock(): void
    {
        if (file_exists($this->lockFile)) {
            unlink($this->lockFile);
        }
    }

    /**
     * Log message with timestamp
     *
     * @param string $message Message to log
     * @return void
     */
    private function log(string $message): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [StatusMonitor] {$message}\n";

        // Log to console (if running interactively)
        echo $logEntry;

        // Log to file
        $logFile = LOG_DIR . '/status_monitor.log';
        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }
}

// =============================================================================
// EXECUTE MONITOR
// =============================================================================

$monitor = new StatusMonitor();
$monitor->run();

echo "Status monitor check completed.\n";
