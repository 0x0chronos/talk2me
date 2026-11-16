/* One data boundary, shared by the Python version and the personal mobile app. */
const StudyAPI = {
  mode:'server',
  savedMessage:'Progresso salvo na sua conta',
  lessonCache:new Map(),
  day(date = new Date()) {
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  },
  eventId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
  },
  async request(path, data) {
    const isLessonGet = data === undefined && path.startsWith('/api/lesson/');
    if (isLessonGet && this.lessonCache.has(path)) {
      return structuredClone(this.lessonCache.get(path));
    }
    const response = await fetch(path, data === undefined ? {} : {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'Não foi possível concluir. Tente novamente.');
      error.status = response.status;
      throw error;
    }
    if (isLessonGet && result && !result.error) {
      if (this.lessonCache.size >= 24) this.lessonCache.delete(this.lessonCache.keys().next().value);
      this.lessonCache.set(path, structuredClone(result));
    }
    return result;
  },
  formatBytes(value) {
    return value >= 1e9 ? (value/1e9).toFixed(1)+' GB' : value >= 1e6 ? (value/1e6).toFixed(1)+' MB' : Math.ceil(value/1000)+' KB';
  }
};
