"""Disposable UI verification server; never opens the student's database."""
import tempfile
from pathlib import Path
import server
import accounts

if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as directory:
        server.DB_PATH=str(Path(directory)/'ui.sqlite')
        accounts.DB=Path(server.DB_PATH)
        server.init_db();server.build_index();accounts.migrate()
        accounts.provision('qa@example.test','Test-only-password-2026','QA',True)
        server.Server(('127.0.0.1',3002),accounts.secure_handler(server.Handler)).serve_forever()
