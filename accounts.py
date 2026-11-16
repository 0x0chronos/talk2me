"""Local accounts. No public enrollment or test-mode bypass."""
import hashlib
import json
import os
import re
import secrets
import sqlite3
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from http.cookies import SimpleCookie
from urllib.parse import urlparse
from pathlib import Path
import db

DB = Path(os.getenv('TALK2ME_DB', Path(__file__).with_name('database.sqlite')))
LOCK = threading.Lock()
ATTEMPTS = {}

class AccountConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()

def connect():
    return db.connect()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600000).hex()

def validate(email, password):
    if not isinstance(email, str) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or len(email) > 254:
        raise ValueError('Informe um e-mail válido.')
    if not isinstance(password, str) or not 10 <= len(password) <= 128:
        raise ValueError('Use uma senha de 10 a 128 caracteres.')

def migrate():
    with connect() as db:
        db.execute('CREATE TABLE IF NOT EXISTS finish_events(user_id TEXT,event_id TEXT,PRIMARY KEY(user_id,event_id))')
        cols = {r[1] for r in db.execute('PRAGMA table_info(users)')}
        if 'role' not in cols:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
        db.execute('CREATE TABLE IF NOT EXISTS account_passwords(user_id TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS secure_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS student_progress(user_id TEXT NOT NULL,lesson_id TEXT NOT NULL,stars INTEGER,score INTEGER,completed_at TEXT,PRIMARY KEY(user_id,lesson_id))')
        db.execute('CREATE TABLE IF NOT EXISTS account_migrations(name TEXT PRIMARY KEY)')
        if not db.execute("SELECT 1 FROM account_migrations WHERE name='progress'").fetchone():
            db.execute("INSERT OR IGNORE INTO student_progress SELECT 'user_rony_1',lesson_id,stars,score,completed_at FROM progress2")
            db.execute("INSERT INTO account_migrations VALUES ('progress')")

def provision(email, password, name, admin=False):
    email = email.strip().lower()
    validate(email, password)
    with connect() as db:
        if admin and db.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            raise ValueError('O administrador já foi configurado.')
        if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            raise ValueError('Este e-mail já está cadastrado.')
        uid = 'user_rony_1' if admin else secrets.token_hex(16)
        if admin:
            db.execute("UPDATE users SET email=?,role='admin',auth_mode='password' WHERE id=?", (email, uid))
        else:
            db.execute("INSERT INTO users(id,email,full_name,auth_mode,role,xp,streak) VALUES (?,?,?,'password','student',0,0)", (uid,email,name[:100] or 'Estudante'))
        salt = secrets.token_hex(16)
        db.execute('INSERT INTO account_passwords VALUES (?,?,?)', (uid,salt,password_hash(password,salt)))
    return uid

def secure_handler(Base):
    # Keep one replica connection on its owning thread for read-only session checks.
    # Query each request so logout and password changes still take effect immediately.
    readers = ThreadPoolExecutor(max_workers=1, thread_name_prefix="session-reader")
    session_db = None

    def read_session(handler):
        nonlocal session_db
        if session_db is None:
            session_db = db.get_db()
        try:
            return handler.get_current_user(session_db)
        except Exception:
            session_db.close()
            session_db = None
            raise

    def authenticated(handler):
        if not handler.token():
            return False
        if db.REMOTE:
            return bool(readers.submit(read_session, handler).result())
        with connect() as connection:
            return bool(handler.get_current_user(connection))

    class SecureHandler(Base):
        def end_headers(self):
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('X-Frame-Options','DENY')
            self.send_header('Referrer-Policy','same-origin')
            self.send_header('Cache-Control','private, no-store')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
            super().end_headers()

        def token(self):
            try:
                c = SimpleCookie(self.headers.get('Cookie',''))
                return c['talk2me_session'].value if 'talk2me_session' in c else ''
            except Exception:
                return ''

        def get_current_user(self, conn):
            row = conn.execute('SELECT u.* FROM users u JOIN secure_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?', (hashlib.sha256(self.token().encode()).hexdigest(), int(time.time()))).fetchone()
            return dict(row) if row else None

        def session(self, db, uid):
            token = secrets.token_urlsafe(32)
            db.execute('INSERT INTO secure_sessions VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(),uid,int(time.time())+2592000))
            secure = '; Secure' if os.getenv('TALK2ME_HTTPS') == '1' else ''
            return {'Set-Cookie':f'talk2me_session={token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict{secure}'}

        def do_HEAD(self):
            self.send_error(405)

        def do_GET(self):
            path = urlparse(self.path).path
            if not path.startswith(('/api/', '/m/', '/media/')):
                from urllib.parse import unquote
                root = Path(__file__).with_name('public').resolve()
                target = (root / unquote(path).lstrip('/')).resolve()
                if not target.is_relative_to(root):
                    return self.send_json({'error':'Não encontrado.'},404)
                return super().do_GET()
            if path in ('/api/auth/config', '/api/admin/users'):
                with connect() as db:
                    user = self.get_current_user(db)
                    if path == '/api/auth/config':
                        configured = bool(db.execute("SELECT 1 FROM users WHERE role='admin'").fetchone())
                        return self.send_json({'configured':configured,'authenticated':bool(user),'user':user})
                    if path == '/api/admin/users':
                        if not user or user['role'] != 'admin':
                            return self.send_json({'error':'Acesso exclusivo do administrador.'},403)
                        return self.send_json([dict(r) for r in db.execute('SELECT id,email,full_name,role,xp FROM users WHERE id IN (SELECT user_id FROM account_passwords) ORDER BY created_at DESC')])
            if not authenticated(self):
                return self.send_json({'error':'Entre para continuar.'},401)
            if path.startswith('/api/auth/'):
                return self.send_json({'error':'Não encontrado.'},404)
            return super().do_GET()

        def do_POST(self):
            origin = self.headers.get('Origin')
            if (origin and urlparse(origin).netloc != self.headers.get('Host')) or self.headers.get('Sec-Fetch-Site') == 'cross-site':
                return self.send_json({'error':'Origem não permitida.'},403)
            if 'application/json' not in self.headers.get('Content-Type',''):
                return self.send_json({'error':'Envie JSON.'},415)
            try:
                length = int(self.headers.get('Content-Length','0'))
                if not 0 < length <= 16384:
                    raise ValueError('Solicitação inválida.')
                raw = self.rfile.read(length)
                data = json.loads(raw)
                if not isinstance(data,dict):
                    raise ValueError('Solicitação inválida.')
                path = urlparse(self.path).path
                with connect() as db:
                    user = self.get_current_user(db)
                    if path == '/api/auth/login':
                        key = self.client_address[0]
                        with LOCK:
                            attempts = [t for t in ATTEMPTS.get(key,[]) if t > time.time()-300]
                            if len(attempts) >= 10:
                                return self.send_json({'error':'Muitas tentativas. Aguarde cinco minutos.'},429)
                            ATTEMPTS[key] = attempts + [time.time()]
                        email = str(data.get('email','')).strip().lower()
                        password = data.get('password','')
                        if not isinstance(password,str) or len(password)>128:
                            raise ValueError('Credenciais inválidas.')
                        row = db.execute('SELECT p.* FROM account_passwords p JOIN users u ON u.id=p.user_id WHERE u.email=?',(email,)).fetchone()
                        digest = password_hash(password,row['salt'] if row else 'invalid-user-salt')
                        if not row or not secrets.compare_digest(digest,row['hash']):
                            return self.send_json({'error':'E-mail ou senha incorretos.'},401)
                        headers = self.session(db,row['user_id'])
                        db.commit()
                        return self.send_json({'ok':True},headers=headers)
                    if not user:
                        return self.send_json({'error':'Entre para continuar.'},401)
                    if path == '/api/auth/logout':
                        db.execute('DELETE FROM secure_sessions WHERE token_hash=?',(hashlib.sha256(self.token().encode()).hexdigest(),))
                        db.commit()
                        return self.send_json({'ok':True},headers={'Set-Cookie':'talk2me_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict'})
                    if path == '/api/auth/password':
                        row = db.execute('SELECT * FROM account_passwords WHERE user_id=?',(user['id'],)).fetchone()
                        current = data.get('current_password','')
                        if not isinstance(current,str) or len(current)>128 or not row or not secrets.compare_digest(password_hash(current,row['salt']),row['hash']):
                            return self.send_json({'error':'A senha atual está incorreta.'},400)
                        password = data.get('new_password','')
                        validate(user['email'],password)
                        salt = secrets.token_hex(16)
                        db.execute('UPDATE account_passwords SET salt=?,hash=? WHERE user_id=?',(salt,password_hash(password,salt),user['id']))
                        db.execute('DELETE FROM secure_sessions WHERE user_id=?',(user['id'],))
                        headers = self.session(db,user['id'])
                        db.commit()
                        return self.send_json({'ok':True},headers=headers)
                    if path == '/api/admin/student-password':
                        if user['role'] != 'admin':
                            return self.send_json({'error':'Acesso exclusivo do administrador.'},403)
                        uid = data.get('user_id')
                        student = db.execute("SELECT email FROM users WHERE id=? AND role='student'",
                                             (uid if isinstance(uid,str) else '',)).fetchone()
                        if not student:
                            return self.send_json({'error':'Aluno não encontrado.'},404)
                        password = data.get('new_password')
                        validate(student['email'], password)
                        salt = secrets.token_hex(16)
                        db.execute('UPDATE account_passwords SET salt=?, hash=? WHERE user_id=?',
                                   (salt,password_hash(password,salt),uid))
                        db.execute('DELETE FROM secure_sessions WHERE user_id=?',(uid,))
                        db.commit()
                        return self.send_json({'ok':True})
                    if path == '/api/admin/users':
                        if user['role'] != 'admin':
                            return self.send_json({'error':'Acesso exclusivo do administrador.'},403)
                        uid = provision(str(data.get('email','')), data.get('password',''),str(data.get('full_name','Estudante')))
                        return self.send_json({'ok':True,'id':uid},201)
                    if path not in ('/api/finish','/api/resume','/api/profile'):
                        return self.send_json({'error':'Cadastro público indisponível.'},403)
                    if path == '/api/finish':
                        from server import ITEMS
                        # __main__ owns the index when launched as a script.
                        import sys
                        items = getattr(sys.modules.get('__main__'),'ITEMS',ITEMS)
                        if data.get('id') not in items:
                            raise ValueError('Aula inválida.')
                        if not 1 <= int(data.get('stars',0)) <= 3 or not 0 <= int(data.get('score',0)) <= 100 or not 0 <= int(data.get('xp',0)) <= 100:
                            raise ValueError('Resultado inválido.')
                    if path == '/api/resume' and (data.get('lang') != 'es' or not 0 <= int(data.get('step_index',0)) <= 1000):
                        raise ValueError('Posição inválida.')
                    if path == '/api/profile':
                        data = {'theme_pref':data.get('theme_pref',user['theme_pref']),'daily_goal_xp':max(10,min(1000,int(data.get('daily_goal_xp',user['daily_goal_xp']))))}
                        raw = json.dumps(data).encode()
                import io
                self.rfile = io.BytesIO(raw)
                self.headers.replace_header('Content-Length',str(len(raw)))
                self.path = path
                return super().do_POST()
            except (ValueError,TypeError,KeyError,OverflowError):
                return self.send_json({'error':'Confira os dados. A senha deve ter entre 10 e 128 caracteres.'},400)
            except sqlite3.IntegrityError:
                return self.send_json({'error':'Este e-mail já está cadastrado.'},409)
    return SecureHandler

if __name__ == '__main__':
    import getpass
    migrate()
    email = input('E-mail do administrador: ').strip()
    password = getpass.getpass('Senha inicial (mínimo 10 caracteres): ')
    if password != getpass.getpass('Repita a senha: '):
        raise SystemExit('As senhas não coincidem.')
    provision(email,password,'Administrador',admin=True)
    print('Administrador configurado. Entre no talk2me com esse e-mail e senha.')
