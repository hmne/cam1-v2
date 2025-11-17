/**
 * OCR Module - Text Extraction from Images
 *
 * Standalone module for extracting text from camera images using
 * Google Cloud Vision API. Works with any JS mode (jQuery/Vanilla/Ultra).
 *
 * @category  Modules
 * @package   OCR
 * @author    Net Storm
 * @version   1.0.0
 */

'use strict';

(function(window, document) {
    // ========================================================================
    // MODULE CONFIGURATION
    // ========================================================================

    const OCR_CONFIG = {
        ENDPOINT: 'ocr.php',
        TIMEOUT: 30000,
        DEFAULT_IMAGE: 'pic.jpg',
        BUTTON_ID: 'ocr-extract-btn',
        INFO_SELECTOR: '#imageSizeText',
        NOTIFICATION_DURATION: 3000
    };

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Copy text to clipboard with fallback
     *
     * @param {string} text Text to copy
     * @returns {Promise<void>}
     */
    function copyToClipboard(text) {
        // Modern API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        // Fallback for older browsers
        return new Promise(function(resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            try {
                var successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
            } catch (err) {
                document.body.removeChild(textarea);
                reject(err);
            }
        });
    }

    /**
     * Show notification message
     *
     * @param {string} message Message to display
     * @param {string} type Type: 'success', 'error', 'warning'
     */
    function showNotification(message, type) {
        type = type || 'success';

        // Remove existing notification
        var existing = document.querySelector('.ocr-notification');
        if (existing) {
            existing.remove();
        }

        var notification = document.createElement('div');
        notification.className = 'ocr-notification ocr-notification-' + type;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto-remove after duration
        setTimeout(function() {
            if (notification.parentNode) {
                notification.classList.add('ocr-notification-fadeout');
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, OCR_CONFIG.NOTIFICATION_DURATION);
    }

    /**
     * Make AJAX request (jQuery-independent)
     *
     * @param {string} url Endpoint URL
     * @param {Object} data POST data
     * @param {Function} onSuccess Success callback
     * @param {Function} onError Error callback
     */
    function ajaxPost(url, data, onSuccess, onError) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = OCR_CONFIG.TIMEOUT;

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    onSuccess(response);
                } catch (e) {
                    onError('Invalid JSON response');
                }
            } else {
                try {
                    var errorResponse = JSON.parse(xhr.responseText);
                    onError(errorResponse.error || 'Request failed');
                } catch (e) {
                    onError('Request failed: ' + xhr.status);
                }
            }
        };

        xhr.onerror = function() {
            onError('Network error');
        };

        xhr.ontimeout = function() {
            onError('Request timeout');
        };

        // Encode data
        var params = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                params.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
        }

        xhr.send(params.join('&'));
    }

    // ========================================================================
    // OCR FUNCTIONALITY
    // ========================================================================

    /**
     * Extract text from image
     *
     * @param {string} imageName Optional image name (default: pic.jpg)
     */
    function extractTextFromImage(imageName) {
        var targetImage = imageName || OCR_CONFIG.DEFAULT_IMAGE;
        var button = document.getElementById(OCR_CONFIG.BUTTON_ID);

        if (!button) {
            console.error('[OCR Module] Button not found');
            return;
        }

        var originalContent = button.innerHTML;

        // Disable button and show loading
        button.disabled = true;
        button.innerHTML = '⏳';
        button.classList.add('loading');

        console.log('[OCR Module] Extracting text from ' + targetImage + '...');

        ajaxPost(
            OCR_CONFIG.ENDPOINT,
            { image: targetImage },
            function(response) {
                // Success
                if (response.success && response.hasText) {
                    copyToClipboard(response.text)
                        .then(function() {
                            button.innerHTML = '✅';
                            button.classList.remove('loading');
                            console.log('[OCR Module] Text copied (' + response.charCount + ' chars)');
                            showNotification('Text copied! (' + response.charCount + ' chars)', 'success');

                            setTimeout(function() {
                                button.disabled = false;
                                button.innerHTML = originalContent;
                            }, 2000);
                        })
                        .catch(function(err) {
                            button.innerHTML = '❌';
                            button.classList.remove('loading');
                            console.error('[OCR Module] Copy failed:', err);
                            showNotification('Failed to copy text', 'error');

                            setTimeout(function() {
                                button.disabled = false;
                                button.innerHTML = originalContent;
                            }, 2000);
                        });
                } else if (response.success && !response.hasText) {
                    button.innerHTML = '⚠️';
                    button.classList.remove('loading');
                    console.log('[OCR Module] No text found in image');
                    showNotification('No text found in image', 'warning');

                    setTimeout(function() {
                        button.disabled = false;
                        button.innerHTML = originalContent;
                    }, 2000);
                } else {
                    button.innerHTML = '❌';
                    button.classList.remove('loading');
                    console.error('[OCR Module] Error:', response.error);
                    showNotification('Error: ' + response.error, 'error');

                    setTimeout(function() {
                        button.disabled = false;
                        button.innerHTML = originalContent;
                    }, 2000);
                }
            },
            function(error) {
                // Error
                button.innerHTML = '❌';
                button.classList.remove('loading');
                console.error('[OCR Module] Request failed:', error);
                showNotification('OCR service unavailable', 'error');

                setTimeout(function() {
                    button.disabled = false;
                    button.innerHTML = originalContent;
                }, 2000);
            }
        );
    }

    // ========================================================================
    // UI INTEGRATION
    // ========================================================================

    /**
     * Add OCR button to the info area
     */
    function addOcrButton() {
        var infoLabel = document.querySelector(OCR_CONFIG.INFO_SELECTOR);

        if (!infoLabel) {
            console.warn('[OCR Module] Info label not found, retrying...');
            // Retry after DOM updates (for AJAX-loaded content)
            setTimeout(addOcrButton, 1000);
            return;
        }

        // Check if button already exists
        if (document.getElementById(OCR_CONFIG.BUTTON_ID)) {
            return;
        }

        // Create OCR button
        var button = document.createElement('button');
        button.id = OCR_CONFIG.BUTTON_ID;
        button.className = 'ocr-btn';
        button.title = 'Copy text from image (O)';
        button.innerHTML = '📋';
        button.onclick = function() {
            extractTextFromImage();
        };

        // Insert after info label content
        infoLabel.appendChild(button);

        console.log('[OCR Module] Button added to UI');
    }

    /**
     * Setup keyboard shortcut
     */
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Skip if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }

            // Check for 'O' key (OCR)
            if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                extractTextFromImage();
            }
        });

        console.log('[OCR Module] Keyboard shortcut registered (O key)');
    }

    /**
     * Watch for DOM changes (for dynamically loaded content)
     */
    function setupMutationObserver() {
        var observer = new MutationObserver(function(mutations) {
            // Check if info label was added/changed
            var infoLabel = document.querySelector(OCR_CONFIG.INFO_SELECTOR);
            var button = document.getElementById(OCR_CONFIG.BUTTON_ID);

            if (infoLabel && !button) {
                addOcrButton();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[OCR Module] Mutation observer active');
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize OCR module
     */
    function init() {
        console.log('[OCR Module] Initializing...');

        // Add button to UI
        addOcrButton();

        // Setup keyboard shortcut
        setupKeyboardShortcut();

        // Watch for dynamic content changes
        setupMutationObserver();

        // Expose global function for manual use
        window.extractTextFromImage = extractTextFromImage;

        console.log('[OCR Module] Ready');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, document);
