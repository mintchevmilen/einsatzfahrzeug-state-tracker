import * as api from './api.js';
import { esc, fmtDate, fmtDateTime, daysUntil, relPos, configured, uuid } from './api.js';
import { isNetErr, pendingList, pendingCount, pendingPut, pendingGet, pendingRemove, blobPut, blobGet, blobDel } from './offline.js';

const app = document.getElementById('app');
const S = { role: null, name: null, org: '', uid: null, edit: false, moving: null, openCount: 0 };

// ======================================================================
// Kleine UI Bausteine
// ======================================================================
function toast(msg, bad = false) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 2500);
}
function fail(e) {
  console.error(e);
  if (isNetErr(e)) return toast('Keine Verbindung. Das geht nur mit Netz.', true);
  toast(e && e.message ? e.message : 'Fehler', true);
}
let busyCount = 0;
function busy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  let el = document.getElementById('busy');
  if (busyCount > 0 && !el) {
    el = document.createElement('div');
    el.id = 'busy';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  } else if (busyCount === 0 && el) el.remove();
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC_SVG =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>';

let activeRec = null;
function toggleDictation(btn) {
  const input = btn.parentElement.querySelector('input,textarea');
  if (!input) return;
  if (activeRec) {
    const same = activeRec.btn === btn;
    activeRec.rec.stop();
    if (same) return;
  }
  const rec = new SR();
  rec.lang = 'de-DE';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  const base = input.value ? input.value.replace(/\s+$/, '') + ' ' : '';
  rec.onstart = () => btn.classList.add('rec');
  rec.onresult = (e) => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    input.value = base + t.trim();
  };
  rec.onerror = (e) => {
    btn.classList.remove('rec');
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Diktat ist hier nicht erlaubt oder nicht verfügbar. Nutze das Mikrofon der Tastatur.', true);
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Diktat fehlgeschlagen: ' + e.error, true);
  };
  rec.onend = () => {
    btn.classList.remove('rec');
    if (activeRec && activeRec.rec === rec) activeRec = null;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  activeRec = { rec, btn };
  try {
    rec.start();
  } catch (e) {
    activeRec = null;
  }
}
function bindMics(root) {
  root.querySelectorAll('[data-mic]').forEach((b) => {
    b.onclick = () => toggleDictation(b);
  });
}

export function photoField() {
  return `<div class="fld"><span>Foto</span><div class="stack">
    <label class="btn small filebtn">Kamera<input type="file" name="photocam" accept="image/*" capture="environment"></label>
    <label class="btn small filebtn">Aus Dateien<input type="file" name="photo" accept="image/*"></label>
  </div><div class="muted fname"></div></div>`;
}

export function field(label, name, o = {}) {
  const v = o.value ?? '';
  const req = o.required ? 'required' : '';
  const micOk = Boolean(SR) && !o.nomic && !o.file && !o.options && (o.textarea || !o.type || o.type === 'text');
  const mic = micOk ? `<button type="button" class="mic" data-mic aria-label="Diktieren" title="Diktieren">${MIC_SVG}</button>` : '';
  let input;
  if (o.options) input = `<select name="${name}">${o.options.map((x) => `<option value="${esc(x.value)}" ${String(x.value) === String(v) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>`;
  else if (o.textarea) input = `<textarea name="${name}" rows="3" ${req} placeholder="${esc(o.placeholder || '')}">${esc(v)}</textarea>`;
  else if (o.file) input = `<input type="file" name="${name}" accept="image/*">`;
  else
    input = `<input name="${name}" type="${o.type || 'text'}" value="${esc(v)}" ${req} ${o.attrs || ''} placeholder="${esc(o.placeholder || '')}" autocomplete="${o.autocomplete || 'off'}">`;
  return `<label class="fld"><span>${esc(label)}</span><div class="inwrap${o.textarea ? ' ta' : ''}">${input}${mic}</div></label>`;
}

// Dialog. Gibt null (abgebrochen) oder die Formularwerte plus __action zurück.
function modal({ title, body = '', ok = 'Speichern', actions = [] }) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<form class="modal" novalidate>
      <h3>${esc(title)}</h3>${body}
      <div class="mbtns">
        ${actions.map((a) => `<button type="button" class="btn ${a.cls || ''}" data-action="${a.key}">${esc(a.label)}</button>`).join('')}
        <button type="button" class="btn ghost" data-action="__cancel">Abbrechen</button>
        ${ok ? `<button type="submit" class="btn primary">${esc(ok)}</button>` : ''}
      </div></form>`;
    document.body.appendChild(ov);
    const form = ov.querySelector('form');
    const close = (val) => {
      if (activeRec) activeRec.rec.stop();
      ov.remove();
      resolve(val);
    };
    bindMics(ov);
    form.addEventListener('change', (e) => {
      if (e.target.type === 'file') {
        const out = form.querySelector('.fname');
        const names = [...form.querySelectorAll('input[type=file]')].map((i) => (i.files[0] ? i.files[0].name : '')).filter(Boolean);
        if (out) out.textContent = names.join(', ');
      }
    });
    const collect = (action) => {
      const out = { __action: action };
      new FormData(form).forEach((v, k) => (out[k] = v));
      return out;
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      close(collect('ok'));
    });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      if (b.dataset.action === '__cancel') close(null);
      else close(collect(b.dataset.action));
    });
    ov.addEventListener('click', (e) => {
      if (e.target === ov) close(null);
    });
    const first = form.querySelector('input:not([type=file]),textarea');
    if (first) first.focus();
  });
}

function pickPhoto(mode) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    if (mode === 'camera') i.setAttribute('capture', 'environment');
    i.style.display = 'none';
    document.body.appendChild(i);
    i.addEventListener('change', () => {
      resolve(i.files[0] || null);
      i.remove();
    });
    i.addEventListener('cancel', () => {
      resolve(null);
      i.remove();
    });
    i.click();
  });
}

async function uploadFile(file, prefix) {
  const blob = await api.compressImage(file);
  return api.uploadPhoto(prefix, blob);
}

// ======================================================================
// Foto mit Markierungen (Pins)
// ======================================================================
function pinBox(url, pins, emptyText) {
  if (!url) return `<div class="nophoto">${esc(emptyText || 'Noch kein Foto')}</div>`;
  const ps = pins
    .filter((p) => typeof p.x === 'number' && typeof p.y === 'number')
    .map(
      (p) =>
        `<button type="button" class="pin ${p.cls || ''}" data-id="${p.id}" style="left:${p.x * 100}%;top:${p.y * 100}%">${esc(p.label)}</button>`
    )
    .join('');
  return `<div class="pinbox" id="pinbox"><img id="pinimg" src="${esc(url)}" alt="Foto">${ps}</div>`;
}
function bindPinBox({ onPin, onTap }) {
  const box = document.getElementById('pinbox');
  if (!box) return;
  box.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin');
    if (pin) {
      e.stopPropagation();
      if (onPin) onPin(pin.dataset.id);
      return;
    }
    if (onTap) {
      const img = document.getElementById('pinimg');
      onTap(relPos(e.clientX, e.clientY, img.getBoundingClientRect()));
    }
  });
}

// ======================================================================
// Entwurf eines laufenden Checks (lokal im Gerät gespeichert)
// ======================================================================
const dkey = (vid) => `draft:${vid}`;
function getDraft(vid) {
  try {
    return JSON.parse(localStorage.getItem(dkey(vid)));
  } catch (e) {
    return null;
  }
}
function setDraft(vid, d) {
  localStorage.setItem(dkey(vid), JSON.stringify(d));
}
function clearDraft(vid) {
  localStorage.removeItem(dkey(vid));
}
// Gegenstände ohne Checkliste gehören zu jedem Check
const scopeItems = (items, draft) => (draft && draft.checklistId ? items.filter((i) => !i.checklist_id || i.checklist_id === draft.checklistId) : items);
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Wann wurde eine Checkliste zuletzt erledigt und wann ist sie wieder fällig?
// Ein Check "alle Gegenstände" zählt für jede Checkliste. Wartende (noch nicht gesendete) Checks zählen mit.
function checksOfVehicle(vid, checks) {
  const pend = pendingList().filter((p) => p.vehicle_id === vid).map((p) => ({ vehicle_id: vid, created_at: p.created_at, checklist_id: p.checklist_id }));
  return [...checks.filter((c) => c.vehicle_id === vid), ...pend];
}
function clStatus(cl, vchecks) {
  const done = vchecks.filter((c) => !c.checklist_id || c.checklist_id === cl.id).map((c) => c.created_at).sort().pop() || null;
  if (!cl.interval_days) return { last: done, due: null, days: null, never: !done };
  if (!done) return { last: null, due: null, days: null, never: true };
  const d = new Date(done);
  d.setDate(d.getDate() + cl.interval_days);
  const due = localDate(d);
  return { last: done, due, days: daysUntil(due), never: false };
}
const clText = (st) =>
  st.never ? 'noch nie gemacht' : st.days === null ? `zuletzt ${fmtDate(st.last)}` : st.days < 0 ? `überfällig seit ${-st.days} Tagen` : st.days === 0 ? 'heute fällig' : `fällig in ${st.days} Tagen`;
const clLevel = (st, cl) => (st.never ? (cl.interval_days ? 'yellow' : 'green') : st.days === null ? 'green' : st.days < 0 ? 'red' : st.days <= 2 ? 'yellow' : 'green');

// Drucken: füllt #printarea und öffnet den Druckdialog (dort "Als PDF speichern")
async function printArea(html) {
  let pa = document.getElementById('printarea');
  if (!pa) {
    pa = document.createElement('div');
    pa.id = 'printarea';
    document.body.appendChild(pa);
  }
  pa.innerHTML = html;
  await Promise.all([...pa.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
async function qrSvg(text, cell = 4) {
  const mod = await import('../vendor/qrcode.mjs');
  const q = mod.default(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
const baseUrl = () => location.origin + location.pathname;

// ======================================================================
// Warteschlange: fertige Checks werden zuerst lokal gespeichert und dann gesendet
// ======================================================================
let syncing = false;
async function sendOne(rec) {
  for (const r of rec.results) {
    if (r.photo_local) {
      const blob = await blobGet('pendphotos', r.photo_local);
      if (blob) r.photo_path = await api.uploadPhoto(`checks/${S.uid}`, blob);
      await blobDel('pendphotos', r.photo_local);
      r.photo_local = null;
      pendingPut(rec);
    }
  }
  await api.createCheck({
    id: rec.id,
    vehicle_id: rec.vehicle_id,
    member_name: rec.member_name,
    note: rec.note,
    checklist_id: rec.checklist_id,
    checklist_name: rec.checklist_name,
    created_at: rec.created_at,
  });
  await api.insertResults(
    rec.results.map((r) => ({
      id: r.id,
      check_id: rec.id,
      item_id: r.item_id,
      item_name: r.item_name,
      area_name: r.area_name,
      status: r.status,
      note: r.note,
      photo_path: r.photo_path || null,
      created_at: rec.created_at,
    }))
  );
}
async function syncPending() {
  if (syncing || !S.role) return { sent: 0, left: pendingCount(), err: null };
  syncing = true;
  let sent = 0;
  let err = null;
  try {
    for (const rec of pendingList()) {
      try {
        await sendOne(rec);
        await pendingRemove(rec.id);
        sent++;
      } catch (e) {
        err = e;
        const cur = pendingGet(rec.id) || rec;
        cur.error = isNetErr(e) ? null : (e && e.message) || String(e);
        pendingPut(cur);
        if (isNetErr(e)) break;
      }
    }
  } finally {
    syncing = false;
  }
  return { sent, left: pendingCount(), err };
}
async function trySync(rerender = true) {
  if (!pendingCount() || !S.role) return;
  const r = await syncPending();
  if (r.sent) {
    toast(r.sent === 1 ? '1 Check wurde gesendet' : `${r.sent} Checks wurden gesendet`);
    if (rerender) route();
  }
}
window.addEventListener('online', () => trySync(true));
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('#sync-now')) {
    busy(true);
    syncPending()
      .then((r) => {
        if (r.sent) toast(`${r.sent} Check(s) gesendet`);
        else if (r.err) fail(r.err);
        route();
      })
      .finally(() => busy(false));
  }
});
function pendingStrip() {
  const n = pendingCount();
  const off = typeof navigator !== 'undefined' && navigator.onLine === false;
  const errs = pendingList().filter((p) => p.error);
  return `${off ? '<div class="strip off">Kein Netz. Checks werden gespeichert und später gesendet.</div>' : ''}${
    n ? `<div class="strip pend">${n === 1 ? '1 Check wartet' : n + ' Checks warten'} auf das Senden${errs.length ? ' (Fehler: ' + esc(errs[0].error) + ')' : ''}. <button class="btn small" id="sync-now">Jetzt senden</button></div>` : ''
  }`;
}

const STATUS = {
  ok: { label: 'OK', long: 'Vorhanden' },
  missing: { label: 'Fehlt', long: 'Fehlt' },
  defect: { label: 'Defekt', long: 'Defekt' },
};

// ======================================================================
// Rahmen
// ======================================================================
function shell(inner, active) {
  const admin = S.role === 'admin';
  const demo = window.APP_CONFIG && window.APP_CONFIG.DEMO_MODE;
  return `
  ${demo ? '<div class="demo">Testmodus. Die Daten bleiben nur in diesem Browser. <a href="?demo=reset">Zurücksetzen</a> <a href="?demo=empty">Leer starten</a> <a href="?demo=off">Beenden</a></div>' : ''}
  <header class="top">
    <div class="brand">${esc(S.org || 'Fahrzeug Check')}</div>
    <div class="who">${admin ? 'Admin' : esc(S.name || '')}</div>
  </header>
  ${pendingStrip()}
  <main>${inner}</main>
  <nav class="tabs">
    <a href="#/" class="${active === 'home' ? 'on' : ''}">Fahrzeuge</a>
    <a href="#/defects" class="${active === 'defects' ? 'on' : ''}">Mängel${S.openCount ? ` <span class="nbadge">${S.openCount}</span>` : ''}</a>
    <a href="#/history" class="${active === 'history' ? 'on' : ''}">Verlauf</a>
    ${admin ? `<a href="#/stats" class="${active === 'stats' ? 'on' : ''}">Statistik</a>` : ''}
    <a href="#/settings" class="${active === 'settings' ? 'on' : ''}">${admin ? 'Einstellungen' : 'Konto'}</a>
  </nav>`;
}

// ======================================================================
// Ansicht: Einrichtung fehlt
// ======================================================================
function viewSetupMissing() {
  return {
    html: `<main class="narrow"><h1>Noch nicht eingerichtet</h1>
    <p>In der Datei <code>config.js</code> fehlen die Supabase Daten (URL und Publishable Key).
    Die Schritte stehen in <code>docs/EINRICHTUNG.md</code>.</p></main>`,
    bind() {},
  };
}

// ======================================================================
// Ansicht: Anmeldung
// ======================================================================
function viewLogin() {
  const lastName = localStorage.getItem('lastName') || '';
  const C = window.APP_CONFIG || {};
  const DEMO = C.DEMO_MODE ? { code: C.DEMO_CODE, admin: C.DEMO_ADMIN } : null;
  return {
    html: `<main class="narrow">
      <h1>Fahrzeug Check</h1>
      ${DEMO ? `<div class="banner demohint">Testmodus ohne Datenbank.<br>Prüfer: Code <strong>${esc(DEMO.code)}</strong>, Name frei.<br>Admin: <strong>${esc(DEMO.admin.email)}</strong> und Passwort <strong>${esc(DEMO.admin.password)}</strong>.</div>` : ''}
      <div class="seg"><button type="button" id="t-member" class="on">Prüfer</button><button type="button" id="t-admin">Admin</button></div>
      <form id="f-member" class="card pad">
        ${field('Teamcode', 'code', { required: true, autocomplete: 'off', nomic: true, placeholder: 'Code von deinem Admin' })}
        ${field('Dein Name', 'name', { required: true, value: lastName, autocomplete: 'name', nomic: true })}
        <button class="btn primary block" type="submit">Anmelden</button>
      </form>
      <form id="f-admin" class="card pad" hidden>
        ${field('E-Mail', 'email', { type: 'email', required: true, autocomplete: 'username' })}
        ${field('Passwort', 'password', { type: 'password', required: true, autocomplete: 'current-password' })}
        <button class="btn primary block" type="submit">Als Admin anmelden</button>
      </form>
    </main>`,
    bind() {
      const fm = document.getElementById('f-member');
      const fa = document.getElementById('f-admin');
      const tm = document.getElementById('t-member');
      const ta = document.getElementById('t-admin');
      tm.onclick = () => {
        fm.hidden = false;
        fa.hidden = true;
        tm.classList.add('on');
        ta.classList.remove('on');
      };
      ta.onclick = () => {
        fm.hidden = true;
        fa.hidden = false;
        ta.classList.add('on');
        tm.classList.remove('on');
      };
      fm.onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(fm));
        busy(true);
        try {
          const w = await api.memberLogin(d.code, d.name);
          localStorage.setItem('lastName', d.name.trim());
          await afterLogin(w);
        } catch (err) {
          fail(err);
        } finally {
          busy(false);
        }
      };
      fa.onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(fa));
        busy(true);
        try {
          const w = await api.adminLogin(d.email, d.password);
          if (w.role !== 'admin') {
            await api.logout();
            throw new Error('Dieses Konto ist kein Admin. Der Admin Zugang muss im Supabase Dashboard freigeschaltet werden.');
          }
          await afterLogin(w);
        } catch (err) {
          fail(err);
        } finally {
          busy(false);
        }
      };
    },
  };
}

async function afterLogin(w) {
  S.role = w.role;
  S.name = w.name || null;
  S.org = w.org || '';
  const { data } = await api.sb.auth.getSession();
  S.uid = data.session ? data.session.user.id : null;
  location.hash = '#/';
  route();
}

// ======================================================================
// Ansicht: Fahrzeugliste
// ======================================================================
async function viewHome() {
  const [vs, checks, defects, lists] = await Promise.all([api.listVehicles(), api.lastChecks(), api.openDefects(), api.allChecklists()]);
  S.openCount = defects.length;
  const last = {};
  for (const c of checks) if (!last[c.vehicle_id]) last[c.vehicle_id] = c;
  const defOf = {};
  for (const d of defects) (defOf[d.check.vehicle_id] ||= []).push(d);
  let nDue = 0;
  let nNever = 0;
  const urls = await Promise.all(vs.map((v) => api.photoUrl(v.photo_path)));
  const admin = S.role === 'admin';

  const cards = vs
    .map((v, i) => {
      const d = daysUntil(v.next_inspection);
      let due = '';
      if (d !== null) {
        const cls = d < 0 ? 'bad' : d <= 30 ? 'warn' : '';
        const txt = d < 0 ? `überfällig seit ${-d} Tagen` : d === 0 ? 'heute fällig' : `in ${d} Tagen`;
        due = `<div class="due ${cls}">Prüfung ${fmtDate(v.next_inspection)} (${txt})</div>`;
      }
      const l = last[v.id];
      const draft = getDraft(v.id);
      const ds = defOf[v.id] || [];
      const nOpen = ds.filter((x) => x.resolved_status === 'open').length;
      const nProg = ds.length - nOpen;
      const reasons = [];
      let lamp = 'green';
      if (nOpen) { lamp = 'red'; reasons.push(nOpen === 1 ? '1 offener Mangel' : `${nOpen} offene Mängel`); }
      if (nProg) { if (lamp === 'green') lamp = 'yellow'; reasons.push(`${nProg} in Arbeit`); }
      if (d !== null && d < 0) { lamp = 'red'; nDue++; reasons.push('Prüfung überfällig'); }
      else if (d !== null && d <= 30) { if (lamp === 'green') lamp = 'yellow'; nDue++; reasons.push('Prüfung bald fällig'); }
      const vch = checksOfVehicle(v.id, checks);
      let clDueFlag = false;
      for (const cl of lists.filter((x) => x.vehicle_id === v.id)) {
        const st = clStatus(cl, vch);
        const lv = clLevel(st, cl);
        if (lv === 'red') { lamp = 'red'; clDueFlag = true; reasons.push(`${cl.name} überfällig`); }
        else if (lv === 'yellow') { if (lamp === 'green') lamp = 'yellow'; clDueFlag = true; reasons.push(st.never ? `${cl.name} noch nie gemacht` : `${cl.name} bald fällig`); }
      }
      if (clDueFlag && !(d !== null && d <= 30)) nDue++;
      if (!l && !vch.length) { nNever++; if (lamp === 'green') lamp = 'yellow'; if (!clDueFlag) reasons.push('noch nie geprüft'); }
      return `<a class="card vcard" href="#/v/${v.id}">
        <div class="thumb">${urls[i] ? `<img src="${esc(urls[i])}" alt="">` : '<span>Kein Foto</span>'}</div>
        <div class="vinfo">
          <strong><span class="lamp ${lamp}" aria-label="${lamp === 'green' ? 'in Ordnung' : lamp === 'yellow' ? 'Achtung' : 'Handlungsbedarf'}"></span>${esc(v.name)}</strong>
          ${reasons.length ? `<div class="reasons ${lamp}">${esc(reasons.join(', '))}</div>` : '<div class="reasons green">In Ordnung</div>'}
          <div class="muted">${esc([v.type, v.location].filter(Boolean).join(', '))}</div>
          ${due}
          <div class="muted">${l ? `Letzter Check: ${fmtDateTime(l.created_at)}, ${esc(l.member_name)}` : 'Noch kein Check'}</div>
          ${draft ? '<div class="badge part">Check läuft</div>' : ''}
        </div></a>`;
    })
    .join('');

  return {
    active: 'home',
    html: `<h2>Fahrzeuge</h2>
      ${vs.length ? `<div class="tiles">
        <a class="tile ${defects.length ? 'red' : 'green'}" href="#/defects"><b>${defects.length}</b><span>offene Mängel</span></a>
        <div class="tile ${nDue ? 'yellow' : 'green'}"><b>${nDue}</b><span>Prüfung fällig</span></div>
        <div class="tile ${nNever ? 'yellow' : 'green'}"><b>${nNever}</b><span>nie geprüft</span></div>
      </div>` : ''}
      ${vs.length ? `<div class="list">${cards}</div>` : `<p class="muted">${admin ? 'Noch kein Fahrzeug. Lege das erste an.' : 'Der Admin hat noch kein Fahrzeug angelegt.'}</p>`}
      ${admin ? '<button class="btn primary block" id="add-v">+ Fahrzeug anlegen</button>' : ''}`,
    bind() {
      const b = document.getElementById('add-v');
      if (!b) return;
      b.onclick = async () => {
        const r = await modal({
          title: 'Neues Fahrzeug',
          body:
            field('Name oder Funkrufname', 'name', { required: true, placeholder: 'z. B. MTW 1' }) +
            field('Typ', 'type', { placeholder: 'z. B. Mannschaftstransporter' }) +
            field('Standort', 'location') +
            field('Nächste Prüfung (HU, UVV)', 'next_inspection', { type: 'date' }),
        });
        if (!r) return;
        busy(true);
        try {
          const row = await api.saveVehicle({
            name: r.name.trim(),
            type: r.type.trim() || null,
            location: r.location.trim() || null,
            next_inspection: r.next_inspection || null,
          });
          S.edit = true;
          location.hash = `#/v/${row.id}`;
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
      };
    },
  };
}

// ======================================================================
// Ansicht: Fahrzeug
// ======================================================================
async function viewVehicle(id) {
  const [v, areas, lists, allChecks] = await Promise.all([api.getVehicle(id), api.listAreas(id), api.listChecklists(id), api.lastChecks()]);
  const itemsAll = await api.listItemsForAreas(areas.map((a) => a.id));
  const url = await api.photoUrl(v.photo_path);
  const admin = S.role === 'admin';
  const edit = admin && S.edit;
  const draft = getDraft(id);
  const items = scopeItems(itemsAll, draft);
  const results = draft ? draft.results : {};
  const vchecks = checksOfVehicle(id, allChecks);

  const stats = (a) => {
    const its = items.filter((i) => i.area_id === a.id);
    const done = its.filter((i) => results[i.id] && results[i.id].status).length;
    return { total: its.length, done };
  };
  const pinCls = (a) => {
    if (!draft) return '';
    const s = stats(a);
    if (s.total && s.done === s.total) return 'ok';
    if (s.done) return 'part';
    return '';
  };
  const pins = areas.map((a, i) => ({ id: a.id, x: a.x === null ? null : Number(a.x), y: a.y === null ? null : Number(a.y), label: i + 1, cls: pinCls(a) }));

  const totalItems = items.length;
  const doneItems = items.filter((i) => results[i.id] && results[i.id].status).length;

  const areaRows = areas
    .map((a, i) => {
      const s = stats(a);
      return `<a class="row" href="#/v/${id}/a/${a.id}">
        <span class="num ${draft && s.total && s.done === s.total ? 'st-ok' : ''}">${i + 1}</span>
        <span class="grow"><strong>${esc(a.name)}</strong><div class="muted">${s.total} Gegenstände${a.photo_path ? '' : ', kein Foto'}${a.x === null ? ', ohne Position' : ''}</div></span>
        ${draft ? `<span class="badge ${s.total && s.done === s.total ? 'ok' : 'part'}">${s.done}/${s.total}</span>` : ''}
      </a>`;
    })
    .join('');

  const d = daysUntil(v.next_inspection);
  const dueTxt =
    d === null && !(S.role === 'admin' && v.inspection_months)
      ? ''
      : `<div class="due ${d !== null && d < 0 ? 'bad' : d !== null && d <= 30 ? 'warn' : ''}">${d === null ? 'Keine Prüfung eingetragen' : 'Nächste Prüfung ' + fmtDate(v.next_inspection)}${v.inspection_months ? ` (alle ${v.inspection_months} Monate)` : ''}
        ${S.role === 'admin' && v.inspection_months ? '<button class="btn small" id="insp-done">Prüfung erledigt</button>' : ''}</div>`;

  let checkBar = '';
  if (!edit) {
    if (draft) {
      checkBar = `<div class="card pad checkbar">
        <div><strong>Check läuft${draft.checklistName ? ': ' + esc(draft.checklistName) : ''}</strong><div class="muted">${doneItems} von ${totalItems} geprüft</div></div>
        <div class="stack"><button class="btn primary" id="finish">Abschließen</button><button class="btn ghost" id="discard">Verwerfen</button></div></div>`;
    } else {
      checkBar = `<button class="btn primary block" id="start" ${itemsAll.length ? '' : 'disabled'}>Check starten</button>${
        itemsAll.length ? '' : '<p class="muted">Es sind noch keine Gegenstände angelegt.</p>'
      }`;
    }
  }

  const listBox = lists.length
    ? `<div class="card pad"><h3>Checklisten</h3>${lists
        .map((cl) => {
          const st = clStatus(cl, vchecks);
          return `<div class="clrow"><span class="lamp ${clLevel(st, cl)}"></span><span class="grow"><strong>${esc(cl.name)}</strong>${cl.interval_days ? ` <span class="muted">alle ${cl.interval_days} Tage</span>` : ''}<div class="muted">${esc(clText(st))}</div></span></div>`;
        })
        .join('')}</div>`
    : '';
  const toolsBox = admin && !edit
    ? `<div class="card pad"><h3>Werkzeuge</h3><div class="stack wrap">
        <button class="btn small" id="t-qr">QR Codes drucken</button>
        <button class="btn small" id="t-sheet">Fahrzeugblatt (PDF)</button>
        <button class="btn small" id="t-xlsx">Excel</button></div></div>`
    : '';
  const movingBar = S.moving && S.moving.kind === 'area' ? `<div class="banner">Tippe auf das Foto, um die neue Position zu setzen. <button class="btn small" id="cancel-move">Abbrechen</button></div>` : '';

  const editPanel = edit
    ? `<div class="card pad editpanel">
        <div class="muted">Bearbeiten: Tippe auf das Foto, um ein Fach zu markieren. Tippe auf eine Nummer, um es zu ändern.</div>
        <div class="stack wrap">
          <button class="btn" id="e-vehicle">Fahrzeugdaten</button>
          <button class="btn" id="e-lists">Checklisten (${lists.length})</button>
          <button class="btn" id="e-photo-cam">${v.photo_path ? 'Neues Foto (Kamera)' : 'Foto aufnehmen'}</button>
          <button class="btn" id="e-photo-file">Foto aus Dateien</button>
          <button class="btn" id="e-area">+ Fach ohne Markierung</button>
          <button class="btn danger" id="e-del">Fahrzeug löschen</button>
        </div></div>`
    : '';

  return {
    active: 'home',
    html: `<a class="back" href="#/">‹ Fahrzeuge</a>
      <h2>${esc(v.name)}</h2>
      <div class="muted">${esc([v.type, v.location].filter(Boolean).join(', '))}</div>
      ${dueTxt}
      ${v.notes ? `<p>${esc(v.notes)}</p>` : ''}
      ${admin ? `<label class="switch"><input type="checkbox" id="edit-toggle" ${edit ? 'checked' : ''}><span>Bearbeiten</span></label>` : ''}
      ${movingBar}
      ${pinBox(url, pins, admin ? 'Noch kein Foto. Nimm ein Foto vom Fahrzeug auf.' : 'Kein Foto vorhanden')}
      ${editPanel}
      ${checkBar}
      ${listBox}
      <h3>Fächer</h3>
      <div class="rows">${areaRows || '<p class="muted">Noch keine Fächer.</p>'}</div>
      ${toolsBox}`,
    bind() {
      const tg = document.getElementById('edit-toggle');
      if (tg)
        tg.onchange = () => {
          S.edit = tg.checked;
          S.moving = null;
          route();
        };
      const cm = document.getElementById('cancel-move');
      if (cm)
        cm.onclick = () => {
          S.moving = null;
          route();
        };

      bindPinBox({
        onPin: async (aid) => {
          if (!edit) {
            location.hash = `#/v/${id}/a/${aid}`;
            return;
          }
          const a = areas.find((x) => x.id === aid);
          const r = await modal({
            title: `Fach ${areas.indexOf(a) + 1}`,
            body: field('Name', 'name', { value: a.name, required: true }),
            actions: [
              { key: 'open', label: 'Öffnen' },
              { key: 'move', label: 'Verschieben' },
              { key: 'del', label: 'Löschen', cls: 'danger' },
            ],
          });
          if (!r) return;
          let started = false;
          try {
            if (r.__action === 'open') {
              location.hash = `#/v/${id}/a/${aid}`;
              return;
            }
            if (r.__action === 'move') {
              S.moving = { kind: 'area', id: aid };
              route();
              return;
            }
            if (r.__action === 'del') {
              if (!confirm(`Fach "${a.name}" mit allen Gegenständen löschen?`)) return;
              busy(true);
              started = true;
              await api.deleteArea(aid);
              await api.removePhoto(a.photo_path);
            } else {
              busy(true);
              started = true;
              await api.saveArea({ id: aid, name: r.name.trim() });
            }
          } catch (e) {
            fail(e);
          } finally {
            if (started) busy(false);
          }
          route();
        },
        onTap: edit
          ? async (pos) => {
              if (S.moving && S.moving.kind === 'area') {
                const mid = S.moving.id;
                S.moving = null;
                busy(true);
                try {
                  await api.saveArea({ id: mid, x: pos.x, y: pos.y });
                } catch (e) {
                  fail(e);
                } finally {
                  busy(false);
                }
                route();
                return;
              }
              const r = await modal({
                title: 'Neues Fach',
                body: field('Name', 'name', { required: true, placeholder: 'z. B. Staukasten links hinten' }),
              });
              if (!r) return;
              busy(true);
              try {
                await api.saveArea({ vehicle_id: id, name: r.name.trim(), x: pos.x, y: pos.y, sort: areas.length });
              } catch (e) {
                fail(e);
              } finally {
                busy(false);
              }
              route();
            }
          : null,
      });

      const on = (idn, fn) => {
        const el = document.getElementById(idn);
        if (el) el.onclick = fn;
      };

      on('insp-done', async () => {
        const base = new Date();
        base.setMonth(base.getMonth() + v.inspection_months);
        const next = base.toISOString().slice(0, 10);
        if (!confirm(`Prüfung als erledigt eintragen? Die nächste Prüfung wird der ${fmtDate(next)}.`)) return;
        busy(true);
        try {
          await api.saveVehicle({ id, next_inspection: next });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      });

      on('e-vehicle', async () => {
        const r = await modal({
          title: 'Fahrzeugdaten',
          body:
            field('Name', 'name', { value: v.name, required: true }) +
            field('Typ', 'type', { value: v.type || '' }) +
            field('Standort', 'location', { value: v.location || '' }) +
            field('Nächste Prüfung', 'next_inspection', { type: 'date', value: v.next_inspection || '' }) +
            field('Prüfintervall in Monaten (optional)', 'inspection_months', { type: 'number', value: v.inspection_months || '', nomic: true, placeholder: 'z. B. 12' }) +
            field('Hinweise', 'notes', { textarea: true, value: v.notes || '' }),
        });
        if (!r) return;
        busy(true);
        try {
          await api.saveVehicle({
            id,
            name: r.name.trim(),
            type: r.type.trim() || null,
            location: r.location.trim() || null,
            next_inspection: r.next_inspection || null,
            inspection_months: Math.min(60, Math.max(1, parseInt(r.inspection_months, 10) || 0)) || null,
            notes: r.notes.trim() || null,
          });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      });

      const setVehiclePhoto = async (mode) => {
        const f = await pickPhoto(mode);
        if (!f) return;
        busy(true);
        try {
          const path = await uploadFile(f, `vehicles/${id}`);
          await api.saveVehicle({ id, photo_path: path });
          await api.removePhoto(v.photo_path);
          toast('Foto gespeichert');
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      };
      on('e-photo-cam', () => setVehiclePhoto('camera'));
      on('e-photo-file', () => setVehiclePhoto('file'));

      on('e-area', async () => {
        const r = await modal({ title: 'Neues Fach', body: field('Name', 'name', { required: true }) });
        if (!r) return;
        busy(true);
        try {
          await api.saveArea({ vehicle_id: id, name: r.name.trim(), sort: areas.length });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      });

      on('e-del', async () => {
        if (!confirm(`Fahrzeug "${v.name}" mit allen Fächern, Gegenständen und Checks löschen? Das geht nicht rückgängig.`)) return;
        busy(true);
        try {
          await api.deleteVehicle(id);
          await api.removePhoto(v.photo_path);
          for (const a of areas) await api.removePhoto(a.photo_path);
          clearDraft(id);
          location.hash = '#/';
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
      });

      on('start', async () => {
        let pick = { checklistId: null, checklistName: null };
        if (lists.length) {
          const r = await modal({
            title: 'Welcher Check?',
            body: '<p class="muted">Gegenstände ohne Zuordnung gehören zu jedem Check.</p>',
            ok: '',
            actions: [
              ...lists.map((cl) => ({ key: 'cl:' + cl.id, label: `${cl.name} (${clText(clStatus(cl, vchecks))})` })),
              { key: 'all', label: 'Alle Gegenstände (voller Check)' },
            ],
          });
          if (!r) return;
          if (r.__action.startsWith('cl:')) {
            const cl = lists.find((x) => x.id === r.__action.slice(3));
            pick = { checklistId: cl.id, checklistName: cl.name };
          }
        }
        setDraft(id, { started: new Date().toISOString(), results: {}, ...pick });
        route();
      });
      on('discard', async () => {
        if (!confirm('Check verwerfen? Alle Häkchen gehen verloren.')) return;
        const d = getDraft(id);
        if (d) for (const r of Object.values(d.results)) if (r.photo_local) await blobDel('pendphotos', r.photo_local);
        clearDraft(id);
        route();
      });
      on('finish', () => finishCheck(v, areas, items));
      on('e-lists', () => (location.hash = `#/v/${id}/lists`));
      on('t-qr', () => vehicleQr(v, areas));
      on('t-sheet', () => vehicleSheet(v, areas, itemsAll, lists, vchecks));
      on('t-xlsx', () => excelExport(v.id));
    },
  };
}

async function finishCheck(v, areas, items) {
  const draft = getDraft(v.id);
  if (!draft) return;
  const total = items.length;
  const done = items.filter((i) => draft.results[i.id] && draft.results[i.id].status).length;
  if (done === 0) {
    toast('Es wurde noch nichts geprüft.', true);
    return;
  }
  const rest = total - done;
  const r = await modal({
    title: 'Check abschließen',
    body: `<p>${done} von ${total} Gegenständen geprüft.${rest ? ` ${rest} nicht geprüfte werden nicht gespeichert.` : ''}</p>${field('Bemerkung (optional)', 'note', { textarea: true })}`,
    ok: 'Abschließen',
  });
  if (!r) return;
  const areaName = Object.fromEntries(areas.map((a) => [a.id, a.name]));
  const rec = {
    id: draft.checkId || uuid(),
    vehicle_id: v.id,
    vehicle_name: v.name,
    checklist_id: draft.checklistId || null,
    checklist_name: draft.checklistName || null,
    member_name: S.name || 'Admin',
    note: (r.note || '').trim() || null,
    created_at: new Date().toISOString(),
    error: null,
    results: items
      .filter((i) => draft.results[i.id] && draft.results[i.id].status)
      .map((i) => ({
        id: uuid(),
        item_id: i.id,
        item_name: i.name,
        area_name: areaName[i.area_id] || null,
        status: draft.results[i.id].status,
        note: draft.results[i.id].note || null,
        photo_path: draft.results[i.id].photo_path || null,
        photo_local: draft.results[i.id].photo_local || null,
      })),
  };
  // Erst lokal sichern, dann senden. So geht nichts verloren, auch ohne Netz.
  pendingPut(rec);
  clearDraft(v.id);
  busy(true);
  try {
    const res = await syncPending();
    if (!pendingGet(rec.id)) toast('Check gespeichert');
    else if (res.err && !isNetErr(res.err)) toast('Gespeichert, Senden hat nicht geklappt: ' + (res.err.message || res.err), true);
    else toast('Kein Netz. Der Check ist gespeichert und wird später gesendet.');
  } finally {
    busy(false);
  }
  location.hash = '#/history';
  route();
}

// ======================================================================
// Ansicht: Fach
// ======================================================================
async function viewArea(vid, aid) {
  const [v, areas, lists] = await Promise.all([api.getVehicle(vid), api.listAreas(vid), api.listChecklists(vid)]);
  const area = areas.find((a) => a.id === aid);
  if (!area) throw new Error('Fach nicht gefunden');
  const itemsAll = await api.listItemsForAreas([aid]);
  const url = await api.photoUrl(area.photo_path);
  const admin = S.role === 'admin';
  const edit = admin && S.edit;
  const draft = getDraft(vid);
  const checking = Boolean(draft) && !edit;
  const items = checking ? scopeItems(itemsAll, draft) : itemsAll;
  const listName = Object.fromEntries(lists.map((l) => [l.id, l.name]));
  const res = (id) => (draft && draft.results[id]) || {};
  const cls = (id) => res(id).status || '';

  const pins = items.map((it, i) => ({
    id: it.id,
    x: it.x === null ? null : Number(it.x),
    y: it.y === null ? null : Number(it.y),
    label: i + 1,
    cls: cls(it.id),
  }));

  const rows = items
    .map((it, i) => {
      const r = res(it.id);
      return `<li class="item" data-id="${it.id}">
        <div class="itop">
          <span class="num st-${r.status || 'none'}">${i + 1}</span>
          <div class="grow"><strong>${esc(it.name)}</strong>${it.qty > 1 ? ` <span class="qty">x ${it.qty}</span>` : ''}
            ${it.note ? `<div class="muted">${esc(it.note)}</div>` : ''}
            ${edit && it.checklist_id ? `<span class="tag">${esc(listName[it.checklist_id] || '')}</span>` : ''}
            <div class="rnote muted">${r.note ? esc(r.note) : ''}${r.photo_path || r.photo_local ? ' (Foto)' : ''}</div>
          </div>
          ${edit ? `<button class="btn small" data-edit="${it.id}">Ändern</button>` : ''}
        </div>
        ${
          checking
            ? `<div class="stbtns">
              ${['ok', 'missing', 'defect'].map((s) => `<button type="button" class="st st-${s} ${r.status === s ? 'on' : ''}" data-st="${s}">${STATUS[s].label}</button>`).join('')}
              <button type="button" class="btn small" data-more="${it.id}">Notiz / Foto</button>
            </div>`
            : ''
        }
      </li>`;
    })
    .join('');

  const doneCount = items.filter((it) => res(it.id).status).length;
  const movingBar = S.moving && S.moving.kind === 'item' ? `<div class="banner">Tippe auf das Foto, um die neue Position zu setzen. <button class="btn small" id="cancel-move">Abbrechen</button></div>` : '';

  const editPanel = edit
    ? `<div class="card pad editpanel">
        <div class="muted">Bearbeiten: Tippe auf das Foto, um einen Gegenstand zu markieren. Den Namen kannst du über das Mikrofon der Tastatur diktieren.</div>
        <div class="stack wrap">
          <button class="btn" id="a-rename">Fach umbenennen</button>
          <button class="btn" id="a-photo-cam">${area.photo_path ? 'Neues Foto (Kamera)' : 'Foto aufnehmen'}</button>
          <button class="btn" id="a-photo-file">Foto aus Dateien</button>
          <button class="btn" id="a-item">+ Gegenstand ohne Markierung</button>
          <button class="btn danger" id="a-del">Fach löschen</button>
        </div></div>`
    : '';

  return {
    active: 'home',
    html: `<a class="back" href="#/v/${vid}">‹ ${esc(v.name)}</a>
      <h2>${esc(area.name)}</h2>
      ${checking ? `<div class="progress"><div style="width:${items.length ? (doneCount / items.length) * 100 : 0}%"></div><span id="pcount">${doneCount} von ${items.length} geprüft</span></div>` : ''}
      ${admin ? `<label class="switch"><input type="checkbox" id="edit-toggle" ${edit ? 'checked' : ''}><span>Bearbeiten</span></label>` : ''}
      ${movingBar}
      ${pinBox(url, pins, admin ? 'Noch kein Foto. Nimm ein Foto vom Fach auf.' : 'Kein Foto vorhanden')}
      ${editPanel}
      <ol class="items">${rows || '<p class="muted">Noch keine Gegenstände.</p>'}</ol>
      ${!checking && !edit && !draft && items.length ? '<p class="muted">Starte beim Fahrzeug einen Check, um Gegenstände abzuhaken.</p>' : ''}`,
    bind() {
      const tg = document.getElementById('edit-toggle');
      if (tg)
        tg.onchange = () => {
          S.edit = tg.checked;
          S.moving = null;
          route();
        };
      const cm = document.getElementById('cancel-move');
      if (cm)
        cm.onclick = () => {
          S.moving = null;
          route();
        };

      const itemModal = (it, pos) =>
        modal({
          title: it ? 'Gegenstand ändern' : 'Neuer Gegenstand',
          body:
            field('Name', 'name', { value: it ? it.name : '', required: true, placeholder: 'z. B. Erste Hilfe Koffer' }) +
            field('Soll Menge', 'qty', { type: 'number', value: it ? it.qty : 1, attrs: 'min="0" inputmode="numeric"' }) +
            (lists.length
              ? field('Gehört zu Check', 'checklist_id', {
                  options: [{ value: '', label: 'Jeder Check' }, ...lists.map((l) => ({ value: l.id, label: l.name }))],
                  value: it ? it.checklist_id || '' : '',
                })
              : '') +
            field('Hinweis (optional)', 'note', { textarea: true, value: it ? it.note || '' : '' }),
          actions: it
            ? [
                { key: 'move', label: 'Verschieben' },
                { key: 'del', label: 'Löschen', cls: 'danger' },
              ]
            : [],
        });

      const saveNew = async (pos) => {
        const r = await itemModal(null, pos);
        if (!r) return;
        busy(true);
        try {
          await api.saveItem({
            area_id: aid,
            name: r.name.trim(),
            qty: Math.max(0, parseInt(r.qty, 10) || 1),
            checklist_id: r.checklist_id || null,
            note: (r.note || '').trim() || null,
            x: pos ? pos.x : null,
            y: pos ? pos.y : null,
            sort: items.length,
          });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      };

      bindPinBox({
        onPin: async (iid) => {
          if (edit) {
            const it = items.find((x) => x.id === iid);
            const r = await itemModal(it);
            if (!r) return;
            await editItemResult(it, r);
          } else {
            const row = document.querySelector(`.item[data-id="${iid}"]`);
            if (row) {
              row.scrollIntoView({ behavior: 'smooth', block: 'center' });
              row.classList.add('flash');
              setTimeout(() => row.classList.remove('flash'), 1200);
            }
          }
        },
        onTap: edit
          ? async (pos) => {
              if (S.moving && S.moving.kind === 'item') {
                const mid = S.moving.id;
                S.moving = null;
                busy(true);
                try {
                  await api.saveItem({ id: mid, x: pos.x, y: pos.y });
                } catch (e) {
                  fail(e);
                } finally {
                  busy(false);
                }
                route();
                return;
              }
              saveNew(pos);
            }
          : null,
      });

      async function editItemResult(it, r) {
        if (r.__action === 'del' && !confirm(`"${it.name}" löschen?`)) return;
        busy(true);
        try {
          if (r.__action === 'move') {
            S.moving = { kind: 'item', id: it.id };
          } else if (r.__action === 'del') {
            await api.deleteItem(it.id);
          } else {
            await api.saveItem({
              id: it.id,
              name: r.name.trim(),
              qty: Math.max(0, parseInt(r.qty, 10) || 1),
              checklist_id: r.checklist_id === undefined ? it.checklist_id : r.checklist_id || null,
              note: (r.note || '').trim() || null,
            });
          }
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      }

      document.querySelectorAll('[data-edit]').forEach((b) => {
        b.onclick = async () => {
          const it = items.find((x) => x.id === b.dataset.edit);
          const r = await itemModal(it);
          if (r) await editItemResult(it, r);
        };
      });

      const on = (idn, fn) => {
        const el = document.getElementById(idn);
        if (el) el.onclick = fn;
      };
      on('a-item', () => saveNew(null));
      on('a-rename', async () => {
        const r = await modal({ title: 'Fach umbenennen', body: field('Name', 'name', { value: area.name, required: true }) });
        if (!r) return;
        busy(true);
        try {
          await api.saveArea({ id: aid, name: r.name.trim() });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      });
      const setAreaPhoto = async (mode) => {
        const f = await pickPhoto(mode);
        if (!f) return;
        busy(true);
        try {
          const path = await uploadFile(f, `areas/${aid}`);
          await api.saveArea({ id: aid, photo_path: path });
          await api.removePhoto(area.photo_path);
          toast('Foto gespeichert');
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      };
      on('a-photo-cam', () => setAreaPhoto('camera'));
      on('a-photo-file', () => setAreaPhoto('file'));
      on('a-del', async () => {
        if (!confirm(`Fach "${area.name}" mit allen Gegenständen löschen?`)) return;
        busy(true);
        try {
          await api.deleteArea(aid);
          await api.removePhoto(area.photo_path);
          location.hash = `#/v/${vid}`;
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
      });

      // ---- Check Modus ----
      if (!checking) return;

      const paint = (iid) => {
        const row = document.querySelector(`.item[data-id="${iid}"]`);
        const r = res(iid);
        if (row) {
          row.querySelectorAll('.st').forEach((b) => b.classList.toggle('on', b.dataset.st === r.status));
          const num = row.querySelector('.num');
          num.className = 'num st-' + (r.status || 'none');
          row.querySelector('.rnote').textContent = (r.note || '') + (r.photo_path || r.photo_local ? ' (Foto)' : '');
        }
        const pin = document.querySelector(`.pin[data-id="${iid}"]`);
        if (pin) pin.className = 'pin ' + (r.status || '');
        const n = items.filter((it) => res(it.id).status).length;
        const pc = document.getElementById('pcount');
        if (pc) {
          pc.textContent = `${n} von ${items.length} geprüft`;
          pc.previousElementSibling.style.width = items.length ? (n / items.length) * 100 + '%' : '0%';
        }
      };

      document.querySelectorAll('.st').forEach((b) => {
        b.onclick = () => {
          const iid = b.closest('.item').dataset.id;
          const d = getDraft(vid);
          const cur = d.results[iid] || {};
          cur.status = cur.status === b.dataset.st ? null : b.dataset.st;
          d.results[iid] = cur;
          setDraft(vid, d);
          draft.results = d.results;
          paint(iid);
          if (cur.status && cur.status !== 'ok' && !cur.note && !cur.photo_path) {
            // Bei Mangel kurz zur Notiz anbieten
            const more = b.closest('.item').querySelector('[data-more]');
            if (more) more.classList.add('attn');
          }
        };
      });

      document.querySelectorAll('[data-more]').forEach((b) => {
        b.onclick = async () => {
          const iid = b.dataset.more;
          const d = getDraft(vid);
          const cur = d.results[iid] || {};
          const r = await modal({
            title: 'Notiz und Foto',
            body: field('Notiz (diktieren geht über die Tastatur)', 'note', { textarea: true, value: cur.note || '' }) + photoField(),
          });
          if (!r) return;
          busy(true);
          try {
            cur.note = (r.note || '').trim() || null;
            const pf = [r.photocam, r.photo].find((f) => f && f.size);
            if (pf) {
              const oldPath = cur.photo_path;
              const oldLocal = cur.photo_local;
              const blob = await api.compressImage(pf);
              try {
                cur.photo_path = await api.uploadPhoto(`checks/${S.uid}`, blob);
                cur.photo_local = null;
                if (oldPath) await api.removePhoto(oldPath);
              } catch (e) {
                if (!isNetErr(e)) throw e;
                // Kein Netz: Foto bleibt lokal und wird mit dem Check gesendet
                const key = 'lp:' + uuid();
                await blobPut('pendphotos', key, blob);
                cur.photo_local = key;
                cur.photo_path = null;
                toast('Kein Netz. Das Foto wird später mit dem Check gesendet.');
              }
              if (oldLocal) await blobDel('pendphotos', oldLocal);
            }
            d.results[iid] = cur;
            setDraft(vid, d);
            draft.results = d.results;
            paint(iid);
            b.classList.remove('attn');
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
        };
      });
    },
  };
}

// ======================================================================
// Ansicht: Mängel (offen bis behoben)
// ======================================================================
async function viewDefects() {
  const [vs, defects, fixed] = await Promise.all([api.listVehicles(), api.openDefects(), api.fixedDefects(20)]);
  S.openCount = defects.length;
  const admin = S.role === 'admin';
  const vname = {};
  for (const v of vs) vname[v.id] = v.name;
  const all = [...defects, ...fixed];
  const thumbs = await Promise.all(all.map((r) => api.photoUrl(r.photo_path)));
  const turl = {};
  all.forEach((r, i) => (turl[r.id] = thumbs[i]));

  const entry = (r, isFixed) => {
    const st = r.resolved_status;
    return `<li class="defect">
      <div class="dtop"><span class="badge bad">${STATUS[r.status].long}</span>
        <span class="badge ${st === 'fixed' ? 'ok' : st === 'progress' ? 'part' : 'bad'}">${st === 'fixed' ? 'Behoben' : st === 'progress' ? 'In Arbeit' : 'Offen'}</span></div>
      <strong>${esc(r.item_name)}</strong> <span class="muted">${esc(r.area_name || '')}</span>
      <div class="muted">Gefunden ${fmtDateTime(r.check.created_at)}, ${esc(r.check.member_name)}</div>
      ${r.note ? `<div>${esc(r.note)}</div>` : ''}
      ${st !== 'open' && r.resolved_at ? `<div class="muted">${st === 'fixed' ? 'Behoben' : 'In Arbeit seit'} ${fmtDateTime(r.resolved_at)}, ${esc(r.resolved_by || '')}${r.resolve_note ? ': ' + esc(r.resolve_note) : ''}</div>` : ''}
      ${turl[r.id] ? `<a href="${esc(turl[r.id])}" target="_blank" rel="noopener"><img class="rthumb" src="${esc(turl[r.id])}" alt="Foto"></a>` : ''}
      ${admin ? `<div class="stack">
        ${st !== 'progress' && !isFixed ? `<button class="btn small" data-def="${r.id}" data-to="progress">In Arbeit</button>` : ''}
        ${!isFixed ? `<button class="btn small primary" data-def="${r.id}" data-to="fixed">Behoben</button>` : ''}
        ${st !== 'open' ? `<button class="btn small" data-def="${r.id}" data-to="open">Wieder offen</button>` : ''}
      </div>` : ''}
    </li>`;
  };
  const group = (list, isFixed) => {
    const by = {};
    for (const r of list) (by[r.check.vehicle_id] ||= []).push(r);
    return Object.keys(by)
      .map((vid) => `<div class="card pad"><h3>${esc(vname[vid] || 'Fahrzeug')}</h3><ul class="rlist">${by[vid].map((r) => entry(r, isFixed)).join('')}</ul></div>`)
      .join('');
  };

  return {
    active: 'defects',
    html: `<h2>Mängel</h2>
      ${defects.length ? group(defects, false) : '<p class="muted">Keine offenen Mängel.</p>'}
      ${fixed.length ? `<h3>Zuletzt behoben</h3>${group(fixed, true)}` : ''}
      <p class="muted">Ein Mangel gilt auch als erledigt, wenn der Gegenstand bei einem späteren Check wieder mit OK abgehakt wird.</p>
      ${admin ? '<button class="btn block" id="def-xlsx">Mängel als Excel herunterladen</button>' : ''}`,
    bind() {
      const dx = document.getElementById('def-xlsx');
      if (dx) dx.onclick = () => excelExport(null);
      document.querySelectorAll('[data-def]').forEach((b) => {
        b.onclick = async () => {
          const to = b.dataset.to;
          let note = '';
          if (to === 'fixed' || to === 'progress') {
            const r = await modal({
              title: to === 'fixed' ? 'Mangel als behoben melden' : 'Mangel in Arbeit setzen',
              body: field('Kommentar (optional)', 'c', { textarea: true, placeholder: to === 'fixed' ? 'z. B. Ersatz beschafft' : 'z. B. Teil bestellt' }),
              ok: 'Speichern',
            });
            if (!r) return;
            note = r.c.trim();
          }
          busy(true);
          try {
            await api.setDefectState(b.dataset.def, to, S.name || 'Admin', note);
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
          route();
        };
      });
    },
  };
}

// ======================================================================
// Ansicht: Checklisten eines Fahrzeugs (nur Admin)
// ======================================================================
async function viewLists(vid) {
  if (S.role !== 'admin') return viewVehicle(vid);
  const [v, lists, areas] = await Promise.all([api.getVehicle(vid), api.listChecklists(vid), api.listAreas(vid)]);
  const items = await api.listItemsForAreas(areas.map((a) => a.id));
  const cnt = (id) => items.filter((i) => i.checklist_id === id).length;
  const free = items.filter((i) => !i.checklist_id).length;
  const rows = lists
    .map(
      (cl) => `<div class="card pad"><div class="ctop"><strong>${esc(cl.name)}</strong><span class="badge">${cl.interval_days ? 'alle ' + cl.interval_days + ' Tage' : 'ohne Frist'}</span></div>
        <div class="muted">${cnt(cl.id)} eigene Gegenstände, dazu ${free} ohne Zuordnung</div>
        <div class="stack"><button class="btn small" data-cl-edit="${cl.id}">Ändern</button><button class="btn small danger" data-cl-del="${cl.id}">Löschen</button></div></div>`
    )
    .join('');
  const form = (cl) =>
    modal({
      title: cl ? 'Checkliste ändern' : 'Neue Checkliste',
      body:
        field('Name', 'name', { value: cl ? cl.name : '', required: true, placeholder: 'z. B. Wöchentlicher Check' }) +
        field('Intervall in Tagen (leer = ohne Frist)', 'interval_days', { type: 'number', value: cl && cl.interval_days ? cl.interval_days : '', nomic: true, attrs: 'min="1" max="730" inputmode="numeric"', placeholder: '7 = wöchentlich, 30 = monatlich, 365 = jährlich' }),
    });
  const clean = (r) => ({ name: r.name.trim(), interval_days: Math.min(730, Math.max(1, parseInt(r.interval_days, 10) || 0)) || null });
  return {
    active: 'home',
    html: `<a class="back" href="#/v/${vid}">‹ ${esc(v.name)}</a>
      <h2>Checklisten</h2>
      <p class="muted">Eine Checkliste ist ein Check mit eigener Frist, zum Beispiel wöchentlich oder jährlich. Ordne Gegenstände beim Bearbeiten einer Checkliste zu. Gegenstände ohne Zuordnung gehören zu jedem Check. Ein voller Check mit allen Gegenständen zählt für alle Checklisten.</p>
      ${rows || '<p class="muted">Noch keine Checkliste. Ohne Checkliste gibt es einen einzigen Check mit allen Gegenständen.</p>'}
      <div class="stack wrap"><button class="btn primary" id="cl-add">+ Neue Checkliste</button></div>
      <div class="stack wrap"><button class="btn small" data-preset="Wöchentlich:7">+ Wöchentlich</button><button class="btn small" data-preset="Monatlich:30">+ Monatlich</button><button class="btn small" data-preset="Jährlich:365">+ Jährlich</button></div>`,
    bind() {
      const add = async (row) => {
        busy(true);
        try {
          await api.saveChecklist({ vehicle_id: vid, sort: lists.length, ...row });
        } catch (e) {
          fail(e);
        } finally {
          busy(false);
        }
        route();
      };
      document.getElementById('cl-add').onclick = async () => {
        const r = await form(null);
        if (r) add(clean(r));
      };
      document.querySelectorAll('[data-preset]').forEach((b) => {
        b.onclick = () => {
          const [name, days] = b.dataset.preset.split(':');
          add({ name, interval_days: Number(days) });
        };
      });
      document.querySelectorAll('[data-cl-edit]').forEach((b) => {
        b.onclick = async () => {
          const cl = lists.find((x) => x.id === b.dataset.clEdit);
          const r = await form(cl);
          if (!r) return;
          busy(true);
          try {
            await api.saveChecklist({ id: cl.id, ...clean(r) });
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
          route();
        };
      });
      document.querySelectorAll('[data-cl-del]').forEach((b) => {
        b.onclick = async () => {
          const cl = lists.find((x) => x.id === b.dataset.clDel);
          if (!confirm(`Checkliste "${cl.name}" löschen? Die Gegenstände bleiben erhalten und gehören dann zu jedem Check.`)) return;
          busy(true);
          try {
            await api.deleteChecklist(cl.id);
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
          route();
        };
      });
    },
  };
}

// ======================================================================
// QR Codes, Fahrzeugblatt, Excel
// ======================================================================
async function vehicleQr(v, areas) {
  const r = await modal({
    title: 'QR Codes drucken',
    body: '<p class="muted">Der Code öffnet die Seite direkt. Wer nicht angemeldet ist, meldet sich erst an und landet dann am Ziel. Im Druckdialog "Als PDF speichern" oder direkt drucken.</p>',
    ok: '',
    actions: [
      { key: 'v', label: 'Nur das Fahrzeug' },
      { key: 'all', label: `Fahrzeug und alle ${areas.length} Fächer` },
    ],
  });
  if (!r) return;
  const base = baseUrl();
  const labels = [{ title: v.name, sub: 'Fahrzeug', url: `${base}#/v/${v.id}` }];
  if (r.__action === 'all') for (const a of areas) labels.push({ title: a.name, sub: `${v.name}, Fach`, url: `${base}#/v/${v.id}/a/${a.id}` });
  busy(true);
  try {
    const svgs = await Promise.all(labels.map((l) => qrSvg(l.url)));
    await printArea(
      `<h1>QR Codes ${esc(v.name)}</h1><div class="qrgrid">${labels
        .map((l, i) => `<div class="qrlabel"><div class="qrsvg">${svgs[i]}</div><strong>${esc(l.title)}</strong><div>${esc(l.sub)}</div></div>`)
        .join('')}</div>`
    );
  } catch (e) {
    fail(e);
  } finally {
    busy(false);
  }
}

async function vehicleSheet(v, areas, items, lists, vchecks) {
  busy(true);
  try {
    const [defects, checks, url, qr] = await Promise.all([api.openDefects(), api.listChecks(50), api.photoUrl(v.photo_path), qrSvg(`${baseUrl()}#/v/${v.id}`)]);
    const mine = defects.filter((d) => d.check.vehicle_id === v.id);
    const lastChecks = checks.filter((c) => c.vehicle_id === v.id).slice(0, 8);
    const probs = await api.problemResults(lastChecks.map((c) => c.id));
    const pc = {};
    for (const p of probs) pc[p.check_id] = (pc[p.check_id] || 0) + 1;
    const lname = Object.fromEntries(lists.map((l) => [l.id, l.name]));
    const rowsItems = areas
      .flatMap((a) => items.filter((i) => i.area_id === a.id).map((i) => `<tr><td>${esc(a.name)}</td><td>${esc(i.name)}</td><td>${i.qty}</td><td>${esc(i.checklist_id ? lname[i.checklist_id] || '' : 'jeder Check')}</td><td>${esc(i.note || '')}</td></tr>`))
      .join('');
    const d = daysUntil(v.next_inspection);
    await printArea(`<h1>Fahrzeugblatt ${esc(v.name)}</h1>
      <div class="sheethead"><div>
        <p>${esc(S.org || '')}<br>Stand: ${fmtDateTime(new Date().toISOString())}</p>
        <p>${esc([v.type, v.location].filter(Boolean).join(', '))}</p>
        ${v.next_inspection ? `<p>Nächste Prüfung (HU, UVV): ${fmtDate(v.next_inspection)}${v.inspection_months ? `, alle ${v.inspection_months} Monate` : ''}${d !== null && d < 0 ? ' (überfällig)' : ''}</p>` : ''}
        ${v.notes ? `<p>${esc(v.notes)}</p>` : ''}</div>
        <div class="qrsvg small">${qr}</div></div>
      ${url ? `<img class="sheetphoto" src="${esc(url)}" alt="">` : ''}
      ${lists.length ? `<h2>Checklisten</h2><table><thead><tr><th>Name</th><th>Frist</th><th>Zuletzt</th><th>Status</th></tr></thead><tbody>${lists
        .map((cl) => {
          const st = clStatus(cl, vchecks);
          return `<tr><td>${esc(cl.name)}</td><td>${cl.interval_days ? 'alle ' + cl.interval_days + ' Tage' : 'ohne Frist'}</td><td>${st.last ? fmtDate(st.last) : ''}</td><td>${esc(clText(st))}</td></tr>`;
        })
        .join('')}</tbody></table>` : ''}
      <h2>Beladung (${items.length} Gegenstände in ${areas.length} Fächern)</h2>
      <table><thead><tr><th>Fach</th><th>Gegenstand</th><th>Soll</th><th>Check</th><th>Hinweis</th></tr></thead><tbody>${rowsItems}</tbody></table>
      <h2>Offene Mängel (${mine.length})</h2>
      ${mine.length ? `<table><thead><tr><th>Gegenstand</th><th>Fach</th><th>Status</th><th>Stand</th><th>Gefunden</th></tr></thead><tbody>${mine
        .map((m) => `<tr class="${m.status}"><td>${esc(m.item_name)}</td><td>${esc(m.area_name || '')}</td><td>${STATUS[m.status].long}</td><td>${m.resolved_status === 'progress' ? 'In Arbeit' : 'Offen'}</td><td>${fmtDateTime(m.check.created_at)}, ${esc(m.check.member_name)}</td></tr>`)
        .join('')}</tbody></table>` : '<p>Keine offenen Mängel.</p>'}
      <h2>Letzte Checks</h2>
      <table><thead><tr><th>Datum</th><th>Prüfer</th><th>Check</th><th>Mängel</th></tr></thead><tbody>${lastChecks
        .map((c) => `<tr><td>${fmtDateTime(c.created_at)}</td><td>${esc(c.member_name)}</td><td>${esc(c.checklist_name || 'voll')}</td><td>${pc[c.id] || 0}</td></tr>`)
        .join('')}</tbody></table>`);
  } catch (e) {
    fail(e);
  } finally {
    busy(false);
  }
}

const STATUS_DE = { ok: 'Vorhanden', missing: 'Fehlt', defect: 'Defekt' };
const STAND_DE = { open: 'Offen', progress: 'In Arbeit', fixed: 'Behoben' };
async function excelExport(vid) {
  busy(true);
  try {
    const [d, X] = await Promise.all([api.exportAll(), import('./xlsx.js')]);
    const vehicles = d.vehicles.filter((v) => !vid || v.id === vid);
    const vname = Object.fromEntries(d.vehicles.map((v) => [v.id, v.name]));
    const vids = new Set(vehicles.map((v) => v.id));
    const lname = Object.fromEntries(d.checklists.map((l) => [l.id, l.name]));
    const areas = d.areas.filter((a) => vids.has(a.vehicle_id));
    const aById = Object.fromEntries(areas.map((a) => [a.id, a]));
    const items = d.items.filter((i) => aById[i.area_id]);
    const checks = d.checks.filter((c) => vids.has(c.vehicle_id)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const cById = Object.fromEntries(checks.map((c) => [c.id, c]));
    const results = d.check_results.filter((r) => cById[r.check_id]).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const bad = {};
    const tot = {};
    for (const r of results) {
      tot[r.check_id] = (tot[r.check_id] || 0) + 1;
      if (r.status !== 'ok') bad[r.check_id] = (bad[r.check_id] || 0) + 1;
    }
    const cn = (c) => c.checklist_name || (c.checklist_id && lname[c.checklist_id]) || 'voller Check';
    const resRow = (r) => {
      const c = cById[r.check_id];
      return [fmtDateTime(c.created_at), vname[c.vehicle_id] || '', cn(c), c.member_name, r.area_name || '', r.item_name, STATUS_DE[r.status], r.note || '', r.status === 'ok' ? '' : STAND_DE[r.resolved_status] || '', r.resolved_at ? fmtDateTime(r.resolved_at) : '', r.resolved_by || '', r.resolve_note || ''];
    };
    const head = ['Datum', 'Fahrzeug', 'Check', 'Prüfer', 'Fach', 'Gegenstand', 'Status', 'Notiz', 'Mängelstand', 'Erledigt am', 'Erledigt von', 'Kommentar'];
    const bytes = X.buildXlsx([
      { name: 'Fahrzeuge', widths: [24, 24, 20, 16, 14, 40], rows: [['Name', 'Typ', 'Standort', 'Nächste Prüfung', 'Intervall Monate', 'Hinweise'], ...vehicles.map((v) => [v.name, v.type || '', v.location || '', v.next_inspection ? fmtDate(v.next_inspection) : '', v.inspection_months || '', v.notes || ''])] },
      { name: 'Checklisten', widths: [24, 28, 16], rows: [['Fahrzeug', 'Name', 'Intervall Tage'], ...d.checklists.filter((l) => vids.has(l.vehicle_id)).map((l) => [vname[l.vehicle_id] || '', l.name, l.interval_days || ''])] },
      { name: 'Gegenstände', widths: [24, 26, 34, 8, 24, 36], rows: [['Fahrzeug', 'Fach', 'Gegenstand', 'Soll', 'Check', 'Hinweis'], ...items.map((i) => [vname[aById[i.area_id].vehicle_id] || '', aById[i.area_id].name, i.name, i.qty, i.checklist_id ? lname[i.checklist_id] || '' : 'jeder Check', i.note || ''])] },
      { name: 'Checks', widths: [16, 24, 24, 20, 34, 12, 10], rows: [['Datum', 'Fahrzeug', 'Check', 'Prüfer', 'Bemerkung', 'Positionen', 'Mängel'], ...checks.map((c) => [fmtDateTime(c.created_at), vname[c.vehicle_id] || '', cn(c), c.member_name, c.note || '', tot[c.id] || 0, bad[c.id] || 0])] },
      { name: 'Mängel', widths: [16, 24, 24, 20, 26, 34, 12, 30, 14, 16, 16, 30], rows: [head, ...results.filter((r) => r.status !== 'ok').map(resRow)] },
      { name: 'Alle Ergebnisse', widths: [16, 24, 24, 20, 26, 34, 12, 30, 14, 16, 16, 30], rows: [head, ...results.map(resRow)] },
    ]);
    const nm = vid ? (vname[vid] || 'fahrzeug').replace(/[^\w\-äöüÄÖÜß]+/g, '_') : 'alle';
    X.downloadBytes(bytes, `fahrzeug-check-${nm}-${new Date().toISOString().slice(0, 10)}.xlsx`, X.XLSX_MIME);
    toast('Excel Datei wurde erstellt');
  } catch (e) {
    fail(e);
  } finally {
    busy(false);
  }
}

// ======================================================================
// Ansicht: Statistik (nur Admin)
// ======================================================================
async function viewStats() {
  if (S.role !== 'admin') return viewHome();
  const days = S.statDays || 90;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [vs, { checks, results }, lists, allChecks, defects] = await Promise.all([api.listVehicles(), api.statsData(since), api.allChecklists(), api.lastChecks(), api.openDefects()]);
  S.openCount = defects.length;
  const vname = Object.fromEntries(vs.map((v) => [v.id, v.name]));
  const badIds = new Set(results.filter((r) => r.status !== 'ok').map((r) => r.check_id));
  const nBad = checks.filter((c) => badIds.has(c.id)).length;
  const pct = checks.length ? Math.round(((checks.length - nBad) / checks.length) * 100) : null;

  // Checks pro Monat
  const nMonths = Math.min(12, Math.max(3, Math.ceil(days / 30)));
  const months = [];
  const now = new Date();
  for (let i = nMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('de-DE', { month: 'short' }), n: 0 });
  }
  for (const c of checks) {
    const m = months.find((x) => x.key === localDate(new Date(c.created_at)).slice(0, 7));
    if (m) m.n++;
  }
  const maxM = Math.max(1, ...months.map((m) => m.n));

  // Pro Fahrzeug
  const perV = vs.map((v) => {
    const cs = checks.filter((c) => c.vehicle_id === v.id);
    const b = cs.filter((c) => badIds.has(c.id)).length;
    const last = allChecks.find((c) => c.vehicle_id === v.id);
    return { v, n: cs.length, b, last: last ? last.created_at : null };
  });

  // Häufigste Mängel
  const freq = {};
  for (const r of results) {
    if (r.status === 'ok') continue;
    const k = `${r.item_name}||${r.area_name || ''}`;
    (freq[k] ||= { name: r.item_name, area: r.area_name || '', n: 0, vehicle: '' }).n++;
  }
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 8);
  const maxT = Math.max(1, ...top.map((t) => t.n));

  // Prüfer
  const who = {};
  for (const c of checks) who[c.member_name] = (who[c.member_name] || 0) + 1;
  const whoList = Object.entries(who).sort((a, b) => b[1] - a[1]);
  const maxW = Math.max(1, ...whoList.map((w) => w[1]));

  // Fälligkeiten
  const due = [];
  for (const v of vs) {
    const vch = checksOfVehicle(v.id, allChecks);
    for (const cl of lists.filter((l) => l.vehicle_id === v.id)) {
      const st = clStatus(cl, vch);
      const lv = clLevel(st, cl);
      if (lv !== 'green') due.push({ lv, text: `${v.name}: ${cl.name} ${clText(st)}`, order: st.never ? -999 : st.days });
    }
    const hu = daysUntil(v.next_inspection);
    if (hu !== null && hu <= 30) due.push({ lv: hu < 0 ? 'red' : 'yellow', text: `${v.name}: Prüfung ${fmtDate(v.next_inspection)} (${hu < 0 ? 'überfällig seit ' + -hu + ' Tagen' : 'in ' + hu + ' Tagen'})`, order: hu });
  }
  due.sort((a, b) => a.order - b.order);
  const bar = (n, max) => `<span class="bar"><span style="width:${Math.round((n / max) * 100)}%"></span></span>`;

  return {
    active: 'stats',
    html: `<h2>Statistik</h2>
      <div class="stack wrap">${[30, 90, 365].map((d) => `<button class="btn small ${d === days ? 'primary' : ''}" data-days="${d}">${d === 365 ? '1 Jahr' : d + ' Tage'}</button>`).join('')}</div>
      <div class="tiles">
        <div class="tile green"><b>${checks.length}</b><span>Checks</span></div>
        <div class="tile ${nBad ? 'yellow' : 'green'}"><b>${nBad}</b><span>mit Mängeln</span></div>
        <div class="tile ${defects.length ? 'red' : 'green'}"><b>${defects.length}</b><span>offen jetzt</span></div>
      </div>
      ${pct !== null ? `<p class="muted">${pct} Prozent der Checks ohne Mangel im gewählten Zeitraum.</p>` : '<p class="muted">Im gewählten Zeitraum gibt es keine Checks.</p>'}
      <div class="card pad"><h3>Checks pro Monat</h3><div class="mchart">${months.map((m) => `<div class="mcol"><span class="mval">${m.n}</span><span class="mbar" style="height:${Math.round((m.n / maxM) * 100)}px"></span><span class="mlab">${esc(m.label)}</span></div>`).join('')}</div></div>
      ${due.length ? `<div class="card pad"><h3>Fristen</h3>${due.map((d) => `<div class="clrow"><span class="lamp ${d.lv}"></span><span class="grow">${esc(d.text)}</span></div>`).join('')}</div>` : ''}
      <div class="card pad"><h3>Je Fahrzeug</h3><table class="tbl"><thead><tr><th>Fahrzeug</th><th>Checks</th><th>Mängel</th><th>Zuletzt</th></tr></thead><tbody>${perV.map((p) => `<tr><td>${esc(p.v.name)}</td><td>${p.n}</td><td>${p.b}</td><td>${p.last ? fmtDate(p.last) : 'nie'}</td></tr>`).join('')}</tbody></table></div>
      <div class="card pad"><h3>Häufigste Mängel</h3>${top.length ? top.map((t) => `<div class="hrow"><span class="grow">${esc(t.name)}<div class="muted">${esc(t.area)}</div></span>${bar(t.n, maxT)}<b>${t.n}</b></div>`).join('') : '<p class="muted">Keine Mängel im Zeitraum.</p>'}</div>
      <div class="card pad"><h3>Wer prüft</h3>${whoList.length ? whoList.map(([n, c]) => `<div class="hrow"><span class="grow">${esc(n)}</span>${bar(c, maxW)}<b>${c}</b></div>`).join('') : '<p class="muted">Noch niemand.</p>'}</div>
      <button class="btn block" id="stats-xlsx">Alles als Excel herunterladen</button>`,
    bind() {
      document.querySelectorAll('[data-days]').forEach((b) => {
        b.onclick = () => {
          S.statDays = Number(b.dataset.days);
          route();
        };
      });
      document.getElementById('stats-xlsx').onclick = () => excelExport(null);
    },
  };
}

// ======================================================================
// Ansicht: Verlauf
// ======================================================================
async function viewHistory() {
  let checks = [], probs = [], noNet = false;
  try {
    checks = await api.listChecks(50);
    probs = await api.problemResults(checks.map((c) => c.id));
  } catch (e) {
    if (!isNetErr(e)) throw e;
    noNet = true;
  }
  const count = {};
  for (const p of probs) count[p.check_id] = (count[p.check_id] || 0) + 1;
  const admin = S.role === 'admin';
  const pcards = pendingList()
    .map(
      (p) => `<div class="card pad check pendcard"><div class="ctop"><strong>${esc(p.vehicle_name || '')}</strong><span class="badge part">Wartet</span></div>
        <div class="muted">${fmtDateTime(p.created_at)}, ${esc(p.member_name)}${p.checklist_name ? ' · ' + esc(p.checklist_name) : ''}</div>
        <div class="muted">${p.results.length} Positionen${p.error ? ', Fehler: ' + esc(p.error) : ', noch nicht gesendet'}</div>
        <div class="stack"><button class="btn small danger" data-pdel="${p.id}">Verwerfen</button></div></div>`
    )
    .join('');

  const cards = checks
    .map((c) => {
      const n = count[c.id] || 0;
      return `<div class="card pad check" data-id="${c.id}">
        <div class="ctop"><strong>${esc(c.vehicles ? c.vehicles.name : '')}</strong>
          <span class="badge ${n ? 'bad' : 'ok'}">${n ? n + ' Mängel' : 'alles ok'}</span></div>
        <div class="muted">${fmtDateTime(c.created_at)}, ${esc(c.member_name)}${c.checklist_name ? ' · ' + esc(c.checklist_name) : ''}</div>
        ${c.note ? `<div>${esc(c.note)}</div>` : ''}
        <div class="stack"><button class="btn small" data-details="${c.id}">Details</button><button class="btn small" data-print="${c.id}">Als PDF</button>${admin ? `<button class="btn small danger" data-del="${c.id}">Löschen</button>` : ''}</div>
        <div class="details" id="d-${c.id}"></div>
      </div>`;
    })
    .join('');

  return {
    active: 'history',
    html: `<h2>Verlauf</h2>${noNet ? '<p class="muted">Kein Netz. Der bisherige Verlauf wird geladen, sobald wieder Netz da ist.</p>' : ''}${pcards}${cards || (pcards || noNet ? '' : '<p class="muted">Noch keine Checks.</p>')}
      ${admin && checks.length ? '<button class="btn block" id="hist-xlsx">Alles als Excel herunterladen</button>' : ''}`,
    bind() {
      const hx = document.getElementById('hist-xlsx');
      if (hx) hx.onclick = () => excelExport(null);
      document.querySelectorAll('[data-pdel]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('Diesen wartenden Check verwerfen? Er wurde noch nicht gesendet und geht verloren.')) return;
          await pendingRemove(b.dataset.pdel);
          route();
        };
      });
      document.querySelectorAll('[data-details]').forEach((b) => {
        b.onclick = async () => {
          const id = b.dataset.details;
          const box = document.getElementById('d-' + id);
          if (box.dataset.open) {
            box.innerHTML = '';
            delete box.dataset.open;
            return;
          }
          busy(true);
          try {
            const rs = await api.resultsForCheck(id);
            const thumbs = await Promise.all(rs.map((r) => api.photoUrl(r.photo_path)));
            const order = { missing: 0, defect: 1, ok: 2 };
            const idx = rs.map((_, i) => i).sort((a, b2) => order[rs[a].status] - order[rs[b2].status]);
            box.innerHTML =
              '<ul class="rlist">' +
              idx
                .map((i) => {
                  const r = rs[i];
                  return `<li><span class="badge ${r.status === 'ok' ? 'ok' : 'bad'}">${STATUS[r.status].long}</span>
                    <strong>${esc(r.item_name)}</strong> <span class="muted">${esc(r.area_name || '')}</span>
                    ${r.note ? `<div>${esc(r.note)}</div>` : ''}
                    ${thumbs[i] ? `<a href="${esc(thumbs[i])}" target="_blank" rel="noopener"><img class="rthumb" src="${esc(thumbs[i])}" alt="Foto"></a>` : ''}</li>`;
                })
                .join('') +
              '</ul>';
            box.dataset.open = '1';
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
        };
      });
      document.querySelectorAll('[data-print]').forEach((b) => {
        b.onclick = async () => {
          const c = checks.find((x) => x.id === b.dataset.print);
          busy(true);
          try {
            const rs = await api.resultsForCheck(c.id);
            const urls = await Promise.all(rs.map((r) => api.photoUrl(r.photo_path)));
            const order = { missing: 0, defect: 1, ok: 2 };
            const idx = rs.map((_, i) => i).sort((a, b2) => order[rs[a].status] - order[rs[b2].status]);
            let pa = document.getElementById('printarea');
            if (!pa) {
              pa = document.createElement('div');
              pa.id = 'printarea';
              document.body.appendChild(pa);
            }
            const bad = rs.filter((r) => r.status !== 'ok').length;
            pa.innerHTML = `<h1>Fahrzeugcheck ${esc(c.vehicles ? c.vehicles.name : '')}</h1>
              <p>${esc(S.org || '')}<br>Datum: ${fmtDateTime(c.created_at)}<br>Geprüft von: ${esc(c.member_name)}<br>Ergebnis: ${bad ? bad + ' Mängel' : 'alles in Ordnung'} bei ${rs.length} Positionen</p>
              ${c.note ? `<p>Bemerkung: ${esc(c.note)}</p>` : ''}
              <table><thead><tr><th>Gegenstand</th><th>Fach</th><th>Status</th><th>Notiz</th></tr></thead><tbody>
              ${idx.map((i) => `<tr class="${rs[i].status}"><td>${esc(rs[i].item_name)}</td><td>${esc(rs[i].area_name || '')}</td><td>${STATUS[rs[i].status].long}</td><td>${esc(rs[i].note || '')}${urls[i] ? `<br><img src="${esc(urls[i])}" alt="">` : ''}</td></tr>`).join('')}
              </tbody></table>`;
            await Promise.all([...pa.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
            document.body.classList.add('printing');
            const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
            window.addEventListener('afterprint', done);
            window.print();
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
        };
      });
      document.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('Diesen Check löschen?')) return;
          busy(true);
          try {
            await api.deleteCheck(b.dataset.del);
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
          route();
        };
      });
    },
  };
}

// ======================================================================
// Ansicht: Einstellungen und Konto
// ======================================================================
async function viewSettings() {
  const admin = S.role === 'admin';
  let st = null;
  let members = [];
  if (admin) [st, members] = await Promise.all([api.getSettings(), api.listMembers()]);
  const link = location.origin + location.pathname;

  return {
    active: 'settings',
    html: `<h2>${admin ? 'Einstellungen' : 'Konto'}</h2>
      <div class="card pad">
        <div>Angemeldet als <strong>${admin ? 'Admin' : esc(S.name || '')}</strong></div>
        <button class="btn block" id="logout">Abmelden</button>
      </div>
      ${
        admin
          ? `<form id="f-set" class="card pad">
          <h3>Einheit</h3>
          ${field('Name der Einheit', 'org', { value: st.org_name, attrs: 'readonly data-lpignore="true" data-1p-ignore onfocus="this.removeAttribute(\'readonly\')"' })}
          ${field('Teamcode für Teammitglieder (mind. 6 Zeichen)', 'code', { value: st.team_code, required: true, nomic: true, attrs: 'readonly data-lpignore="true" data-1p-ignore onfocus="this.removeAttribute(\'readonly\')"' })}
          <button class="btn primary block" type="submit">Speichern</button>
        </form>
        <div class="card pad">
          <h3>Link für Prüfer</h3>
          <div class="muted">Diesen Link und den Code an die Prüfer geben. Auf dem iPhone in Safari öffnen, dann Teilen und "Zum Home-Bildschirm".</div>
          <input readonly value="${esc(link)}" onclick="this.select()">
        </div>
        <div class="card pad">
          <h3>Datensicherung</h3>
          <div class="muted">Lädt alle Fahrzeuge, Fächer, Gegenstände und Checks als Datei herunter. Fotos sind nicht enthalten.</div>
          <button class="btn block" id="export-xlsx">Alles als Excel herunterladen</button>
          <button class="btn block" id="export">Daten herunterladen (JSON)</button>
        </div>
        <div class="card pad">
          <h3>Prüfer (${members.length})</h3>
          ${members.map((m) => `<div class="row"><span class="grow">${esc(m.name)}<div class="muted">seit ${fmtDate(m.created_at)}</div></span><button class="btn small danger" data-rm="${m.user_id}">Entfernen</button></div>`).join('') || '<div class="muted">Noch niemand angemeldet.</div>'}
        </div>`
          : ''
      }`,
    bind() {
      document.getElementById('logout').onclick = async () => {
        await api.logout();
        S.role = S.name = S.uid = null;
        S.edit = false;
        location.hash = '#/';
        route();
      };
      const xx = document.getElementById('export-xlsx');
      if (xx) xx.onclick = () => excelExport(null);
      const ex = document.getElementById('export');
      if (ex)
        ex.onclick = async () => {
          busy(true);
          try {
            const data = await api.exportAll();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'fahrzeug-check-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            toast('Datei wurde erstellt');
          } catch (e) {
            fail(e);
          } finally {
            busy(false);
          }
        };
      const f = document.getElementById('f-set');
      if (f)
        f.onsubmit = async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(f));
          busy(true);
          try {
            await api.updateSettings(d.org, d.code);
            S.org = d.org.trim() || S.org;
            toast('Gespeichert');
          } catch (err) {
            fail(err);
          } finally {
            busy(false);
          }
          route();
        };
      document.querySelectorAll('[data-rm]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('Diesen Prüfer entfernen? Er muss sich dann neu mit dem Code anmelden.')) return;
          busy(true);
          try {
            await api.removeMember(b.dataset.rm);
          } catch (err) {
            fail(err);
          } finally {
            busy(false);
          }
          route();
        };
      });
    },
  };
}

// ======================================================================
// Router
// ======================================================================
let routing = 0;
export async function route() {
  const my = ++routing;
  if (!configured) {
    const v = viewSetupMissing();
    app.innerHTML = v.html;
    return;
  }
  let view;
  try {
    if (!S.role) {
      view = viewLogin();
      app.innerHTML = view.html;
      view.bind();
      return;
    }
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    busy(true);
    if (parts[0] === 'v' && parts[1] && parts[2] === 'a' && parts[3]) view = await viewArea(parts[1], parts[3]);
    else if (parts[0] === 'v' && parts[1] && parts[2] === 'lists') view = await viewLists(parts[1]);
    else if (parts[0] === 'v' && parts[1]) view = await viewVehicle(parts[1]);
    else if (parts[0] === 'defects') view = await viewDefects();
    else if (parts[0] === 'stats') view = await viewStats();
    else if (parts[0] === 'history') view = await viewHistory();
    else if (parts[0] === 'settings') view = await viewSettings();
    else view = await viewHome();
    if (my !== routing) return;
    app.innerHTML = shell(view.html, view.active);
    bindMics(app);
    view.bind();
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    if (my !== routing) return;
    const msg = e && e.message ? e.message : 'Unbekannter Fehler';
    app.innerHTML = shell(`<div class="card pad"><h3>Das hat nicht geklappt</h3><p>${esc(msg)}</p><button class="btn primary" onclick="location.reload()">Neu laden</button></div>`, '');
  } finally {
    if (S.role) busy(false);
  }
}

async function init() {
  if (configured) {
    try {
      const { data } = await api.sb.auth.getSession();
      if (data.session) {
        const w = await api.whoami();
        S.role = w.role;
        S.name = w.name || null;
        S.org = w.org || '';
        S.uid = data.session.user.id;
      }
    } catch (e) {
      console.error(e);
    }
  }
  window.addEventListener('hashchange', route);
  route();
  trySync(true);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
