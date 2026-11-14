"""Prepare at most two private mobile accounts. Never include this output in a public ZIP."""
import argparse
from contextlib import closing
import getpass
import hashlib
import json
from pathlib import Path
import secrets
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from accounts import validate


def make_account(email, password, name, uid=None):
    email = email.strip().lower()
    validate(email, password)
    salt = secrets.token_hex(16)
    return {'id':uid or secrets.token_hex(16), 'email':email, 'full_name':name.strip()[:100] or 'Estudante',
            'salt':salt, 'hash':hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),600000).hex(),
            'version':secrets.token_hex(16)}


def local_accounts():
    path = ROOT / 'database.sqlite'
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute('SELECT u.id,u.email,u.full_name,p.salt,p.hash FROM users u JOIN account_passwords p ON p.user_id=u.id').fetchall()
        if len(rows) > 2:
            raise ValueError('O banco tem mais de duas contas. Configure os dois acessos manualmente; nenhuma conta foi copiada.')
        return [{**dict(row), 'version':secrets.token_hex(16)} for row in rows]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('private_dir', type=Path, help='Private sibling of the public site directory.')
    parser.add_argument('--from-local', action='store_true', help='Import up to two existing accounts, read-only, preserving passwords and IDs.')
    parser.add_argument('--add', action='store_true', help='Add one account interactively to an existing configuration.')
    args = parser.parse_args()
    dest = args.private_dir.resolve()
    if dest.name != 'private':
        raise ValueError('Use uma pasta chamada private, fora de public_html/site.')
    file = dest / 'accounts.json'
    if file.exists() and not args.add:
        raise ValueError('A configuração já existe; use --add para acrescentar o segundo acesso.')
    accounts = json.loads(file.read_text(encoding='utf8')) if file.exists() else []
    if args.from_local:
        if accounts:
            raise ValueError('A importação exige uma configuração nova.')
        accounts = local_accounts()
        if not accounts:
            raise ValueError('Não há contas locais configuradas para importar.')
    else:
        if len(accounts) >= 2:
            raise ValueError('Os dois acessos pessoais já foram configurados.')
        email = input('E-mail: ').strip().lower()
        if any(user['email'] == email for user in accounts):
            raise ValueError('Este e-mail já está configurado.')
        name = input('Nome: ').strip()
        password = getpass.getpass('Senha (10 a 128 caracteres): ')
        if password != getpass.getpass('Repita a senha: '):
            raise ValueError('As senhas não coincidem.')
        accounts.append(make_account(email,password,name))
    dest.mkdir(parents=True,exist_ok=True)
    temporary = dest / ('accounts-' + secrets.token_hex(8) + '.tmp')
    try:
        temporary.write_text(json.dumps(accounts,ensure_ascii=False),encoding='utf8')
        temporary.chmod(0o600)
        temporary.replace(file)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'{len(accounts)} acesso(s) preparado(s) em arquivo privado. Transfira por SFTP, fora da raiz pública.')


if __name__ == '__main__':
    main()
