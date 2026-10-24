/* storage.js — localStorage helpers, date utilities and small shared UI helpers.
   Loaded FIRST on every page. */
const KEYS = { company: 'hcm_company', users: 'hcm_users', attendance: 'hcm_attendance',
  leaves: 'hcm_leaves', session: 'hcm_session', announcements: 'hcm_announcements' };
const $ = id => document.getElementById(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ok = extra => Object.assign({ ok: true }, extra || {});
const fail = (error, errors) => ({ ok: false, error: error || '', errors: errors || {} });

/* ---- generic read/write (safe against missing or malformed JSON) ---- */
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    const value = JSON.parse(raw);
    return value === null ? fallback : value;
  } catch (e) { return fallback; }
}
function writeStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getList(key) { const v = readStore(key, []); return Array.isArray(v) ? v : []; }

const getUsers = () => getList(KEYS.users).filter(u => u && u.id);
const saveUsers = list => writeStore(KEYS.users, list);
const getAttendance = () => getList(KEYS.attendance);
const saveAttendance = list => writeStore(KEYS.attendance, list);
const getLeaves = () => getList(KEYS.leaves);
const saveLeaves = list => writeStore(KEYS.leaves, list);
const getAnnouncements = () => getList(KEYS.announcements);
const saveAnnouncements = list => writeStore(KEYS.announcements, list);

/* Company settings: returns null until first-run setup is done. Missing fields get defaults. */
function getCompany() {
  const c = readStore(KEYS.company, null);
  if (!c || typeof c !== 'object' || !c.name) return null;
  const merged = Object.assign({ officeStart: '09:00', graceMinutes: 15, leaveQuota: 20, workingDays: [1, 2, 3, 4, 5] }, c);
  if (!Array.isArray(merged.workingDays)) merged.workingDays = [1, 2, 3, 4, 5];
  return merged;
}
const saveCompany = c => writeStore(KEYS.company, c);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---- date utilities (all dates are local 'YYYY-MM-DD' strings) ---- */
const pad = n => String(n).padStart(2, '0');
const toDateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const todayStr = () => toDateStr(new Date());
function addDays(dateStr, n) { const d = parseDate(dateStr); d.setDate(d.getDate() + n); return toDateStr(d); }
const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
function timeToMinutes(t) { const [h, m, s] = t.split(':').map(Number); return h * 60 + m + (s || 0) / 60; }
const minutesToHHMM = m => pad(Math.floor(m / 60)) + ':' + pad(Math.round(m % 60));
function formatDuration(min) { if (min === null || min === undefined) return '—'; const t = Math.round(min); return Math.floor(t / 60) + 'h ' + pad(t % 60) + 'm'; }
const isWorkingDay = (dateStr, c) => c.workingDays.includes(parseDate(dateStr).getDay());
function eachDate(from, to, fn) { for (let d = parseDate(from); d <= parseDate(to); d.setDate(d.getDate() + 1)) fn(toDateStr(d)); }
function countWorkingDays(from, to, c) { let n = 0; if (from > to) return 0; eachDate(from, to, ds => { if (isWorkingDay(ds, c)) n++; }); return n; }
const money = n => (Number(n) || 0).toFixed(2);

/* ---- shared UI helpers ---- */
function escapeHtml(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function showMessage(text, type, id) {
  const box = $(id || 'pageMsg'); if (!box) return;
  box.innerHTML = '<div class="alert ' + (type || 'success') + '" role="status">' + escapeHtml(text) + '</div>';
}
function clearFieldErrors() { document.querySelectorAll('.err').forEach(e => { e.textContent = ''; }); }
function showFieldErrors(errors) { clearFieldErrors(); Object.keys(errors || {}).forEach(k => { const e = $('err-' + k); if (e) e.textContent = errors[k]; }); }
const emptyState = (title, hint) => '<div class="empty"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(hint || '') + '</span></div>';
