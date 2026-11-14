'use strict';
class MobileStorage {
  constructor() { this.ready = this.open(); }
  open() {
    return new Promise((resolve,reject)=>{
      const request = indexedDB.open('talk2me-personal',1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('profiles');
        request.result.createObjectStore('meta');
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(new Error('Não foi possível abrir o armazenamento. Verifique o espaço livre e use uma janela normal do navegador.'));
      request.onblocked = () => reject(new Error('Feche outras janelas do app e tente novamente.'));
    });
  }
  async read(store, key) {
    const db = await this.ready;
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readonly');
      const request = tx.objectStore(store).get(key);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Falha ao ler seus dados.'));
    });
  }
  async write(store, key, value) {
    const db = await this.ready;
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readwrite');
      if (value === undefined) tx.objectStore(store).delete(key);
      else tx.objectStore(store).put(value,key);
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Não foi possível salvar. Verifique o espaço livre.'));
    });
  }
  async change(user, mutate) {
    const db = await this.ready;
    return new Promise((resolve,reject)=>{
      const tx = db.transaction('profiles','readwrite');
      const store = tx.objectStore('profiles'), request = store.get(user.id);
      let result, failure;
      request.onsuccess = () => {
        try {
          const state = request.result || Talk2MeProgress.create(user);
          result = mutate(state);
          store.put(state,user.id);
        } catch (error) { failure=error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Não foi possível salvar seu progresso.'));
    });
  }
}
