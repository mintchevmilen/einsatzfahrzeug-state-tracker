// Zugriff auf Supabase, Fotos und kleine Hilfsfunktionen.
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
  const { data, error } = await sb.rpc('whoami');
  if (error) throw error;
  return data || { role: null };
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
}

// ---------- Daten ----------
function ok({ data, error }) {
  if (error) throw error;
  return data;
}

export const listVehicles = async () =>
  ok(await sb.from('vehicles').select('*').order('sort').order('name'));

export const lastChecks = async () =>
  ok(await sb.from('checks').select('vehicle_id,created_at,member_name').order('created_at', { ascending: false }).limit(300));

export const getVehicle = async (id) => ok(await sb.from('vehicles').select('*').eq('id', id).single());

export const listAreas = async (vehicleId) =>
  ok(await sb.from('areas').select('*').eq('vehicle_id', vehicleId).order('sort').order('created_at'));

export const listItemsForAreas = async (areaIds) => {
  if (!areaIds.length) return [];
  return ok(await sb.from('items').select('*').in('area_id', areaIds).order('sort').order('created_at'));
};

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

export const createCheck = async (row) => ok(await sb.from('checks').insert(row).select().single());
export const insertResults = async (rows) => ok(await sb.from('check_results').insert(rows));

export const listChecks = async (limit = 50) =>
  ok(await sb.from('checks').select('*, vehicles(name)').order('created_at', { ascending: false }).limit(limit));
export const problemResults = async (checkIds) => {
  if (!checkIds.length) return [];
  return ok(await sb.from('check_results').select('check_id,status').in('check_id', checkIds).neq('status', 'ok'));
};
export const resultsForCheck = async (checkId) =>
  ok(await sb.from('check_results').select('*').eq('check_id', checkId).order('area_name').order('item_name'));
export const deleteCheck = async (id) => ok(await sb.from('checks').delete().eq('id', id));

export const getSettings = async () => {
  const { data, error } = await sb.rpc('get_settings');
  if (error) throw error;
  return data;
};
export const updateSettings = async (org, code) => {
  const { error } = await sb.rpc('update_settings', { p_org: org, p_code: code });
  if (error) throw error;
};
export const listMembers = async () => ok(await sb.from('members').select('*').order('created_at'));
export const removeMember = async (uid) => {
  const { error } = await sb.rpc('remove_member', { p_user: uid });
  if (error) throw error;
};

// ---------- Fotos ----------
const urlCache = new Map();
export async function photoUrl(path) {
  if (!path) return null;
  const c = urlCache.get(path);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from('photos').createSignedUrl(path, 3600);
  if (error || !data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
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
