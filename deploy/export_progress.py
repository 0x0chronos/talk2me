"""Create a private SQLite snapshot for migration without exposing live files."""
from datetime import datetime
from pathlib import Path
import sqlite3
from contextlib import closing

root = Path(__file__).resolve().parents[1]
dest = root / 'backups' / ('progresso-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.sqlite')
dest.parent.mkdir(exist_ok=True)
with closing(sqlite3.connect((root / 'database.sqlite').as_uri() + '?mode=ro', uri=True)) as src, closing(sqlite3.connect(dest)) as dst:
    src.backup(dst)
    assert dst.execute('pragma integrity_check').fetchone()[0] == 'ok'
print(dest)
