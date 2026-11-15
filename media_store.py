"""Read-only Drive origin, verified disk cache and bounded concurrent transfers."""
import hashlib
import json
import logging
import os
import queue
import shutil
import subprocess
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX = json.loads((ROOT / 'media-index.json').read_text(encoding='utf8'))
CACHE = Path(os.getenv('TALK2ME_CACHE_DIR', ROOT / '.drive-cache')).resolve()
PACKAGED_VISUALS = Path("/opt/talk2me-visuals")
PACKAGED_AUDIO = Path("/opt/talk2me-audio")
LIMIT = int(os.getenv('TALK2ME_CACHE_MB', '2048')) * 1024 * 1024
REMOTE = os.getenv('TALK2ME_DRIVE', 'talk2me-drive:talk2me').rstrip('/')
LOCK = threading.RLock()
ACTIVE = {}
SLOTS = threading.BoundedSemaphore(3)
STRIPES = [threading.Lock() for _ in range(64)]
LOG = logging.getLogger('talk2me.media')
verified = {}
retry_after = {}

def executable():
    command = os.getenv('TALK2ME_RCLONE') or shutil.which('rclone')
    if not command and os.name == 'nt':
        packages = Path(os.getenv('LOCALAPPDATA', '')) / 'Microsoft/WinGet/Packages'
        command = next(packages.glob('Rclone.Rclone*/**/rclone.exe'), None)
    if not command:
        raise OSError('rclone indisponível')
    return str(command)

def valid(path, size, digest):
    try:
        stat = path.stat()
        if stat.st_size != size:
            return False
        if verified.get(path) != (stat.st_mtime_ns, digest):
            with path.open('rb') as stream:
                if hashlib.file_digest(stream, 'md5').hexdigest() != digest:
                    return False
            verified[path] = (stat.st_mtime_ns, digest)
        return True
    except FileNotFoundError:
        return False

def evict():
    # Only manage files in this cache, identified by their content hashes.
    with LOCK:
        entries = [(p.stat().st_atime_ns, p.stat().st_size, p) for p in CACHE.glob('*.blob')]
        total = sum(size for _, size, _ in entries)
        for _, size, path in sorted(entries):
            if total <= LIMIT:
                break
            if path in ACTIVE:
                continue
            path.unlink(missing_ok=True)
            verified.pop(path, None)
            total -= size

def download(key, dest, size, digest):
    CACHE.mkdir(parents=True, exist_ok=True)
    with SLOTS, tempfile.TemporaryDirectory(dir=CACHE, prefix='fetch-') as tmp:
        part = Path(tmp) / 'payload'
        command = [executable(), 'copyto', REMOTE + '/' + key, str(part),
                   '--retries','2','--low-level-retries','3','--contimeout','10s','--timeout','45s']
        if key.endswith('.mp4') and size >= 32 * 1024 * 1024:
            # Fetch ranges of large originals concurrently into the same temporary file.
            command.extend(['--multi-thread-cutoff', '32M', '--multi-thread-streams', '3',
                            '--buffer-size', '1M'])
        subprocess.run(command, check=True, timeout=240, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not valid(part, size, digest):
            raise OSError('Mídia recebida diverge do índice')
        verified.pop(part, None)
        os.replace(part, dest)
        verified[dest] = (dest.stat().st_mtime_ns, digest)

@contextmanager
def media_file(key):
    if key not in INDEX:
        raise FileNotFoundError(key)
    size, digest = INDEX[key]
    if key.endswith('.mp3'):
        original = PACKAGED_AUDIO / (digest + '.mp3')
        if valid(original, size, digest):
            yield original
            return
    elif key.startswith('media_all/'):
        original = PACKAGED_VISUALS / Path(key).name
        if valid(original, size, digest):
            yield original
            return
    dest = CACHE / (digest + '.blob')
    with LOCK:
        ACTIVE[dest] = ACTIVE.get(dest, 0) + 1
    try:
        with STRIPES[int(digest[:2], 16) % len(STRIPES)]:
            source = dest
            if not valid(dest, size, digest):
                try:
                    if time.monotonic() < retry_after.get(key, 0):
                        raise OSError('Aguardando nova tentativa')
                    download(key, dest, size, digest)
                    retry_after.pop(key, None)
                except (OSError, subprocess.SubprocessError) as error:
                    if time.monotonic() >= retry_after.get(key, 0):
                        LOG.warning('Drive fetch failed for %s (%s, exit=%s)', key, type(error).__name__, getattr(error, 'returncode', None))
                        retry_after[key] = time.monotonic() + 5
                    source = ROOT / key
                    if os.getenv('TALK2ME_LOCAL_FALLBACK','1') != '1' or not valid(source, size, digest):
                        raise OSError('Mídia temporariamente indisponível') from error
                    LOG.warning('Usando cópia local verificada: %s', key)
        yield source
    finally:
        with LOCK:
            ACTIVE[dest] -= 1
            if not ACTIVE[dest]:
                del ACTIVE[dest]
        # Eviction only after transfers, not on every byte-range request.
        if CACHE.exists() and time.monotonic() >= getattr(evict,'next_check',0):
            evict.next_check = time.monotonic() + 10
            evict()


# One background reader leaves the remaining Drive transfer slots for student requests.
_warm_queue = queue.Queue(maxsize=12)
_warming = set()
_warm_thread = None

def _warm_visuals():
    while True:
        key = _warm_queue.get()
        try:
            with media_file(key):
                pass
        except OSError:
            pass  # Normal requests retry via the same verified cache.
        finally:
            with LOCK:
                _warming.discard(key)
            _warm_queue.task_done()

def prepare_visuals(keys):
    global _warm_thread
    with LOCK:
        for key in keys:
            if key not in INDEX or key in _warming or key.endswith('.mp3'):
                continue
            try:
                _warm_queue.put_nowait(key)
            except queue.Full:
                break
            _warming.add(key)
        if _warming and _warm_thread is None:
            _warm_thread = threading.Thread(target=_warm_visuals, daemon=True)
            _warm_thread.start()
