<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$file = __DIR__ . '/score.json';

function getScore($file) {
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        $data = json_decode($content, true);
        if (is_array($data) && isset($data['win']) && isset($data['loss'])) {
            return $data;
        }
    }
    return ['win' => 0, 'loss' => 0];
}

function saveScore($file, $score) {
    @file_put_contents($file, json_encode($score));
}

$score = getScore($file);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode($score);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if (!$action) {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? '';
        if ($action === 'sync' && isset($input['win']) && isset($input['loss'])) {
            $score['win'] = max(0, (int)$input['win']);
            $score['loss'] = max(0, (int)$input['loss']);
            saveScore($file, $score);
            echo json_encode($score);
            exit;
        }
    }

    switch ($action) {
        case 'win_plus':   $score['win']++; break;
        case 'win_minus':  $score['win'] = max(0, $score['win'] - 1); break;
        case 'loss_plus':  $score['loss']++; break;
        case 'loss_minus': $score['loss'] = max(0, $score['loss'] - 1); break;
        case 'reset':      $score = ['win' => 0, 'loss' => 0]; break;
    }

    saveScore($file, $score);
    echo json_encode($score);
    exit;
}

echo json_encode($score);
