"""Build an application-only archive with an explicit allowlist."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
out = root / 'release' / 'talk2me-vps.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', compression=ZIP_DEFLATED) as archive:
    for name in ('Dockerfile', 'compose.yaml', 'Caddyfile', '.dockerignore', 'PUBLICAR.md'):
        archive.write(root / 'deploy' / name, name)
    for name in ('server.py', 'accounts.py', 'media_store.py', 'media-index.json'):
        archive.write(root / name, name)
    for file in (root / 'public').rglob('*'):
        if file.is_file():
            archive.write(file, file.relative_to(root))
    for file in (root / 'dumped_content' / 'Espanhol').rglob('*.json'):
        if file.name in ('levels.json', 'module_info.json') or file.name.startswith(('Lesson_', 'Checkpoint_')):
            archive.write(file, file.relative_to(root))
print(out)
