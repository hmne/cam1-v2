<?php
/**
 * OCR Proxy for Google Cloud Vision API
 *
 * Extracts text from captured images using Google Vision API.
 * Keeps API key secure on server side.
 *
 * @category  OCR
 * @package   CameraControl
 * @author    Net Storm
 * @version   1.0.0
 */

declare(strict_types=1);

require_once __DIR__ . '/config/app-config.php';
require_once __DIR__ . '/includes/utilities.php';

// Load API keys (file is gitignored for security)
$apiKeysFile = __DIR__ . '/config/api-keys.php';
if (file_exists($apiKeysFile)) {
    require_once $apiKeysFile;
}

// Set headers
sendAjaxHeaders('application/json');
sendNoCacheHeaders();

// Check if OCR is enabled
if (!defined('OCR_ENABLED') || !OCR_ENABLED) {
    sendJsonResponse([
        'success' => false,
        'error' => 'OCR not configured. Add API key to config/api-keys.php'
    ], 503);
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'error' => 'Method not allowed'
    ], 405);
}

// Get image path from request
$imagePath = $_POST['image'] ?? 'pic.jpg';

// Validate image path (security: only allow specific files)
$allowedImages = ['pic.jpg', 'live.jpg', 'test.jpg'];
if (!in_array($imagePath, $allowedImages, true)) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Invalid image path'
    ], 400);
}

// Check if image exists
$fullPath = __DIR__ . '/' . $imagePath;
if (!file_exists($fullPath)) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Image not found'
    ], 404);
}

// Check file size
$fileSize = filesize($fullPath);
if ($fileSize > OCR_MAX_FILE_SIZE) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Image too large (max 4MB)'
    ], 413);
}

// Read and encode image
$imageData = file_get_contents($fullPath);
if ($imageData === false) {
    sendJsonResponse([
        'success' => false,
        'error' => 'Failed to read image'
    ], 500);
}

$base64Image = base64_encode($imageData);

// Prepare Google Vision API request
$apiUrl = 'https://vision.googleapis.com/v1/images:annotate?key=' . GOOGLE_VISION_API_KEY;

$requestBody = [
    'requests' => [
        [
            'image' => [
                'content' => $base64Image
            ],
            'features' => [
                [
                    'type' => 'TEXT_DETECTION',
                    'maxResults' => 1
                ]
            ],
            'imageContext' => [
                'languageHints' => ['en', 'ar'] // English and Arabic
            ]
        ]
    ]
];

// Send request to Google Vision API
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $apiUrl,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($requestBody),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Handle curl errors
if ($response === false) {
    logMessage("OCR curl error: $curlError", 'ERROR');
    sendJsonResponse([
        'success' => false,
        'error' => 'Failed to connect to OCR service'
    ], 502);
}

// Parse response
$result = json_decode($response, true);

if ($httpCode !== 200) {
    $errorMessage = $result['error']['message'] ?? 'Unknown API error';
    logMessage("OCR API error: $errorMessage (HTTP $httpCode)", 'ERROR');
    sendJsonResponse([
        'success' => false,
        'error' => "API error: $errorMessage"
    ], $httpCode);
}

// Extract text from response
$extractedText = '';
if (isset($result['responses'][0]['fullTextAnnotation']['text'])) {
    $extractedText = $result['responses'][0]['fullTextAnnotation']['text'];
} elseif (isset($result['responses'][0]['textAnnotations'][0]['description'])) {
    $extractedText = $result['responses'][0]['textAnnotations'][0]['description'];
}

// Return success response
sendJsonResponse([
    'success' => true,
    'text' => $extractedText,
    'hasText' => !empty($extractedText),
    'charCount' => strlen($extractedText)
]);
