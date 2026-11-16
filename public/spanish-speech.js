// The Spanish model runs in a worker and caches its compressed model on this device.
const SpanishSpeech = (() => {
  let worker, loading, idleTimer;
  const pending = new Map();

  function release() {
    clearTimeout(idleTimer);
    worker?.terminate();
    worker = loading = null;
    for (const task of pending.values()) task.reject(new Error('Reconhecimento interrompido'));
    pending.clear();
  }

  function idle() {
    clearTimeout(idleTimer);
    if (!pending.size) idleTimer = setTimeout(release, 120000);
  }

  function prepare() {
    if (loading) return loading;
    worker = new Worker('/speech-es/worker-008.js');
    loading = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail('Tempo de preparação esgotado'), 180000);
      function fail(message) {
        clearTimeout(timeout);
        reject(new Error(message));
        release();
      }
      worker.onerror = () => fail('O aparelho não conseguiu iniciar a correção');
      worker.onmessage = ({data}) => {
        if (data.event === 'load') {
          clearTimeout(timeout);
          if (!data.result) return fail('Modelo indisponível');
          resolve();
          idle();
        } else if (data.event === 'error' && !data.recognizerId) {
          fail(data.error);
        } else {
          const task = pending.get(data.recognizerId);
          if (!task) return;
          if (data.event === 'error') task.reject(new Error(data.error));
          if (data.result?.text) task.parts.push(data.result.text);
          if (data.event === 'finished') task.resolve(task.parts.join(' ').trim());
        }
      };
      worker.postMessage({action:'set',key:'logLevel',value:-1});
      worker.postMessage({action:'load',modelUrl:'/speech-es/spanish-042.tar.gz'});
    });
    return loading;
  }

  async function transcribe(blob) {
    await prepare();
    const ctx = new OfflineAudioContext(1, 1, 16000);
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = audio.getChannelData(0);
    const pcm = Float32Array.from(samples, n => n * 32767);
    await prepare();
    clearTimeout(idleTimer);
    const id = crypto.randomUUID();
    let timeout;
    try {
      return await new Promise((resolve,reject) => {
        pending.set(id,{resolve,reject,parts:[]});
        timeout = setTimeout(() => { release(); }, 30000);
        worker.postMessage({action:'create',recognizerId:id,sampleRate:audio.sampleRate});
        worker.postMessage({action:'audioChunk',recognizerId:id,data:pcm,sampleRate:audio.sampleRate},[pcm.buffer]);
        worker.postMessage({action:'remove',recognizerId:id});
      });
    } finally {
      clearTimeout(timeout);
      pending.delete(id);
      idle();
    }
  }
  return {prepare, transcribe};
})();
