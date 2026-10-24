/* auth.js — setup, login, session, role checks, shared page shell (sidebar). */
function getSession() { return readStore(KEYS.session, null); }

/* Returns the logged-in user from the stored users list, or null if the session is invalid. */
function currentUser() {
  const s = getSession();
  if (!s || !s.userId) return null;
  return getUsers().find(u => u.id === s.userId && u.role === s.role) || null;
}
/* Page guard: call first on every protected page. role = 'admin' | 'employee' | 'any' */
function requireRole(role) {
  const u = currentUser();
  if (!u || !getCompany()) { localStorage.removeItem(KEYS.session); location.replace('index.html'); return null; }
  if (role !== 'any' && u.role !== role) { location.replace(u.role === 'admin' ? 'admin.html' : 'employee.html'); return null; }
  return u;
}
/* Action guard: re-checks the role inside every handler that changes data. */
function hasRole(role) { const u = currentUser(); return !!u && u.role === role; }

function startSession(user) { writeStore(KEYS.session, { userId: user.id, role: user.role, loginAt: new Date().toISOString() }); }
const homeFor = u => (u.role === 'admin' ? 'admin.html' : 'employee.html');

function setupCompany(d) {
  if (getCompany()) return fail('Setup is already complete. Please log in.');
  const errors = {};
  if (!d.companyName.trim()) errors.companyName = 'Company name is required.';
  if (!d.adminName.trim()) errors.adminName = 'Admin name is required.';
  if (!d.email.trim()) errors.email = 'Email is required.'; else if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Enter a valid email address.';
  if (!d.password) errors.password = 'Password is required.'; else if (d.password.length < 6) errors.password = 'Use at least 6 characters.';
  if (Object.keys(errors).length) return fail('Please fix the highlighted fields.', errors);
  const admin = { id: newId(), name: d.adminName.trim(), email: d.email.trim().toLowerCase(), password: d.password,
    role: 'admin', department: '', salary: null, createdAt: todayStr() };
  saveCompany({ name: d.companyName.trim(), officeStart: '09:00', graceMinutes: 15, leaveQuota: 20, workingDays: [1, 2, 3, 4, 5] });
  saveUsers([admin]);
  startSession(admin);
  return ok({ user: admin });
}
function login(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required.';
  if (!password) errors.password = 'Password is required.';
  if (Object.keys(errors).length) return fail('Enter your email and password.', errors);
  const user = getUsers().find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return fail('No account found with that email.', { email: 'No account found with that email.' });
  if (user.password !== password) return fail('Incorrect password.', { password: 'Incorrect password.' });
  startSession(user);
  return ok({ user });
}
function logout() { localStorage.removeItem(KEYS.session); location.replace('index.html'); }

function changePassword(current, next, confirm) {
  const user = currentUser(); if (!user) return fail('Please log in again.');
  const errors = {};
  if (current !== user.password) errors.current = 'Current password is incorrect.';
  if (!next || next.length < 6) errors.next = 'New password must be at least 6 characters.';
  else if (next === current) errors.next = 'New password must be different.';
  if (next !== confirm) errors.confirm = 'Passwords do not match.';
  if (Object.keys(errors).length) return fail('Password not changed.', errors);
  const users = getUsers(); users.find(u => u.id === user.id).password = next; saveUsers(users);
  return ok();
}

/* ---- index.html logic ---- */
function initIndexPage() {
  if (getSession() && !currentUser()) localStorage.removeItem(KEYS.session);
  const u = currentUser();
  if (u && getCompany()) { location.replace(homeFor(u)); return; }
  const hasCompany = !!getCompany();
  $('setupView').hidden = hasCompany; $('loginView').hidden = !hasCompany;
  $('setupForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = setupCompany({ companyName: $('s-company').value, adminName: $('s-name').value, email: $('s-email').value, password: $('s-password').value });
    if (!r.ok) { showFieldErrors(mapErr(r.errors, 's-')); showMessage(r.error, 'error', 'setupMsg'); return; }
    location.replace('admin.html');
  });
  $('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = login($('l-email').value, $('l-password').value);
    if (!r.ok) { showFieldErrors(mapErr(r.errors, 'l-')); showMessage(r.error, 'error', 'loginMsg'); return; }
    location.replace(homeFor(r.user));
  });
}
function mapErr(errors, prefix) { const o = {}; Object.keys(errors).forEach(k => { o[prefix + k] = errors[k]; }); return o; }

/* ---- shared sidebar + change-password dialog ---- */
function renderShell(user, active) {
  const company = getCompany();
  const links = user.role === 'admin'
    ? [['admin.html', 'Dashboard'], ['employees.html', 'Employees'], ['leaves.html', 'Leave requests'], ['payslip.html', 'Payslips'], ['settings.html', 'Settings']]
    : [['employee.html', 'My dashboard'], ['payslip.html', 'My payslip']];
  $('sidebar').innerHTML = '<div class="brand">' + escapeHtml(company.name) + '<small>HCM Lite</small></div><nav aria-label="Main">' +
    links.map(l => '<a href="' + l[0] + '"' + (l[0] === active ? ' class="active" aria-current="page"' : '') + '>' + l[1] + '</a>').join('') +
    '</nav><div class="side-foot"><div class="who">' + escapeHtml(user.name) + '<small>' + (user.role === 'admin' ? 'Admin' : 'Employee') + '</small></div>' +
    '<button class="btn ghost light" id="pwdBtn" type="button">Change password</button><button class="btn ghost light" id="logoutBtn" type="button">Log out</button></div>';
  const dlg = document.createElement('dialog'); dlg.id = 'pwdDialog';
  dlg.innerHTML = '<form id="pwdForm" novalidate><h2>Change password</h2><div id="pwdMsg"></div>' +
    ['current:Current password', 'next:New password', 'confirm:Confirm new password'].map(s => { const p = s.split(':'); return '<label for="p-' + p[0] + '">' + p[1] + '</label><input type="password" id="p-' + p[0] + '" autocomplete="off"><small class="err" id="err-' + p[0] + '"></small>'; }).join('') +
    '<div class="row"><button class="btn" type="submit">Save password</button><button class="btn ghost" type="button" id="pwdCancel">Cancel</button></div></form>';
  document.body.appendChild(dlg);
  $('logoutBtn').onclick = logout;
  $('pwdBtn').onclick = () => { $('pwdForm').reset(); clearFieldErrors(); $('pwdMsg').innerHTML = ''; dlg.showModal(); };
  $('pwdCancel').onclick = () => dlg.close();
  $('pwdForm').onsubmit = e => {
    e.preventDefault();
    const r = changePassword($('p-current').value, $('p-next').value, $('p-confirm').value);
    if (!r.ok) { showFieldErrors(r.errors); showMessage(r.error, 'error', 'pwdMsg'); return; }
    dlg.close(); showMessage('Password changed successfully.', 'success');
  };
  const menu = $('menuBtn'); if (menu) menu.onclick = () => { const open = $('sidebar').classList.toggle('open'); menu.setAttribute('aria-expanded', open); };
}
