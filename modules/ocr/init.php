<?php
declare(strict_types=1);

/**
 * OCR Module Initialization
 *
 * Checks if OCR is properly configured and all requirements are met.
 * Returns false if module should not be loaded.
 *
 * @category  Modules
 * @package   OCR
 * @author    Net Storm
 * @version   1.0.0
 */

// Check if api-keys.php exists and is loaded
$apiKeysFile = dirname(__DIR__, 2) . '/config/api-keys.php';

if (!file_exists($apiKeysFile)) {
    error_log('[OCR Module] config/api-keys.php not found');
    return false;
}

// Load api-keys if not already loaded
if (!defined('OCR_ENABLED')) {
    require_once $apiKeysFile;
}

// Check if OCR is enabled in config
if (!defined('OCR_ENABLED') || !OCR_ENABLED) {
    error_log('[OCR Module] OCR not enabled in api-keys.php');
    return false;
}

// Check if API key is configured (not the placeholder)
if (!defined('GOOGLE_VISION_API_KEY') || GOOGLE_VISION_API_KEY === 'YOUR_API_KEY_HERE') {
    error_log('[OCR Module] Google Vision API key not configured');
    return false;
}

// Check if ocr.php endpoint exists
$ocrEndpoint = dirname(__DIR__, 2) . '/ocr.php';
if (!file_exists($ocrEndpoint)) {
    error_log('[OCR Module] ocr.php endpoint not found');
    return false;
}

// All checks passed
return true;
