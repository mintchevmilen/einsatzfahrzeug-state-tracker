// Zugriff auf Supabase, Fotos und kleine Hilfsfunktionen.
import { cached, cacheClear, cacheSet, cacheGet, isNetErr, blobGet, blobPut } from './offline.js';
const cfg = window.APP_CONFIG || {};
export const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);

export const sb = configured
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    })
  : null;

// ---------- Hilfen ----------
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateTime(d) {
  if (!d) return '';
  const x = new Date(d);
  return (
    x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    x.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr + 'T00:00:00');
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.round((t - n) / 86400000);
}

// Position (0 bis 1) aus einem Klick auf ein Bild berechnen.
export function relPos(clientX, clientY, rect) {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, Math.round(x * 10000) / 10000)), y: Math.min(1, Math.max(0, Math.round(y * 10000) / 10000)) };
}

// ---------- Anmeldung ----------
export async function whoami() {
  try {
    const { data, error } = await sb.rpc('whoami');
    if (error) throw error;
    const w = data || { role: null };
    if (w.role) cacheSet('whoami', w);
    return w;
  } catch (e) {
    const c = cacheGet('whoami');
    if (isNetErr(e) && c) return c;
    throw e;
  }
}

export async function memberLogin(code, name) {
  const { data: ok, error: e1 } = await sb.rpc('check_code', { p_code: code });
  if (e1) throw e1;
  if (!ok) throw new Error('Der Code ist falsch.');
  const { data: s } = await sb.auth.getSession();
  if (s.session && !s.session.user.is_anonymous) await sb.auth.signOut();
  const again = await sb.auth.getSession();
  if (!again.data.session) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error: e3 } = await sb.rpc('join_team', { p_code: code, p_name: name });
  if (e3) throw e3;
  return data;
}

export async function adminLogin(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return whoami();
}

export async function logout() {
  await sb.auth.signOut();
  cacheClear();
}

// ---------- Daten ----------
function ok({ data, error }) {
  if (error) throw error;
  return data;
}

export const listVehicles = () => cached('vehicles', async () => ok(await sb.from('vehicles').select('*').order('sort').order('name')));

export const lastChecks = () =>
  cached('lastChecks', async () =>
    ok(await sb.from('checks').select('vehicle_id,created_at,member_name,checklist_id').order('created_at', { ascending: false }).limit(300))
  );

export const getVehicle = (id) => cached('vehicle:' + id, async () => ok(await sb.from('vehicles').select('*').eq('id', id).single()));

export const listAreas = (vehicleId) =>
  cached('areas:' + vehicleId, async () => ok(await sb.from('areas').select('*').eq('vehicle_id', vehicleId).order('sort').order('created_at')));

export const listItemsForAreas = async (areaIds) => {
  if (!areaIds.length) return [];
  return cached('items:' + areaIds.join(','), async () =>
    ok(await sb.from('items').select('*').in('area_id', areaIds).order('sort').order('created_at'))
  );
};

export const listChecklists = (vehicleId) =>
  cached('lists:' + vehicleId, async () => ok(await sb.from('checklists').select('*').eq('vehicle_id', vehicleId).order('sort').order('created_at')));
export const allChecklists = () => cached('lists:all', async () => ok(await sb.from('checklists').select('*').order('sort').order('created_at')));
export const saveChecklist = async (row) => {
  if (row.id) {
    const { id, ...rest } = row;
    return ok(await sb.from('checklists').update(rest).eq('id', id).select().single());
  }
  return ok(await sb.from('checklists').insert(row).select().single());
};
export const deleteChecklist = async (id) => ok(await sb.from('checklists').delete().eq('id', id));

export const saveVehicle = async (row) => {
  if (row.id) {
    const { id, ...rest } = row;
    return ok(await sb.from('vehicles').update(rest).eq('id', id).select().single());
  }
  return ok(await sb.from('vehicles').insert(row).select().single());
};
export const deleteVehicle = async (id) => ok(await sb.from('vehicles').delete().eq('id', id));

export const saveArea = async (row) => {
  if (row.id) {
    const { id, ...rest } = row;
    return ok(await sb.from('areas').update(rest).eq('id', id).select().single());
  }
  return ok(await sb.from('areas').insert(row).select().single());
};
export const deleteArea = async (id) => ok(await sb.from('areas').delete().eq('id', id));

export const saveItem = async (row) => {
  if (row.id) {
    const { id, ...rest } = row;
    return ok(await sb.from('items').update(rest).eq('id', id).select().single());
  }
  return ok(await sb.from('items').insert(row).select().single());
};
export const deleteItem = async (id) => ok(await sb.from('items').delete().eq('id', id));

// Mit fester id und ignoreDuplicates, damit ein erneutes Senden nichts doppelt anlegt.
export const createCheck = async (row) => ok(await sb.from('checks').upsert(row, { onConflict: 'id', ignoreDuplicates: true }));
export const insertResults = async (rows) => ok(await sb.from('check_results').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));

export const listChecks = (limit = 50) =>
  cached('checks:' + limit, async () => ok(await sb.from('checks').select('*, vehicles(name)').order('created_at', { ascending: false }).limit(limit)));
export const problemResults = async (checkIds) => {
  if (!checkIds.length) return [];
  return cached('problems:' + checkIds.length + ':' + checkIds[0], async () =>
    ok(await sb.from('check_results').select('check_id,status').in('check_id', checkIds).neq('status', 'ok'))
  );
};
const chunk = (a, n = 40) => {
  const o = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
};
// Offene Mängel: fehlt/defekt, nicht behoben, und es ist das neueste Ergebnis dieses Gegenstands
export const openDefects = () => cached('openDefects', openDefectsRaw);
async function openDefectsRaw() {
  const rs = ok(
    await sb.from('check_results').select('*').neq('status', 'ok').neq('resolved_status', 'fixed').order('created_at', { ascending: false }).limit(500)
  );
  if (!rs.length) return [];
  const itemIds = [...new Set(rs.map((r) => r.item_id).filter(Boolean))];
  const checkIds = [...new Set(rs.map((r) => r.check_id))];
  const [hist, checks] = await Promise.all([
    Promise.all(chunk(itemIds).map(async (ids) => ok(await sb.from('check_results').select('item_id,created_at').in('item_id', ids).order('created_at', { ascending: false }).limit(1000)))),
    Promise.all(chunk(checkIds).map(async (ids) => ok(await sb.from('checks').select('id,vehicle_id,member_name,created_at').in('id', ids)))),
  ]);
  const latest = {};
  for (const h of hist.flat()) if (!latest[h.item_id] || h.created_at > latest[h.item_id]) latest[h.item_id] = h.created_at;
  const cmap = {};
  for (const c of checks.flat()) cmap[c.id] = c;
  return rs
    .filter((r) => !r.item_id || !latest[r.item_id] || r.created_at >= latest[r.item_id])
    .map((r) => ({ ...r, check: cmap[r.check_id] || null }))
    .filter((r) => r.check);
}
export const fixedDefects = (limit = 20) => cached('fixedDefects', () => fixedDefectsRaw(limit));
async function fixedDefectsRaw(limit) {
  const rs = ok(await sb.from('check_results').select('*').neq('status', 'ok').eq('resolved_status', 'fixed').order('resolved_at', { ascending: false }).limit(limit));
  if (!rs.length) return [];
  const checks = ok(await sb.from('checks').select('id,vehicle_id,member_name,created_at').in('id', [...new Set(rs.map((r) => r.check_id))]));
  const cmap = {};
  for (const c of checks) cmap[c.id] = c;
  return rs.map((r) => ({ ...r, check: cmap[r.check_id] || null })).filter((r) => r.check);
}
export const setDefectState = async (id, state, by, note) =>
  ok(
    await sb
      .from('check_results')
      .update({ resolved_status: state, resolved_at: state === 'open' ? null : new Date().toISOString(), resolved_by: state === 'open' ? null : by, resolve_note: note || null })
      .eq('id', id)
  );
async function pagedAll(make) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = ok(await make().range(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
export async function exportAll() {
  const t = (n, order) => pagedAll(() => sb.from(n).select('*').order(order || 'created_at'));
  const [vehicles, checklists, areas, items, checks, check_results] = await Promise.all([
    t('vehicles'), t('checklists'), t('areas'), t('items'), t('checks'), t('check_results'),
  ]);
  return { app: 'einsatzfahrzeug-state-tracker', exported_at: new Date().toISOString(), note: 'Fotos sind nicht enthalten, nur ihre Pfade (photo_path).', vehicles, checklists, areas, items, checks, check_results };
}
export const statsData = (sinceIso) => cached('stats:' + sinceIso.slice(0, 10), () => statsRaw(sinceIso));
async function statsRaw(sinceIso) {
  const [checks, results] = await Promise.all([
    pagedAll(() => sb.from('checks').select('id,vehicle_id,member_name,created_at,checklist_id,checklist_name').gte('created_at', sinceIso).order('created_at')),
    pagedAll(() => sb.from('check_results').select('check_id,item_id,item_name,area_name,status,resolved_status,created_at').gte('created_at', sinceIso).order('created_at')),
  ]);
  return { checks, results };
}
export const resultsForCheck = (checkId) =>
  cached('results:' + checkId, async () => ok(await sb.from('check_results').select('*').eq('check_id', checkId).order('area_name').order('item_name')));
export const deleteCheck = async (id) => ok(await sb.from('checks').delete().eq('id', id));

export const getSettings = () =>
  cached('settings', async () => {
    const { data, error } = await sb.rpc('get_settings');
    if (error) throw error;
    return data;
  });
export const updateSettings = async (org, code) => {
  const { error } = await sb.rpc('update_settings', { p_org: org, p_code: code });
  if (error) throw error;
};
export const listMembers = () => cached('members', async () => ok(await sb.from('members').select('*').order('created_at')));
export const removeMember = async (uid) => {
  const { error } = await sb.rpc('remove_member', { p_user: uid });
  if (error) throw error;
};

// ---------- Fotos ----------
const urlCache = new Map();
// Fotos sind unveränderlich (neue Datei = neuer Pfad). Darum zuerst aus dem lokalen Speicher,
// sonst per Link laden und im Hintergrund für offline merken.
const objUrls = new Map();
export async function photoUrl(path) {
  if (!path) return null;
  if (objUrls.has(path)) return objUrls.get(path);
  const blob = await blobGet('photos', path);
  if (blob) {
    const u = URL.createObjectURL(blob);
    objUrls.set(path, u);
    return u;
  }
  const c = urlCache.get(path);
  let url = c && c.exp > Date.now() ? c.url : null;
  if (!url) {
    try {
      const { data, error } = await sb.storage.from('photos').createSignedUrl(path, 3600);
      if (error || !data) return null;
      url = data.signedUrl;
      urlCache.set(path, { url, exp: Date.now() + 50 * 60 * 1000 });
    } catch (e) {
      return null;
    }
  }
  fetch(url)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => b && blobPut('photos', path, b))
    .catch(() => {});
  return url;
}

export async function uploadPhoto(prefix, blob) {
  const path = `${prefix}/${uuid()}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
export async function removePhoto(path) {
  if (!path) return;
  try {
    await sb.storage.from('photos').remove([path]);
  } catch (e) {
    /* Aufräumen ist nicht kritisch */
  }
}

// Foto verkleinern: längste Seite max. 1600 px, JPEG.
export async function compressImage(file, max = 1600, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const scale = Math.min(1, max / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('Foto konnte nicht verarbeitet werden.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
