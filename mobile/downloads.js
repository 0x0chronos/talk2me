'use strict';
class MobileDownloads {
  static prefix = 'talk2me-mobile-download-';
  static marker = '/__talk2me_complete__';
  constructor() { this.active = new Map(); }
  name(uid, id) { return MobileDownloads.prefix + uid + ':' + id; }
  async list(uid) {
    const result = [];
    for (const name of await caches.keys()) {
      if (!name.startsWith(MobileDownloads.prefix + uid + ':')) continue;
      const cache = await caches.open(name), response = await cache.match(MobileDownloads.marker);
      if (!response) continue;
      const entry = await response.json();
      let complete = true;
      for (const path of entry.paths) { if (!await cache.match(path)) { complete=false; break; } }
      if (complete) result.push({...entry, name});
    }
    return result;
  }
  async remove(uid, id) {
    const name = this.name(uid,id);
    const running = this.active.get(name);
    if (running) { running.controller.abort(); await running.done.catch(()=>{}); }
    await caches.delete(name);
  }
  async clear(uid) {
    for (const running of this.active.values()) running.controller.abort();
    await Promise.allSettled([...this.active.values()].map(r=>r.done));
    for (const name of await caches.keys()) {
      if (name.startsWith(MobileDownloads.prefix + uid + ':')) await caches.delete(name);
    }
  }
  async download(user, lesson, progress) {
    const name = this.name(user.id, lesson.id);
    if (this.active.has(name)) throw new Error('Esta aula já está sendo baixada.');
    const controller = new AbortController();
    const done = (async()=>{
      if ((await this.list(user.id)).some(entry=>entry.id === lesson.id)) return;
      return this.transfer(name,lesson,controller.signal,progress);
    })();
    this.active.set(name,{controller,done});
    try { await done; } finally { this.active.delete(name); }
  }
  async transfer(name, lesson, signal, progress) {
    const cache = await caches.open(name), paths = [];
    let received = 0;
    try {
      await cache.delete(MobileDownloads.marker);
      if (!Array.isArray(lesson.media)) throw new Error('Reabra a aula antes de baixar.');
      for (const entry of lesson.media) {
        if (!/^\/m\/[\w.-]+$/.test(entry.url)) throw new Error('Endereço de mídia inválido.');
        const response = await fetch(entry.url, {signal, cache:'no-store', credentials:'same-origin'});
        if (response.status !== 200) throw new Error(response.status === 401 ? 'Entre novamente para baixar aulas.' : 'Uma mídia está indisponível. Tente novamente conectado.');
        let size = 0;
        const reader = response.body.getReader();
        const body = new ReadableStream({
          async pull(target) {
            try {
              const chunk = await reader.read();
              if (chunk.done) { target.close(); return; }
              size += chunk.value.byteLength; received += chunk.value.byteLength;
              progress(received,lesson.downloadBytes);
              target.enqueue(chunk.value);
            } catch (error) { target.error(error); }
          },
          cancel(reason) { return reader.cancel(reason); }
        });
        await cache.put(entry.url,new Response(body,{headers:response.headers}));
        if (size !== entry.bytes) throw new Error('Download incompleto. Tente baixar esta aula novamente.');
        paths.push(entry.url);
      }
      if (signal.aborted) throw new DOMException('Download cancelado.','AbortError');
      const lessonPath = '/api/lesson/' + lesson.id;
      await cache.put(lessonPath,new Response(JSON.stringify(lesson),{headers:{'Content-Type':'application/json'}}));
      paths.push(lessonPath);
      await cache.put(MobileDownloads.marker,new Response(JSON.stringify({
        id:lesson.id, title:lesson.title, bytes:received, paths, savedAt:new Date().toISOString()
      }),{headers:{'Content-Type':'application/json'}}));
    } catch (error) {
      await caches.delete(name);
      if (error.name === 'AbortError') throw new Error('Download cancelado. Você pode continuar estudando online.');
      if (error.name === 'QuotaExceededError') throw new Error('Sem espaço para esta aula. Remova outros downloads e tente novamente.');
      throw error;
    }
  }
}
