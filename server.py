"""talk2me - servidor local.
Lê os JSONs originais extraídos (dumped_content) e serve mídia de media_all/ (com suporte a Range p/ vídeo).
Inclui gerenciamento de sessões, perfis, modo escuro/claro, rastreamento de dias seguidos e continuidade (resume).
"""
import http.server
import socketserver
import json
import sqlite3
import os
import re
import mimetypes
import media_store
import urllib.parse
import datetime
import hashlib
import secrets
import db
from http import cookies

PORT = int(os.environ.get("PORT", 3001))
ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("TALK2ME_DB", os.path.join(ROOT, "database.sqlite"))
STATIC_DIR = os.path.join(ROOT, "public")
DUMP_DIR = os.path.join(ROOT, "dumped_content")
MEDIA_DIR = os.path.join(ROOT, "media_all")
LEGACY_IMG_DIR = os.path.join(ROOT, "media", "images")

# Espanhol em primeiro lugar como idioma principal
LANGS = {'es': ('Espanhol', '🇪🇸')}
URL_RE = re.compile(r'https?://(?:[^\s"\'<>\\]|\\u0026)+')

mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 600_000)
    return key.hex(), salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    key, _ = hash_password(password, salt)
    return secrets.compare_digest(key, expected_hash)


def local_url(s):
    return URL_RE.sub(lambda m: "/m/" + os.path.basename(m.group(0).split("?")[0]), s)


def rewrite(o):
    if isinstance(o, dict):
        return {k: rewrite(v) for k, v in o.items()}
    if isinstance(o, list):
        return [rewrite(v) for v in o]
    if isinstance(o, str):
        return local_url(o)
    return o


def get_db():
    return db.get_db()


def init_db():
    conn = get_db()
    # 1. Tabelas legadas mantidas 100% intactas
    conn.execute("""CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY, full_name TEXT, avatar_url TEXT, target_language TEXT DEFAULT 'es',
        xp INTEGER DEFAULT 0, streak INTEGER DEFAULT 1, last_activity_date TEXT,
        created_at TEXT DEFAULT (datetime('now')))""")
    conn.execute("""INSERT OR IGNORE INTO profiles (id, full_name, target_language, xp, streak)
        VALUES ('user_rony_1', 'Rony Novais', 'es', 0, 1)""")
    conn.execute("""UPDATE profiles SET target_language='es' WHERE id='user_rony_1' AND (target_language IS NULL OR target_language='en')""")

    conn.execute("""CREATE TABLE IF NOT EXISTS progress2 (
        lesson_id TEXT PRIMARY KEY, stars INTEGER, score INTEGER, completed_at TEXT)""")

    # 2. Nova arquitetura de usuários e autenticação esquematizada
    conn.execute("""CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        full_name TEXT NOT NULL,
        display_handle TEXT,
        avatar_url TEXT,
        auth_mode TEXT DEFAULT 'test',
        theme_pref TEXT DEFAULT 'light',
        target_language TEXT DEFAULT 'es',
        daily_goal_xp INTEGER DEFAULT 50,
        xp INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 1,
        longest_streak INTEGER DEFAULT 1,
        last_activity_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )""")

    # Migração inicial do perfil legado para a tabela users se ainda não existir
    legacy = conn.execute("SELECT * FROM profiles WHERE id='user_rony_1'").fetchone()
    if legacy:
        conn.execute("""INSERT OR IGNORE INTO users
            (id, full_name, avatar_url, target_language, xp, streak, longest_streak, last_activity_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (legacy["id"], legacy["full_name"], legacy["avatar_url"],
             legacy["target_language"] or "es", legacy["xp"] or 0, legacy["streak"] or 1,
             max(legacy["streak"] or 1, 1), legacy["last_activity_date"], legacy["created_at"]))

    conn.execute("""CREATE TABLE IF NOT EXISTS auth_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_uid TEXT NOT NULL,
        password_hash TEXT,
        salt TEXT,
        provider_meta TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(provider, provider_uid)
    )""")

    conn.execute("""CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )""")

    conn.execute("""CREATE TABLE IF NOT EXISTS user_resume (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lang TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        step_index INTEGER DEFAULT 0,
        level TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, lang)
    )""")

    conn.execute("""CREATE TABLE IF NOT EXISTS activity_days (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_date TEXT NOT NULL,
        xp_earned INTEGER DEFAULT 0,
        lessons_completed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, activity_date)
    )""")

    conn.commit()
    conn.close()


# ---------------------------------------------------------------- índice do conteúdo
TREE = {}    # lang -> [level dicts]
ITEMS = {}   # item id -> {path, kind, title, lang, level, mod_num, mod_title}


def display_title(value):
    fixes = {'Falar de las cosas que te gustan': 'Falar das coisas de que você gosta', 'Aprender mas comida basica': 'Aprender mais comida básica', 'Falar sobre colores': 'Falar sobre cores', 'Contaveis e incontaveis na comida': 'Contáveis e incontáveis na comida', 'Descrever la existencia con "hay"': 'Descrever a existência com "hay"'}
    return fixes.get(value, value)


def read_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def build_index(seed_progress=True):
    seeded_stars = []
    for code, (folder, _) in LANGS.items():
        lang_dir = os.path.join(DUMP_DIR, folder)
        levels = []
        if not os.path.isdir(lang_dir):
            TREE[code] = levels
            continue
        level_labels = {}
        lp = os.path.join(lang_dir, "levels.json")
        if os.path.exists(lp):
            for l in read_json(lp):
                level_labels[l["name"]] = l.get("label") or l["name"]
        for lvl_name in sorted(d for d in os.listdir(lang_dir) if d.startswith("Nivel_")):
            lvl_dir = os.path.join(lang_dir, lvl_name)
            lvl = lvl_name.replace("Nivel_", "")
            mods = []
            mod_dirs = sorted(d for d in os.listdir(lvl_dir) if d.startswith("Mod_"))
            for m_idx, mdir in enumerate(mod_dirs, 1):
                mpath = os.path.join(lvl_dir, mdir)
                ip = os.path.join(mpath, "module_info.json")
                if not os.path.exists(ip):
                    continue
                info = read_json(ip)
                files = os.listdir(mpath)
                items = []
                for it in info.get("learningPath", []):
                    seq = it.get("sequence", 0)
                    kind = "checkpoint" if it.get("type") == "checkpoint" else "lesson"
                    prefix = ("Checkpoint" if kind == "checkpoint" else "Lesson") + "_%02d_" % seq
                    fn = next((f for f in files if f.startswith(prefix) and f.endswith(".json")), None)
                    if not fn:
                        continue
                    iid = it.get("checkpointId") if kind == "checkpoint" else it.get("lessonId")
                    if not iid:
                        continue
                    title = display_title(it.get("title")) or "Checkpoint da unidade"
                    ITEMS[iid] = {
                        "path": os.path.join(mpath, fn),
                        "kind": kind,
                        "title": title,
                        "lang": code,
                        "level": lvl,
                        "mod_num": m_idx,
                        "mod_title": info.get("title") or "",
                    }
                    init_st = int(it.get("stars") or 0)
                    if init_st > 0:
                        seeded_stars.append((iid, init_st, 100 if init_st == 3 else 80))
                    items.append({"id": iid, "title": title, "kind": kind, "seq": seq})
                if items:
                    mods.append({"id": info.get("id"), "title": display_title(info.get("title")),
                                 "subtitle": info.get("subTitle"), "items": items})
            if mods:
                levels.append({"level": lvl, "label": level_labels.get(lvl, lvl), "modules": mods})
        TREE[code] = levels

    if seeded_stars and seed_progress:
        conn = get_db()
        conn.executemany(
            "INSERT OR IGNORE INTO progress2 (lesson_id, stars, score, completed_at) VALUES (?, ?, ?, datetime('now'))",
            seeded_stars,
        )
        prof = conn.execute("SELECT xp, streak FROM profiles WHERE id='user_rony_1'").fetchone()
        if prof and (prof["xp"] or 0) < len(seeded_stars) * 25:
            conn.execute(
                "UPDATE profiles SET xp=?, streak=max(coalesce(streak,0), 1) WHERE id='user_rony_1'",
                (len(seeded_stars) * 25,),
            )
        conn.commit()
        conn.close()

    n = sum(len(m["items"]) for lv in TREE.values() for l in lv for m in l["modules"])
    es_n = sum(len(m["items"]) for l in TREE.get("es", []) for m in l["modules"])
    print("Índice: %d itens totais | Espanhol: %d itens" % (n, es_n))


def parse_tsd(ex):
    t = ex.get("typeSpecificData")
    if isinstance(t, str) and t.strip():
        try:
            return json.loads(t)
        except Exception:
            return None
    return t if isinstance(t, dict) else None


def norm_exercise(ex, phase):
    return {
        "id": ex.get("id") or ex.get("exerciseId"),
        "phase": phase,
        "title": ex.get("title") or "",
        "text": ex.get("contentPlain") or ex.get("title") or "",
        "html": ex.get("content") or "",
        "audio": ex.get("fileUrl"),
        "ok": ex.get("feedbackSuccess"),
        "err": ex.get("feedbackError"),
        "type": ex.get("answerType"),
        "expected": ex.get("expectedAnswer"),
        "tsd": parse_tsd(ex),
        "seq": ex.get("sequenceItem", ex.get("sequence", 0)) or 0,
        "options": [{"id": o.get("id") or o.get("optionId"), "text": o.get("textContent") or o.get("text"),
                     "correct": bool(o.get("isCorrect")), "why": o.get("incorrectReason"),
                     "audio": o.get("audioUrl"), "image": o.get("imageUrl")}
                    for o in (ex.get("options") or [])],
        "pairs": [{"left": a.get("leftContent"), "right": a.get("rightContent"), "seq": a.get("sequenceItem", 0)}
                  for a in sorted(ex.get("associations") or [], key=lambda a: a.get("sequenceItem", 0))],
    }


def load_item(iid):
    meta = ITEMS.get(iid)
    if not meta:
        return None
    d = rewrite(read_json(meta["path"]))
    out = {
        "id": iid,
        "kind": meta["kind"],
        "lang": meta["lang"],
        "level": meta["level"],
        "modNum": meta["mod_num"],
        "modTitle": meta["mod_title"],
        "title": display_title(d.get("title")) or meta["title"],
        "contents": [],
        "exercises": [],
    }
    for c in sorted(d.get("contents") or [], key=lambda c: c.get("sequenceItem", 0)):
        out["contents"].append({
            "id": c.get("id"), "title": c.get("title"), "description": c.get("description"),
            "type": c.get("contentType"), "items": c.get("items") or [],
            "bubbles": c.get("dialogue_bubbles"), "glossary": c.get("glossary")})
    phases = (
        ("learningExercises", "aprender"),
        ("practiceExercises", "praticar"),
        ("challengeExercises", "desafio"),
        ("exercises", "checkpoint"),
    )
    for key, phase in phases:
        lst = d.get(key) or []
        out["exercises"].extend(sorted((norm_exercise(e, phase) for e in lst), key=lambda e: e["seq"]))
    refs = set(re.findall(r'/m/([^\s"<>]+)', json.dumps(out, ensure_ascii=False)))
    missing = sum("media_all/" + name not in media_store.INDEX for name in refs)
    out['availability'] = {'total': len(refs), 'missing': missing}
    out['estimatedMinutes'] = max(1, round(len(out['contents']) * 0.7 + len(out['exercises']) * 0.5))
    return out


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if len(args) >= 3:
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]} -> {args[2]}", flush=True)

    def send_json(self, data, status=200, headers=None):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        if headers:
            for k, v in headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def get_current_user(self, conn):
        # 1. Verifica token em cookie talk2me_session
        cookie_header = self.headers.get("Cookie")
        token = None
        if cookie_header:
            c = cookies.SimpleCookie()
            try:
                c.load(cookie_header)
                if "talk2me_session" in c:
                    token = c["talk2me_session"].value
            except Exception:
                pass
        
        # 2. Verifica Authorization: Bearer <token>
        if not token:
            auth_hdr = self.headers.get("Authorization", "")
            if auth_hdr.lower().startswith("bearer "):
                token = auth_hdr[7:].strip()

        if token:
            row = conn.execute("""
                SELECT u.* FROM users u
                JOIN auth_sessions s ON s.user_id = u.id
                WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
            """, (token,)).fetchone()
            if row:
                return dict(row)

        return None

    def serve_file(self, path, cache=True, filename=None):
        path = os.fspath(path)
        try:
            size = os.path.getsize(path)
        except OSError:
            self.send_error(404)
            return

        # Evita servir arquivos de erro HTML corrompidos como mídia
        if size < 2048 and any(path.lower().endswith(x) for x in [".mp3", ".mp4", ".png", ".jpg", ".jpeg"]):
            try:
                with open(path, "rb") as test_f:
                    head = test_f.read(40)
                    if b"<html" in head.lower() or b"<!doctype" in head.lower() or b"<error" in head.lower():
                        self.send_error(404, "Media not found on remote origin")
                        return
            except OSError:
                pass

        mime = mimetypes.guess_type(filename or path)[0] or "application/octet-stream"
        start, end, status = 0, size - 1, 200
        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                elif m.group(2):
                    start = max(size - int(m.group(2)), 0)
                if start >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.send_header("Content-Length", "0")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    self.close_connection = True
                    return
                status = 206
        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Cache-Control", "public, max-age=3600" if cache else "no-cache, no-store, must-revalidate")
        if not cache:
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        self.close_connection = True

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        path, q = u.path, urllib.parse.parse_qs(u.query)

        if path == "/api/profile":
            conn = get_db()
            user = self.get_current_user(conn)
            
            # Carrega posições exatas salvas de continuidade (resume)
            resumes = {}
            for r in conn.execute("SELECT lang, lesson_id, step_index, level, updated_at FROM user_resume WHERE user_id=?", (user["id"],)):
                item_info = ITEMS.get(r["lesson_id"])
                resumes[r["lang"]] = {
                    "lessonId": r["lesson_id"],
                    "stepIndex": r["step_index"],
                    "level": r["level"],
                    "updatedAt": r["updated_at"],
                    "title": item_info["title"] if item_info else "Aula em andamento"
                }
            
            # Carrega histórico recente de atividade (últimos 14 dias para calendário de ofensiva)
            activity = [
                {"date": row["activity_date"], "xp": row["xp_earned"], "lessons": row["lessons_completed"]}
                for row in conn.execute(
                    "SELECT activity_date, xp_earned, lessons_completed FROM activity_days WHERE user_id=? ORDER BY activity_date DESC LIMIT 14",
                    (user["id"],)
                )
            ]
            
            # Quantidade total de atividades concluídas em cada curso
            prog_stats = {}
            for lang_code in LANGS:
                prog_stats[lang_code] = conn.execute("""
                    SELECT count(distinct p.lesson_id) as total_done, sum(p.stars) as total_stars
                    FROM student_progress p WHERE user_id=?
                """, (user["id"],)).fetchone()["total_done"]

            conn.close()
            resp = dict(user)
            resp["resume"] = resumes
            resp["activity"] = activity
            resp["stats"] = prog_stats
            return self.send_json(resp)

        if path == "/api/auth/config":
            conn = get_db()
            user = self.get_current_user(conn)
            conn.close()
            return self.send_json({
                "testMode": True,
                "currentUser": {
                    "id": user["id"],
                    "fullName": user["full_name"],
                    "email": user.get("email"),
                    "authMode": user.get("auth_mode", "test")
                },
                "providers": {
                    "emailPassword": {
                        "enabled": True,
                        "mode": "local-schema",
                        "status": "ativo"
                    },
                    "google": {
                        "enabled": False,
                        "configured": False,
                        "status": "esquematizado",
                        "clientIdEnv": "GOOGLE_OAUTH_CLIENT_ID",
                        "note": "Suporte a Google OAuth estruturado; operando em modo de teste local sem necessidade de chaves agora."
                    }
                }
            })

        if path == "/api/tree":
            lang = q.get("lang", ["es"])[0]
            if lang not in LANGS:
                lang = "es"
            conn = get_db()
            prog = {r["lesson_id"]: r["stars"] for r in conn.execute("SELECT lesson_id, stars FROM student_progress WHERE user_id=?", (self.get_current_user(conn)["id"],))}
            conn.close()
            levels = []
            for lv in TREE.get(lang, []):
                mods = []
                for m in lv["modules"]:
                    mods.append({**m, "items": [{**i, "stars": prog.get(i["id"], 0)} for i in m["items"]]})
                levels.append({**lv, "modules": mods})
            return self.send_json({
                "lang": lang,
                "levels": levels,
                "langs": {k: {"name": v[0], "flag": v[1], "count": sum(len(m["items"]) for l in TREE.get(k, []) for m in l["modules"])} for k, v in LANGS.items()}
            })

        if path.startswith("/api/lesson/"):
            data = load_item(urllib.parse.unquote(path[len("/api/lesson/"):]))
            if not data:
                return self.send_json({"error": "not found"}, 404)
            return self.send_json(data)

        for prefix, directory in (("/m/", "media_all/"), ("/media/images/", "media/images/")):
            if path.startswith(prefix):
                name = urllib.parse.unquote(path[len(prefix):])
                key = directory + name
                if key not in media_store.INDEX:
                    return self.send_error(404)
                try:
                    with media_store.media_file(key) as cached:
                        return self.serve_file(cached, cache=False, filename=name)
                except OSError:
                    return self.send_json({"error": "Mídia temporariamente indisponível. Tente novamente."}, 503, headers={"Retry-After": "5"})

        target = os.path.join(STATIC_DIR, "index.html") if path in ("/", "") else \
            os.path.join(STATIC_DIR, path.lstrip("/").replace("/", os.sep))
        if os.path.isfile(target) and os.path.abspath(target).startswith(os.path.abspath(STATIC_DIR)):
            return self.serve_file(target, cache=target.endswith(".woff2"))
        self.serve_file(os.path.join(STATIC_DIR, "index.html"), cache=False)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(raw_body)
        except Exception:
            data = {}

        conn = get_db()
        user = self.get_current_user(conn)

        # 1. Salvar progresso de conclusão da lição
        if self.path == "/api/finish":
            event_id = str(data.get('event_id') or secrets.token_hex(16))
            conn.execute('BEGIN IMMEDIATE')
            if conn.execute('SELECT 1 FROM finish_events WHERE user_id=? AND event_id=?',(user['id'],event_id)).fetchone():
                conn.close()
                return self.send_json({'ok':True,'gained':0,'duplicate':True})
            conn.execute('INSERT INTO finish_events VALUES (?,?)',(user['id'],event_id))
            iid = data.get("id")
            stars = int(data.get("stars", 1))
            score = int(data.get("score", 100))
            xp = int(data.get("xp", 20))
            today = datetime.date.today().isoformat()
            
            old = conn.execute("SELECT stars FROM student_progress WHERE user_id=? AND lesson_id=?", (user["id"], iid)).fetchone()
            conn.execute("""INSERT INTO student_progress (user_id, lesson_id, stars, score, completed_at) VALUES (?,?,?,?,datetime('now'))
                ON CONFLICT(user_id,lesson_id) DO UPDATE SET stars=max(stars, excluded.stars), score=max(score, excluded.score),
                completed_at=datetime('now')""", (user["id"], iid, stars, score))
            
            # Atualiza streak calculado com precisão
            streak = user.get("streak", 1) or 1
            last_date = user.get("last_activity_date")
            if last_date != today:
                if last_date:
                    try:
                        diff = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(last_date)).days
                        if diff == 1:
                            streak += 1
                        elif diff > 1:
                            streak = 1
                    except Exception:
                        streak += 1
                else:
                    streak = 1

            longest = max(user.get("longest_streak", 1) or 1, streak)
            gained = xp if not old else max(xp // 4, 5)

            conn.execute("""UPDATE users SET xp=xp+?, streak=?, longest_streak=?, last_activity_date=?, updated_at=datetime('now')
                WHERE id=?""", (gained, streak, longest, today, user["id"]))
            
            # Registra atividade do dia
            conn.execute("""INSERT INTO activity_days (user_id, activity_date, xp_earned, lessons_completed)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(user_id, activity_date) DO UPDATE SET
                xp_earned = xp_earned + excluded.xp_earned,
                lessons_completed = lessons_completed + 1""",
                (user["id"], today, gained))

            # Limpa o bookmark de continuidade dessa lição já concluída
            conn.execute("DELETE FROM user_resume WHERE user_id=? AND lesson_id=?", (user["id"], iid))

            conn.commit()
            updated_user = dict(conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone())
            conn.close()
            return self.send_json({"ok": True, "gained": gained, "profile": updated_user})

        # 2. Salvar onde a pessoa parou para continuar depois (Resume)
        if self.path == "/api/resume":
            lang = data.get("lang") or user.get("target_language") or "es"
            lesson_id = data.get("lesson_id")
            step_index = int(data.get("step_index", 0))
            level = data.get("level") or "A1"
            if lesson_id:
                conn.execute("""INSERT INTO user_resume (user_id, lang, lesson_id, step_index, level, updated_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, lang) DO UPDATE SET
                    lesson_id=excluded.lesson_id, step_index=excluded.step_index, level=excluded.level, updated_at=datetime('now')""",
                    (user["id"], lang, lesson_id, step_index, level))
                conn.commit()
            conn.close()
            return self.send_json({"ok": True, "saved": {"lang": lang, "lesson_id": lesson_id, "step_index": step_index}})

        # 3. Atualizar preferências do perfil (nome, tema claro/escuro, meta diária)
        if self.path == "/api/profile":
            full_name = data.get("full_name") or user["full_name"]
            theme_pref = data.get("theme_pref") or user.get("theme_pref", "light")
            daily_goal_xp = int(data.get("daily_goal_xp") or user.get("daily_goal_xp", 50))
            target_language = data.get("target_language") or user.get("target_language", "es")
            avatar_url = data.get("avatar_url") or user.get("avatar_url", "/media/images/capivara.png")

            conn.execute("""UPDATE users SET
                full_name=?, theme_pref=?, daily_goal_xp=?, target_language=?, avatar_url=?, updated_at=datetime('now')
                WHERE id=?""", (full_name, theme_pref, daily_goal_xp, target_language, avatar_url, user["id"]))
            
            conn.commit()
            updated = dict(conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone())
            conn.close()
            return self.send_json({"ok": True, "profile": updated})

        conn.close()
        self.send_json({"error": "Não encontrado"}, 404)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    init_db()
    build_index()
    print("talk2me rodando em http://localhost:%d" % PORT)
    from accounts import secure_handler, migrate
    migrate()
    Server(("", PORT), secure_handler(Handler)).serve_forever()
