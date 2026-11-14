"""Database connection layer for talk2me.
Supports local SQLite and Turso cloud database (via libSQL embedded replica).
"""
import os
import sqlite3
import logging
from pathlib import Path

LOG = logging.getLogger('talk2me.db')
ROOT = Path(__file__).resolve().parent

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

TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

_libsql = None
if TURSO_URL and TURSO_TOKEN:
    try:
        import libsql_experimental as _libsql
        LOG.info("libSQL driver loaded for Turso integration")
    except ImportError:
        LOG.warning("TURSO_DATABASE_URL set but libsql_experimental not installed; falling back to SQLite")
        _libsql = None


def get_raw_connection(timeout=20):
    """Returns raw connection, configured with Turso replica or standard SQLite."""
    path = get_db_path()
    if TURSO_URL and TURSO_TOKEN and _libsql:
        conn = _libsql.connect(path, sync_url=TURSO_URL, auth_token=TURSO_TOKEN, timeout=timeout)
        conn.row_factory = sqlite3.Row
        return conn

    conn = sqlite3.connect(path, timeout=timeout)
    conn.row_factory = sqlite3.Row
    return conn


def sync_replica(conn=None):
    """Synchronizes the local replica with Turso."""
    if TURSO_URL and TURSO_TOKEN and _libsql:
        try:
            should_close = False
            if conn is None:
                conn = get_raw_connection()
                should_close = True
            if hasattr(conn, 'sync'):
                conn.sync()
            if should_close:
                conn.close()
        except Exception as e:
            LOG.warning("Failed to sync with Turso: %s", e)


class ManagedAccountConnection:
    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __enter__(self):
        return self._conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None:
                self._conn.commit()
                if hasattr(self._conn, 'sync'):
                    try:
                        self._conn.sync()
                    except Exception:
                        pass
            else:
                self._conn.rollback()
        finally:
            self._conn.close()


def connect():
    """Used by accounts.py with context manager syntax."""
    return ManagedAccountConnection(get_raw_connection(timeout=20))


def get_db():
    """Used by server.py."""
    return get_raw_connection(timeout=20)
