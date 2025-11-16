<?php
/**
 * API Keys Configuration
 *
 * INSTRUCTIONS:
 * 1. Get your API Key from Google Cloud Console:
 *    - Go to: APIs & Services → Credentials
 *    - Click: + CREATE CREDENTIALS → API key
 *    - Copy the key (starts with AIza...)
 *
 * 2. Paste your key below between the quotes
 *
 * 3. IMPORTANT: Restrict your API key for security:
 *    - Application restrictions: HTTP referrers
 *    - Add: https://netstorm.site/*
 *    - API restrictions: Cloud Vision API only
 *
 * @category  Configuration
 * @package   CameraControl
 * @author    Net Storm
 */

declare(strict_types=1);

// =============================================================================
// PASTE YOUR GOOGLE CLOUD VISION API KEY HERE
// =============================================================================

define('GOOGLE_VISION_API_KEY', 'YOUR_API_KEY_HERE');

// =============================================================================
// DO NOT MODIFY BELOW THIS LINE
// =============================================================================

// Enable OCR only if API key is set
define('OCR_ENABLED', GOOGLE_VISION_API_KEY !== 'YOUR_API_KEY_HERE' && !empty(GOOGLE_VISION_API_KEY));

// Maximum file size for Vision API (4MB limit)
define('OCR_MAX_FILE_SIZE', 4 * 1024 * 1024);

// Language hints for better accuracy
define('OCR_LANGUAGE_HINTS', ['en', 'ar']);
