"""Prepare pinned, same-origin Spanish speech assets for the browser (Apache-2.0)."""
import base64
import hashlib
import io
from pathlib import Path
import re
import tarfile
import urllib.request
import zipfile

dest = Path(__file__).resolve().parents[1] / 'public' / 'speech-es'
dest.mkdir(parents=True, exist_ok=True)


def download(url, digest):
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f'Unexpected file digest for {url}')
    return io.BytesIO(data)


package = download('https://registry.npmjs.org/vosk-browser/-/vosk-browser-0.0.8.tgz',
                   'fd16fc7e64c935d7a79cf07c8f67d84232b6485376a59144af8a234979a9a4b4')
with tarfile.open(fileobj=package) as archive:
    bundle = archive.extractfile('package/dist/vosk.js').read()
worker = base64.b64decode(re.search(rb"createBase64WorkerFactory\('([^']+)'", bundle)[1])
# Serve the upstream worker from its own URL. Mark the final response after teardown
# so a pause within a recording cannot finish the entire exercise prematurely.
marker = b'this.recognizers.delete(recognizerId);'
start = worker.index(marker)
worker = worker[:start] + worker[start:].replace(b'event: "result"', b'event: "finished"', 1)
# Cache the compressed archive in the worker instead of duplicating the expanded
# filesystem in IndexedDB. The upstream SDK extracts the archive in memory.
worker = worker.replace(b'this.Vosk.FS.mount(this.Vosk.IDBFS, {}, storagePath);', b'')
for flag in (b'true', b'false'):
    worker = worker.replace(b'this.Vosk.syncFilesystem(' + flag + b')', b'Promise.resolve()')
worker = worker.replace(b'this.logger.debug(JSON.stringify(message));', b'')
cache_model = b"""
const networkFetch = self.fetch.bind(self);
self.fetch = async (request, options) => {
    if (new URL(request.url || request, self.location.href).pathname !== '/speech-es/spanish-042.tar.gz')
        return networkFetch(request, options);
    const cache = await caches.open('talk2me-speech-es-042');
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await networkFetch(request, options);
    if (response.ok) await cache.put(request, response.clone());
    return response;
};
"""
(dest / 'worker-008.js').write_bytes(cache_model + worker)

model = download('https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
                 '09b239888f633ef2f0b4e09736e3d9936acfd810bc65d53fad45261762c6511f')
with zipfile.ZipFile(model) as source, tarfile.open(dest / 'spanish-042.tar.gz', 'w:gz', compresslevel=3) as target:
    directories = set()
    for entry in source.infolist():
        if entry.is_dir():
            continue
        info = tarfile.TarInfo('model/' + entry.filename.split('/', 1)[1])
        for folder in reversed(Path(info.name).parents):
            if folder != Path('.') and folder not in directories:
                directory = tarfile.TarInfo(folder.as_posix())
                directory.type = tarfile.DIRTYPE
                directory.mode = 0o755
                target.addfile(directory)
                directories.add(folder)
        info.size = entry.file_size
        with source.open(entry) as stream:
            target.addfile(info, stream)
