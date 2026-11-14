<?php
declare(strict_types=1);
// The document root is site/ (public_html on Hostinger). private/ is its sibling.
ini_set('display_errors', '0');
$site = __DIR__;
$private = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'private';
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$method = $_SERVER['REQUEST_METHOD'];
if (PHP_SAPI === 'cli-server' && $path !== '/') {
    $file = realpath($site . $path);
    if ($file && str_starts_with($file, $site . DIRECTORY_SEPARATOR)
        && is_file($file) && !str_starts_with(basename($file), '.')
        && in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['html','js','css','svg','png','woff2','webmanifest'], true)) {
        return false;
    }
}
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
header('Cache-Control: private, no-store');

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function accounts(): array {
    global $private;
    $file = $private . '/accounts.json';
    if (!is_file($file)) return [];
    $handle = fopen($file, 'r');
    if (!$handle || !flock($handle, LOCK_SH)) respond(['error'=>'Não foi possível ler os acessos.'],503);
    $data = json_decode(stream_get_contents($handle), true);
    flock($handle, LOCK_UN); fclose($handle);
    if (!is_array($data) || count($data) > 2) respond(['error'=>'Confira a configuração dos dois acessos pessoais.'],503);
    return $data;
}
function public_user(array $user): array {
    return ['id'=>$user['id'], 'email'=>$user['email'], 'full_name'=>$user['full_name'], 'role'=>'student'];
}
function matches_password(string $password, array $account): bool {
    return hash_equals($account['hash'], hash_pbkdf2('sha256', $password, $account['salt'], 600000, 64));
}
function throttle(): void {
    global $private;
    $dir = $private . '/attempts';
    if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) respond(['error'=>'Não foi possível proteger o acesso.'],503);
    $key = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $handle = fopen($dir . '/' . $key . '.json', 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) respond(['error'=>'Tente novamente mais tarde.'],503);
    $times = json_decode(stream_get_contents($handle),true) ?: [];
    $times = array_values(array_filter($times, fn($time)=>is_int($time) && $time > time()-300));
    $allowed = count($times) < 20;
    if ($allowed) $times[] = time();
    rewind($handle); ftruncate($handle,0); fwrite($handle,json_encode($times)); fflush($handle);
    flock($handle,LOCK_UN); fclose($handle);
    if (!$allowed) respond(['error'=>'Muitas tentativas. Aguarde cinco minutos.'],429);
}
function stream_file(string $file, string $mime): never {
    global $method;
    if (!is_file($file)) respond(['error'=>'Conteúdo ainda não enviado à hospedagem.'],503);
    $size = filesize($file);
    $start = 0; $end = $size - 1;
    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');
    if (isset($_SERVER['HTTP_RANGE'])) {
        $range = $_SERVER['HTTP_RANGE'];
        $ok = preg_match('/^bytes=(\d*)-(\d*)$/D', $range, $m) && ($m[1] !== '' || $m[2] !== '');
        if ($ok) {
            if ($m[1] === '') { $suffix = (int)$m[2]; $ok = $suffix > 0; $start = max(0,$size-$suffix); }
            else { $start = (int)$m[1]; if ($m[2] !== '') $end = min($end,(int)$m[2]); }
            $ok = $ok && $start < $size && $start <= $end;
        }
        if (!$ok) {
            http_response_code(416); header('Content-Range: bytes */' . $size); header('Content-Length: 0'); exit;
        }
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
    }
    $length = max(0,$end-$start+1);
    header('Content-Length: ' . $length);
    if ($method === 'HEAD') exit;
    while (ob_get_level()) ob_end_clean();
    $handle = fopen($file,'rb');
    if (!$handle) exit;
    fseek($handle,$start);
    while ($length > 0 && !connection_aborted()) {
        $chunk = fread($handle,min(65536,$length));
        if ($chunk === false || $chunk === '') break;
        echo $chunk; $length -= strlen($chunk); flush();
    }
    fclose($handle); exit;
}

if (!in_array($method, ['GET','HEAD','POST'],true)) respond(['error'=>'Método não permitido.'],405);
if ($path === '/' && $method !== 'POST') stream_file($site . '/index.html', 'text/html; charset=utf-8');
if (!is_dir($private)) respond(['error'=>'A pasta privada ainda não foi configurada.'],503);
$sessions = $private . '/sessions';
if (!is_dir($sessions) && !mkdir($sessions,0700,true) && !is_dir($sessions)) respond(['error'=>'Não foi possível iniciar o acesso.'],503);
$isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1','::1'], true) && PHP_SAPI === 'cli-server';
session_save_path($sessions);
session_name('talk2me_personal');
ini_set('session.use_strict_mode','1');
ini_set('session.gc_maxlifetime','2592000');
session_set_cookie_params(['lifetime'=>2592000, 'path'=>'/', 'secure'=>!$isLocal, 'httponly'=>true, 'samesite'=>'Strict']);
session_start();
$all = accounts();
$user = null;
foreach ($all as $account) {
    if (($account['id'] ?? null) === ($_SESSION['uid'] ?? null)
        && hash_equals($account['version'], $_SESSION['version'] ?? '')) $user = $account;
}

if ($method === 'POST') {
    if (strtolower($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') respond(['error'=>'Origem não permitida.'],403);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $parts = parse_url($origin);
        $originHost = ($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '');
        if (strtolower($originHost) !== strtolower($_SERVER['HTTP_HOST'] ?? '')) respond(['error'=>'Origem não permitida.'],403);
    }
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) respond(['error'=>'Envie JSON.'],415);
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length < 2 || $length > 16384) respond(['error'=>'Solicitação inválida.'],413);
    $input = json_decode(file_get_contents('php://input', false, null, 0, 16385),true);
    if (!is_array($input)) respond(['error'=>'Solicitação inválida.'],400);
    if ($path === '/api/auth/login') {
        throttle();
        $email = strtolower(trim(is_string($input['email'] ?? null) ? $input['email'] : ''));
        $password = $input['password'] ?? '';
        if (!is_string($password) || strlen($password) > 512) respond(['error'=>'Credenciais inválidas.'],400);
        $match = null;
        foreach ($all as $account) { if ($account['email'] === $email) $match = $account; }
        $candidate = $match ?? ['hash'=>str_repeat('0',64),'salt'=>'invalid-user-salt'];
        if (!matches_password($password,$candidate) || !$match) respond(['error'=>'E-mail ou senha incorretos.'],401);
        session_regenerate_id(true);
        $_SESSION = ['uid'=>$match['id'], 'version'=>$match['version']];
        respond(['ok'=>true,'user'=>public_user($match)]);
    }
    if ($path === '/api/auth/logout') {
        $_SESSION = []; session_destroy();
        setcookie(session_name(), '', ['expires'=>1,'path'=>'/','secure'=>!$isLocal,'httponly'=>true,'samesite'=>'Strict']);
        respond(['ok'=>true]);
    }
    if (!$user) respond(['error'=>'Entre para continuar.'],401);
    if ($path === '/api/auth/password') {
        throttle();
        $old = $input['current_password'] ?? null; $new = $input['new_password'] ?? null;
        $newLength = is_string($new) ? preg_match_all('/./us',$new) : 0;
        if (!is_string($old) || strlen($old)>512 || $newLength<10 || $newLength>128) respond(['error'=>'Use uma senha de 10 a 128 caracteres.'],400);
        $handle = fopen($private . '/accounts.json','r+');
        if (!$handle || !flock($handle,LOCK_EX)) respond(['error'=>'Não foi possível salvar a senha.'],503);
        $fresh = json_decode(stream_get_contents($handle),true);
        $changed = null;
        foreach ($fresh as &$entry) {
            if ($entry['id'] === $user['id'] && hash_equals($entry['version'],$user['version']) && matches_password($old,$entry)) {
                $entry['salt'] = bin2hex(random_bytes(16));
                $entry['hash'] = hash_pbkdf2('sha256',$new,$entry['salt'],600000,64);
                $entry['version'] = bin2hex(random_bytes(16)); $changed=$entry;
            }
        }
        unset($entry);
        if ($changed) {
            rewind($handle); ftruncate($handle,0);
            fwrite($handle,json_encode($fresh, JSON_UNESCAPED_UNICODE)); fflush($handle);
        }
        flock($handle,LOCK_UN); fclose($handle);
        if (!$changed) respond(['error'=>'Senha atual incorreta ou acesso expirado.'],400);
        session_regenerate_id(true); $_SESSION['version']=$changed['version'];
        respond(['ok'=>true]);
    }
    respond(['error'=>'Não encontrado.'],404);
}
if ($path === '/api/auth/config') respond(['configured'=>count($all)>0,'authenticated'=>$user!==null,'user'=>$user ? public_user($user) : null]);
if (!$user) respond(['error'=>'Entre para continuar.'],401);
// Release the session lock before streaming: video must not block audio/API requests.
session_write_close();
if ($path === '/api/course') stream_file($private . '/course.json','application/json; charset=utf-8');
if (preg_match('~^/api/lesson/([a-zA-Z0-9_-]{1,120})$~D',$path,$match)) {
    $file = $private . '/lessons/' . $match[1] . '.json';
    if (!is_file($file)) respond(['error'=>'Aula não encontrada.'],404);
    stream_file($file,'application/json; charset=utf-8');
}
if (preg_match('~^/m/([\w.-]{1,180})$~D',$path,$match)) {
    $index = json_decode(file_get_contents($private . '/media.json'),true);
    $name = $match[1];
    if (!isset($index[$name])) respond(['error'=>'Mídia não encontrada.'],404);
    $file = $private . '/media/' . $name;
    if (!is_file($file) || filesize($file) !== $index[$name]['bytes']) respond(['error'=>'Esta mídia ainda não foi enviada completamente.'],503);
    $types = ['mp4'=>'video/mp4','mp3'=>'audio/mpeg','png'=>'image/png','webp'=>'image/webp'];
    stream_file($file, $types[strtolower(pathinfo($name,PATHINFO_EXTENSION))] ?? 'application/octet-stream');
}
respond(['error'=>'Não encontrado.'],404);
