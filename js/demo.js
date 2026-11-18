// Testmodus: ersetzt Supabase durch einen kleinen Speicher im Browser (localStorage).
// Zum Ausprobieren ohne Datenbank. Aktiv mit ?demo=1 in der Adresse.
//   ?demo=1      Testmodus an (mit Beispielfahrzeug)
//   ?demo=empty  Testmodus an, alles leer
//   ?demo=reset  Testdaten löschen und Beispiel neu laden
//   ?demo=off    Testmodus beenden
// Die Daten bleiben nur in diesem Browser auf diesem Gerät. Es wird nichts hochgeladen.
(function () {
  const cfg = (window.APP_CONFIG = window.APP_CONFIG || {});
  const qs = new URLSearchParams(location.search);
  const FLAG = 'fzcheck-demo';
  const DB = 'fzcheck-demo-db';
  const SESS = 'fzcheck-demo-sess';
  const SET = 'fzcheck-demo-set';
  const FILES = 'fzcheck-demo-files';
  const realConfig = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
  const param = qs.get('demo');

  if (param === 'off') {
    localStorage.removeItem(FLAG);
    history.replaceState(null, '', location.pathname + location.hash);
    return;
  }
  const active = qs.has('demo') || (localStorage.getItem(FLAG) === '1' && !realConfig);
  if (!active) return;

  if (param === 'reset' || param === 'empty') {
    [DB, SESS, SET, FILES].forEach((k) => localStorage.removeItem(k));
  }
  localStorage.setItem(FLAG, '1');
  if (qs.has('demo') && param !== '1') history.replaceState(null, '', location.pathname + '?demo=1' + location.hash);

  cfg.SUPABASE_URL = 'demo';
  cfg.SUPABASE_KEY = 'demo';
  cfg.DEMO_MODE = true;
  cfg.DEMO_ADMIN = { email: 'admin@demo.de', password: 'demo1234' };
  cfg.DEMO_CODE = 'Test-1234';

  const uid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || d;
    } catch (e) {
      return d;
    }
  };

  // ---------- Beispieldaten ----------
  const svg = (inner) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">${inner}</svg>`);
  const seedFiles = {
    'demo/vehicle.svg': svg(
      '<rect width="800" height="500" fill="#dfe7ef"/><rect y="400" width="800" height="100" fill="#b9c4d0"/>' +
        '<rect x="70" y="140" width="520" height="230" rx="18" fill="#c62828"/><path d="M590 190h90l60 80v100H590z" fill="#c62828"/>' +
        '<path d="M610 205h62l40 55h-102z" fill="#9ec5e8"/><rect x="110" y="190" width="150" height="120" rx="6" fill="#a31f1f"/>' +
        '<rect x="280" y="190" width="150" height="120" rx="6" fill="#a31f1f"/><rect x="450" y="190" width="120" height="120" rx="6" fill="#a31f1f"/>' +
        '<circle cx="180" cy="380" r="45" fill="#222"/><circle cx="660" cy="380" r="45" fill="#222"/><circle cx="180" cy="380" r="20" fill="#999"/><circle cx="660" cy="380" r="20" fill="#999"/>' +
        '<text x="400" y="80" font-size="34" text-anchor="middle" fill="#445">Beispielfoto Fahrzeug</text>'
    ),
    'demo/area1.svg': svg(
      '<rect width="800" height="500" fill="#2d3640"/><rect x="40" y="40" width="720" height="420" rx="14" fill="#47535f"/>' +
        '<rect x="90" y="90" width="200" height="140" rx="10" fill="#f1f1f1"/><rect x="170" y="130" width="40" height="60" fill="#c62828"/><rect x="150" y="150" width="80" height="20" fill="#c62828"/>' +
        '<polygon points="520,260 600,400 440,400" fill="none" stroke="#f5a623" stroke-width="16"/>' +
        '<rect x="480" y="90" width="230" height="90" rx="8" fill="#f5c518"/>' +
        '<text x="400" y="480" font-size="26" text-anchor="middle" fill="#cfd8e2">Beispielfoto Fach</text>'
    ),
    'demo/area2.svg': svg(
      '<rect width="800" height="500" fill="#2d3640"/><rect x="40" y="40" width="720" height="420" rx="14" fill="#47535f"/>' +
        '<rect x="100" y="120" width="260" height="60" rx="8" fill="#e08a00"/><rect x="440" y="100" width="220" height="220" rx="14" fill="#e6e6e6"/>' +
        '<text x="400" y="480" font-size="26" text-anchor="middle" fill="#cfd8e2">Beispielfoto Dach</text>'
    ),
  };

  function seed() {
    const vid = uid();
    const a1 = uid();
    const a2 = uid();
    const now = new Date();
    const due = new Date(now.getTime() + 20 * 86400000).toISOString().slice(0, 10);
    const t = now.toISOString();
    const mk = (area_id, name, qty, x, y, sort) => ({ id: uid(), area_id, name, qty, note: null, x, y, sort, created_at: t });
    return {
      vehicles: [{ id: vid, name: 'MTW 1 (Beispiel)', type: 'Mannschaftstransporter', location: 'Halle 2', notes: 'Beispieldaten zum Ausprobieren', next_inspection: due, inspection_months: 12, photo_path: 'demo/vehicle.svg', sort: 0, created_at: t }],
      areas: [
        { id: a1, vehicle_id: vid, name: 'Heck links', photo_path: 'demo/area1.svg', x: 0.22, y: 0.5, sort: 0, created_at: t },
        { id: a2, vehicle_id: vid, name: 'Dachbox', photo_path: 'demo/area2.svg', x: 0.55, y: 0.32, sort: 1, created_at: t },
      ],
      items: [
        mk(a1, 'Erste Hilfe Koffer', 1, 0.2, 0.35, 0),
        mk(a1, 'Warndreieck', 1, 0.62, 0.7, 1),
        mk(a1, 'Warnweste', 4, 0.72, 0.28, 2),
        mk(a2, 'Verlängerungskabel', 1, 0.28, 0.32, 0),
        mk(a2, 'Kanister', 2, 0.68, 0.42, 1),
      ],
      checks: [],
      check_results: [],
      members: [],
    };
  }

  let db = param === 'empty' ? { vehicles: [], areas: [], items: [], checks: [], check_results: [], members: [] } : load(DB, null) || seed();
  const save = () => localStorage.setItem(DB, JSON.stringify(db));
  save();

  const files = Object.assign({}, load(FILES, {}));
  const saveFiles = () => {
    try {
      localStorage.setItem(FILES, JSON.stringify(files));
    } catch (e) {
      console.warn('Demo: Speicher voll, Fotos bleiben nur bis zum Neuladen erhalten.');
    }
  };

  const sess = () => load(SESS, null);
  const setSess = (s) => (s ? localStorage.setItem(SESS, JSON.stringify(s)) : localStorage.removeItem(SESS));
  const settings = load(SET, { org_name: 'Demo Einheit', team_code: cfg.DEMO_CODE });
  const me = () => {
    const s = sess();
    if (!s) return { role: null };
    if (s.role === 'admin') return { role: 'admin', org: settings.org_name };
    const m = db.members.find((x) => x.user_id === s.id);
    return m ? { role: 'member', name: m.name, org: settings.org_name } : { role: null };
  };
  const err = (m) => ({ data: null, error: { message: m } });

  function builder(table) {
    const st = { op: 'select', filters: [], orders: [], lim: null, single: false, payload: null, ret: false, cols: '*' };
    const b = {
      select(c) { st.cols = c || '*'; if (st.op !== 'select') st.ret = true; return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(c, v) { st.filters.push((r) => r[c] === v); return b; },
      neq(c, v) { st.filters.push((r) => r[c] !== v); return b; },
      in(c, a) { st.filters.push((r) => a.includes(r[c])); return b; },
      order(c, o) { st.orders.push([c, !(o && o.ascending === false)]); return b; },
      limit(n) { st.lim = n; return b; },
      single() { st.single = true; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    function run() {
      const s = sess();
      if (!s) return err('Nicht angemeldet');
      const m = me();
      if (!m.role) return err('Kein Zugriff');
      const rows = db[table];
      const write = st.op !== 'select';
      const adminOnly = ['vehicles', 'areas', 'items'].includes(table) || (table === 'checks' && st.op === 'delete') || (table === 'check_results' && st.op !== 'insert');
      if (write && adminOnly && m.role !== 'admin') return err('new row violates row-level security policy');
      let out;
      if (st.op === 'insert') {
        const arr = Array.isArray(st.payload) ? st.payload : [st.payload];
        out = arr.map((p) => {
          const r = { id: uid(), created_at: new Date().toISOString(), ...p };
          if (table === 'items') { r.qty = r.qty ?? 1; r.x = r.x ?? null; r.y = r.y ?? null; r.note = r.note ?? null; }
          if (table === 'areas') { r.x = r.x ?? null; r.y = r.y ?? null; r.photo_path = r.photo_path ?? null; }
          if (table === 'vehicles') { r.photo_path = r.photo_path ?? null; }
          if (table === 'check_results') { r.resolved_status = r.resolved_status ?? 'open'; r.resolved_at = null; r.resolved_by = null; r.resolve_note = null; }
          if (table === 'checks') { r.user_id = s.id; r.member_name = m.role === 'member' ? m.name : p.member_name || 'Admin'; }
          rows.push(r);
          return r;
        });
      } else {
        const sel = rows.filter((r) => st.filters.every((f) => f(r)));
        if (st.op === 'update') sel.forEach((r) => Object.assign(r, st.payload));
        if (st.op === 'delete') {
          sel.forEach((r) => rows.splice(rows.indexOf(r), 1));
          if (table === 'checks') db.check_results = db.check_results.filter((x) => !sel.some((c) => c.id === x.check_id));
          if (table === 'vehicles') {
            const aids = db.areas.filter((a) => sel.some((v) => v.id === a.vehicle_id)).map((a) => a.id);
            db.areas = db.areas.filter((a) => !aids.includes(a.id));
            db.items = db.items.filter((i) => !aids.includes(i.area_id));
            db.checks = db.checks.filter((c) => !sel.some((v) => v.id === c.vehicle_id));
          }
          if (table === 'areas') db.items = db.items.filter((i) => !sel.some((a) => a.id === i.area_id));
        }
        out = sel;
      }
      save();
      if (write && !st.ret) return { data: null, error: null };
      out = out.slice();
      for (const [c, asc] of st.orders.slice().reverse()) out.sort((a, b2) => (a[c] > b2[c] ? 1 : a[c] < b2[c] ? -1 : 0) * (asc ? 1 : -1));
      if (st.lim) out = out.slice(0, st.lim);
      if (table === 'checks' && /vehicles\(/.test(st.cols)) out = out.map((c) => ({ ...c, vehicles: { name: (db.vehicles.find((v) => v.id === c.vehicle_id) || {}).name } }));
      out = JSON.parse(JSON.stringify(out));
      if (st.single) return out.length === 1 ? { data: out[0], error: null } : err('Keine Zeile');
      return { data: out, error: null };
    }
    return b;
  }

  const readAsDataURL = (blob) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });

  const client = {
    auth: {
      async getSession() { const s = sess(); return { data: { session: s ? { user: { id: s.id, is_anonymous: s.role !== 'admin' } } : null } }; },
      async signInAnonymously() { setSess({ id: uid(), role: 'anon' }); return { error: null }; },
      async signInWithPassword({ email, password }) {
        if (email.trim() === cfg.DEMO_ADMIN.email && password === cfg.DEMO_ADMIN.password) { setSess({ id: 'demo-admin', role: 'admin' }); return { error: null }; }
        return { error: { message: 'Anmeldung falsch. Im Testmodus: ' + cfg.DEMO_ADMIN.email + ' / ' + cfg.DEMO_ADMIN.password } };
      },
      async signOut() { setSess(null); return { error: null }; },
    },
    async rpc(name, a) {
      const s = sess();
      if (name === 'whoami') return { data: me(), error: null };
      if (name === 'check_code') return { data: a.p_code.trim() === settings.team_code, error: null };
      if (name === 'join_team') {
        if (!s) return err('Nicht angemeldet');
        if (a.p_code.trim() !== settings.team_code) return err('Code falsch');
        const ex = db.members.find((m) => m.user_id === s.id);
        if (ex) ex.name = a.p_name; else db.members.push({ user_id: s.id, name: a.p_name.trim(), created_at: new Date().toISOString() });
        save();
        return { data: me(), error: null };
      }
      if (name === 'get_settings') return !s || s.role !== 'admin' ? err('Nur Admin') : { data: { ...settings }, error: null };
      if (name === 'update_settings') {
        if (!s || s.role !== 'admin') return err('Nur Admin');
        if (a.p_code && a.p_code.trim().length < 6) return err('Code muss mindestens 6 Zeichen haben');
        if (a.p_org && a.p_org.trim()) settings.org_name = a.p_org.trim();
        if (a.p_code && a.p_code.trim()) settings.team_code = a.p_code.trim();
        localStorage.setItem(SET, JSON.stringify(settings));
        return { data: null, error: null };
      }
      if (name === 'remove_member') {
        if (!s || s.role !== 'admin') return err('Nur Admin');
        db.members = db.members.filter((m) => m.user_id !== a.p_user);
        save();
        return { data: null, error: null };
      }
      return err('unbekannte Funktion ' + name);
    },
    from: builder,
    storage: {
      from() {
        return {
          async upload(path, blob) {
            files[path] = await readAsDataURL(blob);
            saveFiles();
            return { data: { path }, error: null };
          },
          async remove(paths) {
            paths.forEach((p) => delete files[p]);
            saveFiles();
            return { data: [], error: null };
          },
          async createSignedUrl(path) {
            const u = files[path] || seedFiles[path];
            return u ? { data: { signedUrl: u }, error: null } : { data: null, error: { message: 'Foto fehlt' } };
          },
        };
      },
    },
  };
  window.supabase = { createClient: () => client };
})();
