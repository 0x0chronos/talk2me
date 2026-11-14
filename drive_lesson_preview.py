"""Isolated preview. Serve only the pilot lesson's media from a loopback rclone HTTP remote."""
import os
import shutil
import tempfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import Request, urlopen

import accounts
import server

ROOT = Path(__file__).resolve().parent
FILES = set((ROOT / 'backups/adjetivos-midias.txt').read_text(encoding='utf-8').splitlines())


class Pilot(server.Handler):
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith('/m/') or path[3:] not in FILES:
            return super().do_GET()
        cache = os.environ.get('TALK2ME_DRIVE_PILOT_CACHE')
        if cache:
            # This isolated directory contains only files downloaded from the Drive remote.
            return self.serve_file(str(Path(cache) / path[3:]), cache=False)
        headers = {'Range': self.headers['Range']} if self.headers.get('Range') else {}
        request = Request('http://127.0.0.1:53701/' + quote(path[3:]), headers=headers)
        try:
            source = urlopen(request, timeout=45)
        except HTTPError as error:
            return self.send_error(error.code)
        except URLError:
            return self.send_error(502, 'Drive media unavailable')
        with source:
            self.send_response(source.status)
            for key in ('Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'):
                if key in source.headers:
                    self.send_header(key, source.headers[key])
            self.send_header('X-Talk2me-Media', 'rclone-pilot')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.close_connection = True
            try:
                shutil.copyfileobj(source, self.wfile, 65536)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as folder:
        server.DB_PATH = str(Path(folder) / 'pilot.sqlite')
        accounts.DB = Path(server.DB_PATH)
        server.init_db()
        server.build_index()
        accounts.migrate()
        accounts.provision('qa@example.test', 'Test-only-password-2026', 'Teste', True)
        server.Server(('127.0.0.1', 3003), accounts.secure_handler(Pilot)).serve_forever()
