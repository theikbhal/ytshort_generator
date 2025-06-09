<?php
header('Content-Type: application/json');

$response = [
    'success' => false,
    'message' => 'An unknown error occurred.',
    'filePath' => null
];

// Define the directory where JSON files will be stored
$uploadDir = __DIR__ . '/json/';
$baseUrl = 'http://tawhid.in/tiny/videos/1000videos/day2/json/'; // Adjust this to your actual public URL

// Create the upload directory if it doesn't exist
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0777, true)) {
        $response['message'] = 'Failed to create upload directory.';
        echo json_encode($response);
        exit;
    }
}

// Get JSON data from the request body
$jsonData = file_get_contents('php://input');
$data = json_decode($jsonData, true);

if ($data === null) {
    $response['message'] = 'Invalid JSON data.';
    echo json_encode($response);
    exit;
}

// Check if a custom filename is provided as a query string parameter
$customFileName = isset($_GET['filename']) ? $_GET['filename'] : null;

if ($customFileName) {
    // Sanitize the custom filename
    $customFileName = preg_replace('/[^a-zA-Z0-9_.-]/', '', $customFileName);
    $newFileName = $customFileName;
} else {
    // Generate a unique filename if no custom filename is provided
    $newFileName = md5(time() . uniqid()) . '.json';
}

$destPath = $uploadDir . $newFileName;

// Save the JSON data to a file
if (file_put_contents($destPath, $jsonData)) {
    $response['success'] = true;
    $response['message'] = 'JSON data saved successfully.';
    $response['filePath'] = $baseUrl . $newFileName;
} else {
    $response['message'] = 'There was an error saving the JSON data.';
}

echo json_encode($response);
?> 