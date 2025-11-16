/**
 * Camera Control Center - Client-Side Controller
 *
 * Enterprise-grade JavaScript module for camera management interface.
 * Handles live streaming, image capture, status monitoring, and user interactions.
 *
 * @category  CameraControl
 * @package   Frontend
 * @author    Net Storm
 * @license   Proprietary
 * @version   4.1.0 - Fixed Synchronous XMLHttpRequest warning
 * @standards ES5+, JSDoc, Clean Code
 *
 * Features:
 * - Live video streaming with quality control
 * - Remote image capture with conflict prevention
 * - Real-time status monitoring
 * - Automatic reconnection handling
 * - Offline detection and recovery
 * - Keyboard shortcuts (Space: capture, L: toggle live)
 *
 * Dependencies:
 * - jQuery 3.7.1+
 *
 * Security:
 * - CSRF protection via server-side validation
 * - Input sanitization
 * - Connection state management
 */

'use strict';

(function($, window, document) {
    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Application configuration
     * @type {Object}
     */
    const CONFIG = {
        CAM: window.CAMERA_NAME || 'Camera', // Set by PHP
        STATUS_UPDATE_INTERVAL: 2000,        // 2 seconds
        LIVE_UPDATE_INTERVAL: 1500,          // 1.5 seconds
        CAPTURE_CHECK_FAST: 25,              // Fast polling for new image (optimized)
        CAPTURE_CHECK_SLOW: 200,             // Slow polling for new image (optimized)
        CAPTURE_MAX_ATTEMPTS: 200,           // Max capture polling attempts (increased for faster polling)
        OFFLINE_THRESHOLD: 7,                // Seconds before considering offline
        LIVE_ERROR_THRESHOLD: 7,             // Failed attempts before stopping live
        CAPTURE_RESTORE_DELAY: 500,          // Delay before restarting live after capture
        LIVE_START_DELAY: 800                // Delay before starting live updates
    };

    /**
     * Quality presets for live streaming
     * @type {Object}
     */
    const QUALITY_PRESETS = {
        'very-low': [480, 360, 8],
        'low': [640, 480, 16],
        'medium': [800, 600, 24],
        'high': [1024, 768, 32]
    };

    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================

    /**
     * Application state
     * @type {Object}
     */
    const state = {
        statusInterval: null,
        webLiveInterval: null,
        sessionHeartbeatInterval: null,
        isLiveActive: false,
        lastOnlineTime: Date.now(),
        wasLiveBeforeOffline: false,
        captureLock: false,
        liveErrorCount: 0,
        currentQuality: null,
        statusRetryCount: 0,
        firstLoad: true,
        sessionId: null,
        previousOnlineStatus: null,  // Track previous status for notifications
        notificationsEnabled: false  // Browser notifications permission
    };

    // ========================================================================
    // BROWSER NOTIFICATIONS
    // ========================================================================

    /**
     * Request browser notification permission
     */
    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log(`[${CONFIG.CAM}] Browser does not support notifications`);
            return;
        }

        if (Notification.permission === 'granted') {
            state.notificationsEnabled = true;
            console.log(`[${CONFIG.CAM}] 🔔 Notifications enabled`);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(function(permission) {
                state.notificationsEnabled = (permission === 'granted');
                console.log(`[${CONFIG.CAM}] 🔔 Notification permission: ${permission}`);
            });
        }
    }

    /**
     * Send browser notification
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {string} icon - Icon type ('online' or 'offline')
     */
    function sendNotification(title, body, icon) {
        if (!state.notificationsEnabled || Notification.permission !== 'granted') {
            return;
        }

        // Don't notify if page is visible/focused
        if (document.visibilityState === 'visible' && document.hasFocus()) {
            return;
        }

        var iconUrl = icon === 'online'
            ? 'assets/images/logo.ico'
            : 'assets/images/logo.ico';

        var notification = new Notification(title, {
            body: body,
            icon: iconUrl,
            tag: CONFIG.CAM + '-status',
            renotify: true,
            requireInteraction: false
        });

        // Auto close after 10 seconds
        setTimeout(function() {
            notification.close();
        }, 10000);

        // Focus window when clicked
        notification.onclick = function() {
            window.focus();
            notification.close();
        };

        console.log(`[${CONFIG.CAM}] 🔔 Notification sent: ${title}`);
    }

    /**
     * Check and notify on status change
     * @param {boolean} isOnline - Current online status
     */
    function checkAndNotifyStatusChange(isOnline) {
        // Skip first load
        if (state.previousOnlineStatus === null) {
            state.previousOnlineStatus = isOnline;
            return;
        }

        // Check if status changed
        if (isOnline !== state.previousOnlineStatus) {
            if (isOnline) {
                // Camera came online
                sendNotification(
                    '🟢 ' + CONFIG.CAM + ' Connected',
                    'Camera is now online and ready',
                    'online'
                );
            } else {
                // Camera went offline
                sendNotification(
                    '🔴 ' + CONFIG.CAM + ' Disconnected',
                    'Camera connection lost! Please check.',
                    'offline'
                );
            }

            state.previousOnlineStatus = isOnline;
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize application on document ready
     */
    $(document).ready(function() {
        initializeApp();
        setupEventHandlers();
        startStatusMonitoring();
        setupCleanupOnExit();
    });

    /**
     * Initialize application state and load initial data
     */
    function initializeApp() {
        // Force all AJAX requests to be asynchronous
        $.ajaxPrefilter(function(options) {
            options.async = true;
            options.cache = false;
            if (!options.timeout) {
                options.timeout = 5000;
            }
        });

        // Request browser notification permission
        requestNotificationPermission();

        // Check server-side live stream state on page load
        $.ajax({
            url: 'tmp/web_live.tmp',
            type: 'GET',
            async: true,
            cache: false,
            success: function(data) {
                const serverState = data.trim() === 'on' ? 'on' : 'off';
                $('#webLiveSelect').val(serverState);
                if (serverState === 'on') {
                    toggleWebLive();
                }
            },
            error: function() {
                $('#webLiveSelect').val('off');
            }
        });

        // Load initial camera status
        loadCameraStatus();
    }

    /**
     * Setup all event handlers
     */
    function setupEventHandlers() {
        setupKeyboardShortcuts();
        setupButtonHandlers();
    }

    /**
     * Setup keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        $(document).keydown(function(e) {
            // Ignore if typing in input fields
            if ($(e.target).is('input, textarea, select')) return;

            // Space key: Capture image
            if (e.keyCode === 32) {
                e.preventDefault();
                $('#myBut').click();
            }

            // L key: Toggle live stream
            if (e.keyCode === 76) {
                const currentState = $('#webLiveSelect').val();
                const newState = currentState === 'on' ? 'off' : 'on';
                $('#webLiveSelect').val(newState).change();
            }
        });
    }

    /**
     * Setup button click handlers
     */
    function setupButtonHandlers() {
        // Reboot button
        $('#rebootButton').click(function() {
            if (confirm('Are you sure you want to reboot the camera?')) {
                const $button = $(this);
                $button.prop('disabled', true).text('Rebooting...');

                $.get('admin/reboot.php', { token: window.ADMIN_TOKEN })
                    .done(function(response) {
                        const data = typeof response === 'string' ? JSON.parse(response) : response;
                        alert(data.message || data.error || 'Operation completed');
                    })
                    .fail(function(xhr) {
                        const error = xhr.responseJSON || {};
                        alert(error.error || 'Failed to reboot camera');
                    })
                    .always(function() {
                        $button.prop('disabled', false).text('Reboot');
                    });
            }
        });

        // Shutdown button
        $('#shutdownButton').click(function() {
            const message = 'If you turn off the camera, it will not work unless you turn it off and then on again via the switch.\nAre you sure?';
            if (confirm(message)) {
                const $button = $(this);
                $button.prop('disabled', true).text('Shutting down...');

                $.get('admin/shutdown.php', { token: window.ADMIN_TOKEN })
                    .done(function(response) {
                        const data = typeof response === 'string' ? JSON.parse(response) : response;
                        alert(data.message || data.error || 'Operation completed');
                    })
                    .fail(function(xhr) {
                        const error = xhr.responseJSON || {};
                        alert(error.error || 'Failed to shutdown camera');
                    })
                    .always(function() {
                        $button.prop('disabled', false).text('Shutdown');
                    });
            }
        });

        // Clear files button
        $('#clearFilesButton').click(function() {
            window.location.href = 'admin/clear.php';
        });
    }

    /**
     * Setup cleanup handler for page exit
     */
    function setupCleanupOnExit() {
        $(window).on('beforeunload', function() {
            // Clear intervals
            if (state.statusInterval) clearInterval(state.statusInterval);
            if (state.webLiveInterval) clearInterval(state.webLiveInterval);

            // Turn off live stream on server
            if (state.isLiveActive) {
                $.post('index.php', {
                    action: 'write',
                    file: 'tmp/web_live.tmp',
                    data: 'off'
                });
            }
        });
    }

    // ========================================================================
    // STATUS MONITORING
    // ========================================================================

    /**
     * Check session conflict - Mutual Exclusion (Two-Way Switch)
     * If another client/server opened live stream → stop our stream
     * This prevents multiple simultaneous streams (Pi can't handle it)
     */
    function checkSessionConflict() {
        if (!state.isLiveActive) return;

        $.ajax({
            url: 'tmp/web_live_session.tmp?t=' + Date.now(),
            type: 'GET',
            cache: false,
            timeout: 3000,
            success: function(data) {
                const trimmed = $.trim(data);
                if (!trimmed) return; // Empty file - no session

                const parts = trimmed.split(':');
                const sessionTimestamp = parseInt(parts[0]) || 0;
                const sessionId = parts[1] || '';

                // Check if session belongs to another client
                if (sessionId && sessionId !== state.sessionId) {
                    const now = Date.now();
                    const age = now - sessionTimestamp;

                    if (age < 30000) {
                        console.log(`[${CONFIG.CAM}] Live stream opened elsewhere - stopping here (session conflict)`);

                        $('#webLiveSelect').val('off');
                        stopLiveStream();
                    }
                }
            },
            error: function() {
                // Session file missing or unreachable - continue
            }
        });
    }

    /**
     * Start periodic status monitoring
     */
    function startStatusMonitoring() {
        if (state.statusInterval) clearInterval(state.statusInterval);

        state.statusInterval = setInterval(function() {
            loadCameraStatus();
            checkBrowserConnection();
            checkSessionConflict(); // Mutual Exclusion - Two-Way Switch
        }, CONFIG.STATUS_UPDATE_INTERVAL);
    }

    /**
     * Load and display camera status
     */
    function loadCameraStatus() {
        $.ajax({
            url: 'mode.php?t=' + Date.now(),
            type: 'GET',
            async: true,
            cache: false,
            timeout: 5000,
            success: function(response) {
                state.statusRetryCount = 0;
                state.firstLoad = false;
                $('#id1').html(response);
                manageLiveStreamBasedOnStatus();
            },
            error: function(xhr) {
                if (state.statusRetryCount < 2) {
                    state.statusRetryCount++;
                    setTimeout(loadCameraStatus, 200);
                    return;
                }

                if (!state.firstLoad) {
                    $('#id1').html('<span class="camera-offline">Camera Offline</span>');
                }
                console.log(`[${CONFIG.CAM}] mode.php load error - HTTP ${xhr.status}`);
                window.cameraOnlineStatus = false;
                window.secondsSinceUpdate = 999;
                state.statusRetryCount = 0;
                state.firstLoad = false;
                manageLiveStreamBasedOnStatus();
            }
        });
    }

    /**
     * Manage live stream based on camera online/offline status
     */
    function manageLiveStreamBasedOnStatus() {
        const isOnline = window.cameraOnlineStatus || false;
        const secondsSince = window.secondsSinceUpdate || 999;
        const now = Date.now();
        const isActuallyOnline = isOnline && secondsSince <= CONFIG.OFFLINE_THRESHOLD;

        // Check and send notification if status changed
        checkAndNotifyStatusChange(isActuallyOnline);

        if (isActuallyOnline) {
            // Camera is online
            state.lastOnlineTime = now;

            // Restart live stream if it was active before going offline
            if (state.wasLiveBeforeOffline && !state.isLiveActive) {
                console.log(`[${CONFIG.CAM}] 🔄 Camera back online - restarting live stream`);
                state.wasLiveBeforeOffline = false;
                $('#webLiveSelect').val('on');
                startLiveStream();
            }
        } else {
            // Camera is offline or connection lost
            const offlineTime = (now - state.lastOnlineTime) / 1000;

            if (offlineTime > CONFIG.OFFLINE_THRESHOLD && state.isLiveActive) {
                console.log(`[${CONFIG.CAM}] ⏸️ Camera offline for ${offlineTime.toFixed(0)}s - stopping live stream`);
                state.wasLiveBeforeOffline = true;
                stopLiveStreamSilent();
            }
        }
    }

    /**
     * Check browser internet connection
     */
    function checkBrowserConnection() {
        if (!window.navigator.onLine) {
            alert('Web browser without internet connection\n\nTry to:\nCheck network cables, modem and router\nReconnect to a Wi-Fi network');
        }
    }

    // ========================================================================
    // IMAGE CAPTURE
    // ========================================================================

    /**
     * Capture image from camera
     * Global function exposed for onclick handlers
     */
    window.captureImage = function() {
        if (state.captureLock) {
            console.log(`[${CONFIG.CAM}] ⚠️ captureImage() ignored: capture already in progress`);
            return;
        }

        const currentLiveState = $('#webLiveSelect').val();
        let wasLiveActive = false;

        // CRITICAL: Stop live stream BEFORE capture to avoid camera resource conflict
        if (currentLiveState === 'on' && state.isLiveActive) {
            wasLiveActive = true;
            console.log(`[${CONFIG.CAM}] 🛑 Stopping live stream for capture...`);
            state.isLiveActive = false;
            if (state.webLiveInterval) clearInterval(state.webLiveInterval);
            $('#webLiveSelect').val('off');
            $.post('index.php', {
                action: 'write',
                file: 'tmp/web_live.tmp',
                data: 'off'
            });
        }

        // Lock capture to prevent concurrent requests
        state.captureLock = true;
        const $button = $('#myBut');
        const originalText = $button.text();
        $button.prop('disabled', true).text('Capturing...').addClass('blinking');

        const beforeCaptureTime = Date.now() / 1000;

        // Collect camera settings from form
        const formData = {
            res: $('select[name="res"]').val(),
            comp: $('select[name="comp"]').val(),
            iso: $('select[name="iso"]').val(),
            sat: $('select[name="sat"]').val(),
            rot: $('select[name="rot"]').val(),
            fx: $('select[name="fx"]').val(),
            enf: $('select[name="enf"]').val(),
            b1: 'inic',
            submit: 'submit'
        };

        // Send capture request
        $.post('index.php', formData)
            .done(function(response) {
                if (response === 'BUSY') {
                    console.warn(`[${CONFIG.CAM}] ⚠️ Server responded BUSY`);
                    resetCaptureButton($button, originalText);
                    restoreLiveStreamIfNeeded(wasLiveActive);
                    alert('Camera is busy. Please wait and try again.');
                    return;
                }
                checkForNewImage($button, originalText, beforeCaptureTime, 0, wasLiveActive);
            })
            .fail(function(error) {
                console.error(`[${CONFIG.CAM}] ❌ Capture POST failed:`, error);
                resetCaptureButton($button, originalText);
                restoreLiveStreamIfNeeded(wasLiveActive);
                alert('Failed to capture image. Please try again.');
            });
    };

    /**
     * Check for new captured image (recursive polling)
     *
     * @param {jQuery} $button - Capture button element
     * @param {string} originalText - Original button text
     * @param {number} beforeCaptureTime - Timestamp before capture started
     * @param {number} attempts - Current attempt number
     * @param {boolean} wasLiveActive - Whether live stream was active before capture
     */
    function checkForNewImage($button, originalText, beforeCaptureTime, attempts, wasLiveActive) {
        if (attempts >= CONFIG.CAPTURE_MAX_ATTEMPTS) {
            console.warn(`[${CONFIG.CAM}] ⏱️ Timeout after ${attempts} attempts`);
            resetCaptureButton($button, originalText);
            restoreLiveStreamIfNeeded(wasLiveActive);
            alert('Image capture timed out. The Camera may be busy or offline. Please try again.');
            return;
        }

        $.get('index.php?check_new_image&t=' + Date.now())
            .done(function(data) {
                if (data !== '0') {
                    const imageTimestamp = parseInt(data, 10);

                    if (imageTimestamp > beforeCaptureTime) {
                        const captureTime = (imageTimestamp - beforeCaptureTime).toFixed(2);
                        console.log(`[${CONFIG.CAM}] ✅ Image received in ${captureTime}s (timestamp: ${imageTimestamp})`);

                        displayNewImage(imageTimestamp, captureTime);
                        resetCaptureButton($button, originalText);

                        // Restore live stream AFTER image is received
                        if (wasLiveActive) {
                            console.log(`[${CONFIG.CAM}] ▶️ Restarting live stream...`);
                            setTimeout(function() {
                                $('#webLiveSelect').val('on');
                                toggleWebLive();
                            }, CONFIG.CAPTURE_RESTORE_DELAY);
                        }
                    } else {
                        setTimeout(function() {
                            checkForNewImage($button, originalText, beforeCaptureTime, attempts + 1, wasLiveActive);
                        }, CONFIG.CAPTURE_CHECK_SLOW);
                    }
                } else {
                    setTimeout(function() {
                        checkForNewImage($button, originalText, beforeCaptureTime, attempts + 1, wasLiveActive);
                    }, CONFIG.CAPTURE_CHECK_FAST);
                }
            })
            .fail(function() {
                setTimeout(function() {
                    checkForNewImage($button, originalText, beforeCaptureTime, attempts + 1, wasLiveActive);
                }, CONFIG.CAPTURE_CHECK_SLOW);
            });
    }

    /**
     * Display newly captured image
     *
     * @param {number} timestamp - Image timestamp for cache busting
     * @param {string} captureTime - Total capture time in seconds
     */
    function displayNewImage(timestamp, captureTime) {
        // Generate unique cache buster
        const cacheBuster = timestamp + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Check if containers already exist
        const isUpdate = $('#ImageContainer').length > 0;

        if (!isUpdate) {
            // Create new containers
            const $imageContainer = $(`
                <div id="ImageContainer" class="glass-panel">
                    <img id="Image" alt="Captured Image" loading="eager" class="captured-image">
                </div>
                <div id="imageDetails" class="glass-panel image-details-panel">
                    <p id="imageSizeText" class="image-size-text">Loading image size...</p>
                </div>
            `);

            // Insert after form panel
            $('form').closest('.glass-panel').after($imageContainer);
        } else {
            // Update existing containers
            $('#imageSizeText').html('<p class="image-size-text">Loading image size...</p>');
        }

        // Preload image with retry mechanism
        const newImage = new Image();
        let retryCount = 0;
        const maxRetries = 3;

        newImage.onload = function() {
            $('#Image').attr('src', this.src);
            $('#ImageContainer, #imageDetails').fadeIn('fast');

            // Fetch and display image size + capture time
            $.get('index.php?get_image_size=1&t=' + Date.now())
                .done(function(sizeData) {
                    $('#imageSizeText').addClass('data-text').html(
                        'Image size: ' + sizeData +
                        ' <span class="capture-time">' +'Time: ' + captureTime + 's</span>'
                    );
                })
                .fail(function() {
                    $('#imageSizeText').html(
                        'Image size: Unknown' +
                        ' <span class="capture-time">' +'Time: ' + captureTime + 's</span>'
                    );
                });
        };

        newImage.onerror = function() {
            retryCount++;
            if (retryCount <= maxRetries) {
                $('#imageSizeText').text('Loading image... (' + retryCount + '/' + maxRetries + ')');
                setTimeout(function() {
                    newImage.src = 'pic.jpg?v=' + Date.now() + '_retry' + retryCount;
                }, 1000);
            } else {
                $('#imageSizeText').text('Error: Could not load image');
            }
        };

        newImage.src = 'pic.jpg?v=' + cacheBuster;
    }

    /**
     * Reset capture button to original state
     *
     * @param {jQuery} $button - Button element
     * @param {string} originalText - Original button text
     */
    function resetCaptureButton($button, originalText) {
        state.captureLock = false;
        $button.prop('disabled', false).text(originalText).removeClass('blinking');
    }

    /**
     * Restore live stream if it was active before capture
     *
     * @param {boolean} wasLiveActive - Whether live was active
     */
    function restoreLiveStreamIfNeeded(wasLiveActive) {
        if (wasLiveActive) {
            $('#webLiveSelect').val('on');
            toggleWebLive();
        }
    }

    // ========================================================================
    // LIVE STREAM MANAGEMENT
    // ========================================================================

    /**
     * Toggle live stream on/off
     * Global function exposed for onchange handlers
     */
    window.toggleWebLive = function() {
        const selectedState = $('#webLiveSelect').val();
        if (selectedState === 'on') {
            startLiveStream();
        } else {
            stopLiveStream();
        }
    };

    /**
     * Send session heartbeat
     */
    function sendSessionHeartbeat() {
        if (!state.isLiveActive || !state.sessionId) return;
        const timestamp = Date.now();
        const data = timestamp + ':' + state.sessionId;
        $.post('index.php', {action: 'write', file: 'tmp/web_live_session.tmp', data: data});
    }

    /**
     * Start session heartbeat
     */
    function startSessionHeartbeat() {
        state.sessionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sendSessionHeartbeat();
        if (state.sessionHeartbeatInterval) clearInterval(state.sessionHeartbeatInterval);
        state.sessionHeartbeatInterval = setInterval(sendSessionHeartbeat, 10000);
    }

    /**
     * Stop session heartbeat
     */
    function stopSessionHeartbeat() {
        if (state.sessionHeartbeatInterval) {
            clearInterval(state.sessionHeartbeatInterval);
            state.sessionHeartbeatInterval = null;
        }
        state.sessionId = null;
    }

    /**
     * Start live video streaming
     */
    function startLiveStream() {
        console.log(`[${CONFIG.CAM}] 🎥 Starting live stream...`);
        state.isLiveActive = true;
        startSessionHeartbeat();
        $('#webLiveContainer').fadeIn();
        $('#webLiveImage').attr('src', 'buffer.jpg');

        // Show loading indicator
        if (!$('#loadingIndicator').length) {
            $('#liveFeed').append(
                '<div id="loadingIndicator" class="loading-overlay">' +
                    '<div class="spinner"></div>' +
                    '<div class="loading-text">Starting live stream...</div>' +
                '</div>'
            );
        }

        // Restore saved quality preference
        const savedQuality = localStorage.getItem('preferredQuality');
        $('#liveQuality').val(savedQuality || 'very-low');

        // Update quality settings (no spam if unchanged)
        updateLiveQuality(false);

        // Send live stream start signal to server
        $.post('index.php', {
            action: 'write',
            file: 'tmp/web_live.tmp',
            data: 'on'
        })
        .done(function(response) {
            if (response.trim() === 'OK') {
                console.log(`[${CONFIG.CAM}] ▶️ Live stream ready`);
                setTimeout(function() {
                    $('#loadingIndicator').remove();
                    startLiveUpdates();
                }, CONFIG.LIVE_START_DELAY);
            } else {
                console.error(`[${CONFIG.CAM}] ❌ Failed to start: ${response}`);
                $('#loadingIndicator').remove();
                alert('Failed to start live stream: ' + response);
            }
        })
        .fail(function(xhr, status, error) {
            console.error(`[${CONFIG.CAM}] ❌ Failed to start: ${error}`);
            $('#loadingIndicator').remove();
            alert('Failed to start live stream: ' + error);
        });
    }

    /**
     * Stop live stream (user action)
     */
    function stopLiveStream() {
        console.log(`[${CONFIG.CAM}] ⏹️ Live stream OFF (user stopped)`);
        state.isLiveActive = false;
        stopSessionHeartbeat();
        if (state.webLiveInterval) clearInterval(state.webLiveInterval);
        $('#webLiveContainer').fadeOut();
        $('#loadingIndicator').remove();

        $.post('index.php', {
            action: 'write',
            file: 'tmp/web_live.tmp',
            data: 'off'
        });
    }

    /**
     * Stop live stream silently (auto-stop due to connection loss)
     */
    function stopLiveStreamSilent() {
        console.log(`[${CONFIG.CAM}] ⏸️ Live stream paused (connection timeout)`);
        state.isLiveActive = false;
        stopSessionHeartbeat();
        if (state.webLiveInterval) clearInterval(state.webLiveInterval);
        $('#webLiveImage').attr('src', 'buffer.jpg');
        $('#loadingIndicator').remove();
    }

    /**
     * Start periodic live image updates
     */
    function startLiveUpdates() {
        if (state.webLiveInterval) clearInterval(state.webLiveInterval);

        // Initial update
        updateWebLiveImage();

        // Periodic updates
        state.webLiveInterval = setInterval(function() {
            if (state.isLiveActive && $('#webLiveSelect').val() === 'on') {
                updateWebLiveImage();
            } else {
                clearInterval(state.webLiveInterval);
                state.webLiveInterval = null;
            }
        }, CONFIG.LIVE_UPDATE_INTERVAL);
    }

    /**
     * Update live stream image
     */
    function updateWebLiveImage() {
        // Safety check: ensure live is still active
        if ($('#webLiveSelect').val() !== 'on' || !state.isLiveActive) {
            return;
        }

        const img = new Image();

        img.onload = function() {
            $('#webLiveImage').attr('src', this.src);

            // Reset error counter on success
            if (state.liveErrorCount > 0) {
                console.log(`[${CONFIG.CAM}] ✅ Live stream recovered`);
                state.liveErrorCount = 0;
            }
        };

        img.onerror = function() {
            state.liveErrorCount++;
            console.warn(`[${CONFIG.CAM}] ⚠️ Live image load failed (attempt ${state.liveErrorCount})`);

            // Stop after too many failures
            if (state.liveErrorCount >= CONFIG.LIVE_ERROR_THRESHOLD) {
                console.error(`[${CONFIG.CAM}] ❌ Live stream timeout - stopping after ${CONFIG.LIVE_ERROR_THRESHOLD} failed attempts`);
                stopLiveStreamSilent();
                state.liveErrorCount = 0;
            }
        };

        img.src = 'live.jpg?' + Date.now();
    }

    /**
     * Update live stream quality
     * Global function exposed for onchange handlers
     *
     * @param {boolean} forceUpdate - Force quality update even if unchanged
     */
    window.updateLiveQuality = function(forceUpdate) {
        const quality = $('#liveQuality').val();
        const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS['very-low'];
        const width = preset[0];
        const height = preset[1];
        const qualityValue = preset[2];
        const data = width + ' ' + height + ' ' + qualityValue;

        // Skip update if quality hasn't changed and not forced
        if (!forceUpdate && state.currentQuality === data) {
            return;
        }

        state.currentQuality = data;
        localStorage.setItem('preferredQuality', quality);

        $.post('index.php', {
            action: 'write',
            file: 'tmp/web_live_quality.tmp',
            data: data
        })
        .done(function(response) {
            if (response.trim() === 'OK') {
                console.log(`[${CONFIG.CAM}] ✅ Quality set: ${width}x${height} q=${qualityValue}`);

                // Restart live feed if quality was changed manually
                if (forceUpdate && state.webLiveInterval && state.isLiveActive) {
                    setTimeout(function() {
                        $('#webLiveImage').attr('src', 'buffer.jpg');
                        setTimeout(function() {
                            startLiveUpdates();
                        }, 500);
                    }, 500);
                }
            } else {
                console.error(`[${CONFIG.CAM}] ❌ Server response: ${response}`);
            }
        })
        .fail(function(xhr, status, error) {
            console.error(`[${CONFIG.CAM}] ❌ Quality update failed: ${status}`);
        });
    };

})(jQuery, window, document);
