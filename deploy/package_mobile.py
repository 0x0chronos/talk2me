"""Build the personal PWA without reading a database or packaging credentials."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf8')


def build(out, lessons=None, limit=None, copy_media=False):
    out = Path(out).resolve()
    if out.exists() and any(out.iterdir()):
        raise ValueError('O destino deve estar vazio. Use outra pasta; pacotes existentes não são sobrescritos.')
    server.build_index(seed_progress=False)
    selected = list(server.ITEMS)
    if lessons:
        unknown = set(lessons) - set(selected)
        if unknown:
            raise ValueError('Há identificadores de aula desconhecidos.')
        selected = [iid for iid in selected if iid in lessons]
    if limit is not None:
        if limit < 1:
            raise ValueError('O limite de aulas deve ser positivo.')
        selected = selected[:limit]
    selected = set(selected)
    if not selected:
        raise ValueError('Selecione ao menos uma aula.')
    site, private = out / 'site', out / 'private'
    site.mkdir(parents=True, exist_ok=True)
    private.mkdir(parents=True, exist_ok=True)
    (private / 'lessons').mkdir(exist_ok=True)
    (private / 'media').mkdir(exist_ok=True)
    # Only these exact application files belong in the public root.
    for path in (ROOT / 'public').rglob('*'):
        if path.is_file() and path.name not in ('offline.js', 'platform.js', 'sw.js', 'index.html'):
            dest = site / path.relative_to(ROOT / 'public')
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest)
    for name in ('progress.js','storage.js','client.js','downloads.js','range.js','mobile.css'):
        dest = site / 'mobile' / name
        dest.parent.mkdir(exist_ok=True)
        shutil.copyfile(ROOT / 'mobile' / name, dest)
    for name in ('index.php', '.htaccess'):
        shutil.copyfile(ROOT / 'deploy' / 'mobile' / name, site / name)
    # Defense in depth if somebody accidentally places private/ inside public_html.
    (private / '.htaccess').write_text('Require all denied\nDeny from all\n', encoding='utf8')
    tree = {'lang':'es', 'langs':{'es':{'name':'Espanhol', 'flag':'🇪🇸', 'count':len(selected)}}, 'levels':[]}
    media = {}
    for level in server.TREE['es']:
        modules = []
        for module in level['modules']:
            items = [{**item, 'stars':0, 'score':0} for item in module['items'] if item['id'] in selected]
            if items:
                modules.append({**module, 'items':items})
        if modules:
            tree['levels'].append({**level, 'modules':modules})
    for iid in selected:
        lesson = server.load_item(iid)
        refs = sorted(set(re.findall(r'/m/([\w.-]+)', json.dumps(lesson, ensure_ascii=False))))
        missing = [name for name in refs if 'media_all/' + name not in server.media_store.INDEX]
        if missing:
            raise ValueError(f'A aula {iid} referencia mídias ausentes no índice.')
        lesson['media'] = [
            {'url':'/m/' + name, 'bytes':server.media_store.INDEX['media_all/' + name][0]}
            for name in refs
        ]
        lesson['downloadBytes'] = sum(entry['bytes'] for entry in lesson['media'])
        for name in refs:
            size, digest = server.media_store.INDEX['media_all/' + name]
            media[name] = {'bytes':size, 'md5':digest}
        write_json(private / 'lessons' / (iid + '.json'), lesson)
    write_json(private / 'course.json', tree)
    write_json(private / 'media.json', media)
    if copy_media:
        for name, entry in media.items():
            source = ROOT / 'media_all' / name
            if not source.is_file() or source.stat().st_size != entry['bytes']:
                raise ValueError(f'Mídia local ausente ou incompleta: {name}')
            with source.open('rb') as stream:
                if hashlib.file_digest(stream, 'md5').hexdigest() != entry['md5']:
                    raise ValueError(f'Mídia local diverge do índice: {name}')
            shutil.copyfile(source, private / 'media' / name)
    html = (ROOT / 'public/index.html').read_text(encoding='utf8')
    html = html.replace('<script src="/offline.js"></script>', '')
    html = html.replace('<script src="/platform.js?v=1"></script>',
        '\n'.join(f'<script src="/mobile/{name}.js"></script>' for name in ('progress','storage','downloads','client')))
    html = html.replace('</head>', '<link rel="stylesheet" href="/mobile/mobile.css">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n</head>')
    html = html.replace('Seu acesso é criado pelo professor. Para receber sua conta ou recuperar o acesso, fale com o administrador.',
        'Seu espaço pessoal de estudo. Entre uma vez para preparar este celular.')
    html = html.replace('A configuração inicial do administrador ainda não foi concluída neste computador.',
        'Os acessos pessoais ainda não foram configurados na hospedagem.')
    (site / 'index.html').write_text(html, encoding='utf8')
    shell = ['/'] + ['/' + p.relative_to(site).as_posix() for p in sorted(site.rglob('*'))
                    if p.is_file() and p.suffix not in ('.php',) and not p.name.startswith('.')]
    version = hashlib.sha256(''.join(hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(site.rglob('*')) if p.is_file()).encode()).hexdigest()[:16]
    sw = (ROOT / 'mobile/sw.js').read_text(encoding='utf8')
    sw = sw.replace('__BUILD_ID__', version).replace('"__SHELL_FILES__"', json.dumps(shell))
    (site / 'sw.js').write_text(sw, encoding='utf8')
    report = {'version':version, 'lessons':len(selected), 'media_files':len(media),
              'media_bytes':sum(v['bytes'] for v in media.values()), 'media_copied':copy_media,
              'accounts_included':False}
    write_json(out / 'package-info.json', report)
    guide = ROOT / 'deploy/MOBILE.md'
    if guide.is_file():
        shutil.copyfile(guide,out / 'LEIA-ME.md')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=ROOT / 'release' / ('mobile-' + datetime.now().strftime('%Y%m%d-%H%M%S')))
    parser.add_argument('--lesson', action='append', help='Include only this lesson ID; repeat to select several.')
    parser.add_argument('--limit', type=int, help='Include the first N lessons for a small pilot.')
    parser.add_argument('--copy-media', action='store_true', help='Copy and verify the referenced media into private/media.')
    parser.add_argument('--zip', action='store_true', help='Also create an application ZIP (no media and no credentials).')
    args = parser.parse_args()
    report = build(args.out, args.lesson, args.limit, args.copy_media)
    if args.zip:
        with ZipFile(args.out.with_suffix('.zip'), 'x', compression=ZIP_DEFLATED) as archive:
            for p in sorted(args.out.rglob('*')):
                if p.is_file() and 'media' not in p.relative_to(args.out).parts:
                    archive.write(p, p.relative_to(args.out))
    print(json.dumps({'out':str(args.out.resolve()), **report}, ensure_ascii=False))


if __name__ == '__main__':
    main()
