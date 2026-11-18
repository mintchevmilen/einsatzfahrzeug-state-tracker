// Offline Hilfen: Lesecache, Foto Cache und Warteschlange für fertige Checks.
// Alles bleibt lokal im Gerät (localStorage und IndexedDB).

export const isNetErr = (e) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = String((e && (e.message || e.error_description || e)) || '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|offline|timeout/i.test(m);
};

// ---------- Lesecache (localStorage) ----------
const CP = 'cache:';
export function cacheSet(key, val) {
  try {
    localStorage.setItem(CP + key, JSON.stringify(val));
  } catch (e) {
    /* Speicher voll: Cache ist nur eine Hilfe */
  }
}
export function cacheGet(key) {
  try {
    const v = localStorage.getItem(CP + key);
    return v === null ? undefined : JSON.parse(v);
  } catch (e) {
    return undefined;
  }
}
export function cacheClear() {
  for (const k of Object.keys(localStorage)) if (k.startsWith(CP)) localStorage.removeItem(k);
}
// Erst Netz, bei Netzfehler der letzte bekannte Stand.
export async function cached(key, fn) {
  try {
    const v = await fn();
    cacheSet(key, v);
    return v;
  } catch (e) {
    if (isNetErr(e)) {
      const c = cacheGet(key);
      if (c !== undefined) return c;
    }
    throw e;
  }
}

// ---------- IndexedDB für Foto Blobs ----------
let dbp = null;
function idb() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('fzcheck', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('photos'); // Fotos von Fahrzeugen und Fächern, Schlüssel = Pfad
        r.result.createObjectStore('pendphotos'); // Fotos zu wartenden Checks
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function tx(store, mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const blobPut = (store, key, blob) => tx(store, 'readwrite', (s) => s.put(blob, key)).catch(() => {});
export const blobGet = (store, key) => tx(store, 'readonly', (s) => s.get(key)).catch(() => undefined);
export const blobDel = (store, key) => tx(store, 'readwrite', (s) => s.delete(key)).catch(() => {});
export async function blobClear() {
  await tx('photos', 'readwrite', (s) => s.clear()).catch(() => {});
}

// ---------- Warteschlange fertiger Checks ----------
const QP = 'pending:';
export function pendingList() {
  const out = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(QP)) continue;
    try {
      out.push(JSON.parse(localStorage.getItem(k)));
    } catch (e) {
      /* kaputten Eintrag überspringen */
    }
  }
  return out.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
}
export const pendingCount = () => pendingList().length;
export function pendingPut(rec) {
  localStorage.setItem(QP + rec.id, JSON.stringify(rec));
}
export function pendingGet(id) {
  try {
    return JSON.parse(localStorage.getItem(QP + id));
  } catch (e) {
    return null;
  }
}
export async function pendingRemove(id) {
  const rec = pendingGet(id);
  localStorage.removeItem(QP + id);
  if (rec) for (const r of rec.results) if (r.photo_local) await blobDel('pendphotos', r.photo_local);
}
