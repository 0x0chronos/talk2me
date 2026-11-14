"""Camada de banco do talk2me.

- Sem variáveis do Turso: SQLite local (comportamento original).
- Com TURSO_DATABASE_URL + TURSO_AUTH_TOKEN: réplica embutida libSQL sincronizada com o Turso.

O driver libsql_experimental devolve tuplas e não aceita row_factory, então os
objetos abaixo reproduzem o que server.py/accounts.py esperam de sqlite3.Row
(acesso por nome e índice, keys(), dict(row)) e traduzem violações de constraint
para sqlite3.IntegrityError.
"""
import logging
import os
import sqlite3
from pathlib import Path

LOG = logging.getLogger('talk2me.db')
ROOT = Path(__file__).resolve().parent

TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
REMOTE = bool(TURSO_URL and TURSO_TOKEN)

_libsql = None
if REMOTE or os.environ.get("TALK2ME_LIBSQL") == "1":  # a 2a opção existe só para testes locais
    try:
        import libsql_experimental as _libsql
    except ImportError:
        if REMOTE:
            raise RuntimeError("TURSO_DATABASE_URL definido, mas libsql_experimental não está instalado")


_first_sync_done = False


def _mark_synced():
    global _first_sync_done
    _first_sync_done = True


def get_db_path():
    if 'TALK2ME_DB' in os.environ:
        return os.environ['TALK2ME_DB']
    try:
        import server
        if hasattr(server, 'DB_PATH'):
            return str(server.DB_PATH)
    except Exception:
        pass
    return str(ROOT / "database.sqlite")


class Row(tuple):
    """Imita sqlite3.Row: row[0], row['col'], row.keys(), dict(row)."""
    def __new__(cls, values, names):
        obj = super().__new__(cls, values)
        obj._names = names
        return obj

    def __getitem__(self, key):
        if isinstance(key, str):
            try:
                return super().__getitem__(self._names.index(key))
            except ValueError:
                raise IndexError("No item with that key") from None
        return super().__getitem__(key)

    def keys(self):
        return list(self._names)


def _translate(error):
    if 'constraint' in str(error).lower():
        return sqlite3.IntegrityError(str(error))
    return error


class Cursor:
    def __init__(self, cur):
        self._cur = cur

    def _names(self):
        return [d[0] for d in (self._cur.description or [])]

    def fetchone(self):
        row = self._cur.fetchone()
        return None if row is None else Row(row, self._names())

    def fetchall(self):
        names = self._names()
        return [Row(r, names) for r in self._cur.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())

    def __getattr__(self, name):
        return getattr(self._cur, name)


class LibsqlConnection:
    def __init__(self, conn, synced):
        self._conn = conn
        self._synced = synced

    def execute(self, sql, params=()):
        try:
            return Cursor(self._conn.execute(sql, params))
        except ValueError as e:
            raise _translate(e) from e

    def executemany(self, sql, seq):
        try:
            return Cursor(self._conn.executemany(sql, seq))
        except ValueError as e:
            raise _translate(e) from e

    def commit(self):
        self._conn.commit()
        self.sync()

    def rollback(self):
        self._conn.rollback()

    def sync(self):
        if self._synced:
            try:
                self._conn.sync()
            except Exception as e:  # sincronizar nunca deve derrubar a requisição
                LOG.warning("Falha ao sincronizar com o Turso: %s", e)

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            self.commit() if exc_type is None else self.rollback()
        finally:
            self.close()


def get_db(timeout=20):
    """Usado por server.py (quem chama fecha a conexão)."""
    path = get_db_path()
    if _libsql is not None:
        if REMOTE:
            conn = _libsql.connect(path, sync_url=TURSO_URL, auth_token=TURSO_TOKEN)
            if not _first_sync_done:  # puxa o estado do Turso uma vez; depois as escritas já atualizam a réplica
                conn.sync()
                _mark_synced()
            return LibsqlConnection(conn, synced=False)
        return LibsqlConnection(_libsql.connect(path), synced=False)
    conn = sqlite3.connect(path, timeout=timeout)
    conn.row_factory = sqlite3.Row
    return conn


class _ManagedSqlite:
    """`with connect() as db`: commit/rollback e fecha, como o AccountConnection original."""
    def __init__(self, conn):
        self._conn = conn

    def __enter__(self):
        return self._conn

    def __exit__(self, exc_type, exc, tb):
        try:
            self._conn.commit() if exc_type is None else self._conn.rollback()
        finally:
            self._conn.close()


def connect():
    """Usado por accounts.py com `with connect() as db`."""
    conn = get_db()
    return conn if isinstance(conn, LibsqlConnection) else _ManagedSqlite(conn)
