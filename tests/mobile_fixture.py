"""Disposable, isolated fixture. Never uses production accounts or the live database."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / 'deploy'))
import package_mobile
from configure_mobile import make_account


def create(directory, actual_media=False):
    out = Path(directory) / 'app'
    package_mobile.build(out, limit=2)
    private = out / 'private'
    users = [make_account('alice@example.test','Alice-test-12345','Alice', 'alice'),
             make_account('bob@example.test','Bob-test-12345','Bob','bob')]
    package_mobile.write_json(private / 'accounts.json',users)
    tree = json.loads((private / 'course.json').read_text(encoding='utf8'))
    ids = [item['id'] for level in tree['levels'] for module in level['modules'] for item in module['items']]
    media = {}
    for name in ['video.mp4','audio.mp3']:
        dest = private / 'media' / name
        if actual_media:
            suffix = Path(name).suffix
            candidates = [(v[0],k) for k,v in package_mobile.server.media_store.INDEX.items()
                          if Path(k).suffix == suffix and v[0] > 3000]
            source = ROOT / min(candidates)[1]
            shutil.copyfile(source,dest)
        else:
            dest.write_bytes(bytes(range(256))*8)
        media[name] = {'bytes':dest.stat().st_size, 'md5':hashlib.md5(dest.read_bytes()).hexdigest()}
    package_mobile.write_json(private / 'media.json',media)
    for pos, iid in enumerate(ids):
        lesson = {
            'id':iid, 'kind':'lesson','lang':'es','level':tree['levels'][0]['level'], 'modNum':1,
            'modTitle':'Teste isolado','title':f'Aula de teste {pos+1}','estimatedMinutes':1,
            'contents':[{'id':'content','title':'Ouça e assista','type':2,
                         'items':[{'videoUrl':'/m/video.mp4'},{'fileUrl':'/m/audio.mp3'}]}],
            'exercises':[{'id':'exercise','phase':'aprender','title':'Como dizer olá?', 'text':'Como dizer olá?',
                          'type':'multipleChoice','expected':'Hola','options':[
                              {'id':'yes','text':'Hola','correct':True}, {'id':'no','text':'Adiós','correct':False}],
                          'pairs':[],'tsd':None,'seq':1}],
            'media':[{'url':'/m/'+name,'bytes':entry['bytes']} for name,entry in media.items()],
            'downloadBytes':sum(entry['bytes'] for entry in media.values())
        }
        package_mobile.write_json(private / 'lessons' / (iid+'.json'),lesson)
    return out, ids


class Host:
    def __init__(self, directory, actual_media=False):
        self.out,self.ids = create(directory,actual_media)
        php = os.environ.get('PHP_BIN') or str(ROOT / '.tools/php/php.exe')
        if not Path(php).is_file():
            php = shutil.which('php')
        if not php:
            raise RuntimeError('Defina PHP_BIN com o caminho de um PHP 8.2+ para testar.')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        self.url=f'http://127.0.0.1:{port}'
        self.log = (Path(directory) / 'php.log').open('w',encoding='utf8')
        self.command=[php,'-S',f'127.0.0.1:{port}','-t',str(self.out/'site'),str(self.out/'site/index.php')]
        self.start()

    def start(self):
        self.process=subprocess.Popen(self.command,stdout=self.log,stderr=self.log)
        for _ in range(100):
            if self.process.poll() is not None: raise RuntimeError('O PHP não iniciou. Confira o log de teste.')
            try:
                with urllib.request.urlopen(self.url,timeout=1) as response:
                    if response.status == 200: break
            except OSError: time.sleep(0.05)
        else: self.stop(); raise RuntimeError('Tempo esgotado ao iniciar PHP.')

    def stop(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait(timeout=5)

    def close(self):
        self.stop()
        self.log.close()
