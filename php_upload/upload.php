<?php
header('Content-Type: application/json');

$response = [
    'success' => false,
    'message' => 'An unknown error occurred.',
    'videoPath' => null
];

// Define the directory where videos will be stored
$uploadDir = __DIR__ . '/videos/';
$baseUrl = 'http://tawhid.in/tiny/videos/1000videos/day2/videos/'; // IMPORTANT: Adjust this to your actual public URL

// Create the upload directory if it doesn't exist
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0777, true)) {
        $response['message'] = 'Failed to create upload directory.';
        echo json_encode($response);
        exit;
    }
}

// Check if a file was uploaded
if (isset($_FILES['videoFile']) && $_FILES['videoFile']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath = $_FILES['videoFile']['tmp_name'];
    $fileName = basename($_FILES['videoFile']['name']);
    $fileSize = $_FILES['videoFile']['size'];
    $fileType = $_FILES['videoFile']['type'];
    $fileNameCmps = explode(".", $fileName);
    $fileExtension = strtolower(end($fileNameCmps));

    // Sanitize filename and create a unique name
    $newFileName = md5(time() . $fileName) . '.' . $fileExtension;
    $destPath = $uploadDir . $newFileName;

    // Allowed file extensions
    $allowedfileExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];

    if (in_array($fileExtension, $allowedfileExtensions)) {
        if (move_uploaded_file($fileTmpPath, $destPath)) {
            $response['success'] = true;
            $response['message'] = 'File uploaded successfully.';
            $response['videoPath'] = $baseUrl . $newFileName;
        } else {
            $response['message'] = 'There was an error moving the uploaded file.';
        }
    } else {
        $response['message'] = 'Upload failed. Allowed file types: ' . implode(',', $allowedfileExtensions);
    }
} else {
    $response['message'] = 'No file uploaded or there was an upload error: ' . $_FILES['videoFile']['error'];
}

echo json_encode($response);
?> 