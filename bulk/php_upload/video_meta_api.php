<?php
header('Content-Type: application/json');
require_once 'config.php';

// Helper function to send JSON response
function sendResponse($success, $message, $data = null) {
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = explode('/', trim($path, '/'));

// Handle different API endpoints
switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Get single record
            $stmt = getDbConnection()->prepare("SELECT * FROM video_meta WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            sendResponse(true, 'Record retrieved', $result);
        } else {
            // Get multiple records with pagination and filters
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
            $offset = ($page - 1) * $limit;
            
            $where = [];
            $params = [];
            
            // Add filters if provided
            $filterFields = ['title', 'youtube_url', 'local_path', 'php_server_path'];
            foreach ($filterFields as $field) {
                if (isset($_GET[$field])) {
                    $where[] = "$field LIKE ?";
                    $params[] = "%{$_GET[$field]}%";
                }
            }
            
            $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
            
            $sql = "SELECT * FROM video_meta $whereClause LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = getDbConnection()->prepare($sql);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get total count for pagination
            $countSql = "SELECT COUNT(*) FROM video_meta $whereClause";
            $countStmt = getDbConnection()->prepare($countSql);
            $countStmt->execute(array_slice($params, 0, -2));
            $total = $countStmt->fetchColumn();
            
            sendResponse(true, 'Records retrieved', [
                'data' => $results,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total
                ]
            ]);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (isset($data['bulk']) && $data['bulk']) {
            // Bulk create
            $stmt = getDbConnection()->prepare("INSERT INTO video_meta (title, youtube_url, local_path, php_server_path) VALUES (?, ?, ?, ?)");
            $success = true;
            $inserted = [];
            
            foreach ($data['records'] as $record) {
                try {
                    $stmt->execute([
                        $record['title'],
                        $record['youtube_url'] ?? null,
                        $record['local_path'] ?? null,
                        $record['php_server_path'] ?? null
                    ]);
                    $inserted[] = getDbConnection()->lastInsertId();
                } catch (Exception $e) {
                    $success = false;
                }
            }
            
            sendResponse($success, $success ? 'Records created' : 'Some records failed to create', $inserted);
        } else {
            // Single create
            $stmt = getDbConnection()->prepare("INSERT INTO video_meta (title, youtube_url, local_path, php_server_path) VALUES (?, ?, ?, ?)");
            try {
                $stmt->execute([
                    $data['title'],
                    $data['youtube_url'] ?? null,
                    $data['local_path'] ?? null,
                    $data['php_server_path'] ?? null
                ]);
                sendResponse(true, 'Record created', ['id' => getDbConnection()->lastInsertId()]);
            } catch (Exception $e) {
                sendResponse(false, 'Failed to create record: ' . $e->getMessage());
            }
        }
        break;

    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (isset($data['bulk']) && $data['bulk']) {
            // Bulk update
            $stmt = getDbConnection()->prepare("UPDATE video_meta SET title = ?, youtube_url = ?, local_path = ?, php_server_path = ? WHERE id = ?");
            $success = true;
            
            foreach ($data['records'] as $record) {
                try {
                    $stmt->execute([
                        $record['title'],
                        $record['youtube_url'] ?? null,
                        $record['local_path'] ?? null,
                        $record['php_server_path'] ?? null,
                        $record['id']
                    ]);
                } catch (Exception $e) {
                    $success = false;
                }
            }
            
            sendResponse($success, $success ? 'Records updated' : 'Some records failed to update');
        } else {
            // Single update
            $stmt = getDbConnection()->prepare("UPDATE video_meta SET title = ?, youtube_url = ?, local_path = ?, php_server_path = ? WHERE id = ?");
            try {
                $stmt->execute([
                    $data['title'],
                    $data['youtube_url'] ?? null,
                    $data['local_path'] ?? null,
                    $data['php_server_path'] ?? null,
                    $data['id']
                ]);
                sendResponse(true, 'Record updated');
            } catch (Exception $e) {
                sendResponse(false, 'Failed to update record: ' . $e->getMessage());
            }
        }
        break;

    case 'PATCH':
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'];
        unset($data['id']);
        
        $updates = [];
        $params = [];
        foreach ($data as $key => $value) {
            if (in_array($key, ['title', 'youtube_url', 'local_path', 'php_server_path'])) {
                $updates[] = "$key = ?";
                $params[] = $value;
            }
        }
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = "UPDATE video_meta SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = getDbConnection()->prepare($sql);
            try {
                $stmt->execute($params);
                sendResponse(true, 'Record partially updated');
            } catch (Exception $e) {
                sendResponse(false, 'Failed to update record: ' . $e->getMessage());
            }
        } else {
            sendResponse(false, 'No valid fields to update');
        }
        break;

    case 'DELETE':
        if (isset($_GET['id'])) {
            // Single delete
            $stmt = getDbConnection()->prepare("DELETE FROM video_meta WHERE id = ?");
            try {
                $stmt->execute([$_GET['id']]);
                sendResponse(true, 'Record deleted');
            } catch (Exception $e) {
                sendResponse(false, 'Failed to delete record: ' . $e->getMessage());
            }
        } else if (isset($_GET['bulk']) && $_GET['bulk']) {
            // Bulk delete
            $ids = json_decode($_GET['ids'], true);
            $placeholders = str_repeat('?,', count($ids) - 1) . '?';
            $stmt = getDbConnection()->prepare("DELETE FROM video_meta WHERE id IN ($placeholders)");
            try {
                $stmt->execute($ids);
                sendResponse(true, 'Records deleted');
            } catch (Exception $e) {
                sendResponse(false, 'Failed to delete records: ' . $e->getMessage());
            }
        } else {
            sendResponse(false, 'No ID provided for deletion');
        }
        break;

    default:
        sendResponse(false, 'Method not allowed');
        break;
}
?> 