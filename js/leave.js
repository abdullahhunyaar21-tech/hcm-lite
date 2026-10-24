/* leave.js — leave rules (working days only, overlap, yearly quota) + leaves page + apply form. */
const isActiveLeave = l => l.status === 'pending' || l.status === 'approved';
function isOnLeave(empId, date) { return getLeaves().some(l => l.employeeId === empId && l.status === 'approved' && l.startDate <= date && date <= l.endDate); }
/* Working days of one leave that fall inside a calendar year */
function leaveDaysInYear(l, year, c) {
  const ys = year + '-01-01', ye = year + '-12-31', s = l.startDate > ys ? l.startDate : ys, e = l.endDate < ye ? l.endDate : ye;
  return s > e ? 0 : countWorkingDays(s, e, c);
}
function approvedDaysInYear(empId, year, c, excludeId) {
  return getLeaves().filter(l => l.employeeId === empId && l.status === 'approved' && l.id !== excludeId).reduce((n, l) => n + leaveDaysInYear(l, year, c), 0);
}
const leaveBalance = (empId, year) => { const c = getCompany(); return c.leaveQuota - approvedDaysInYear(empId, year, c); };

/* Shared validation used on submit AND on approval */
function validateLeaveRange(empId, start, end, excludeId) {
  const c = getCompany(), errors = {};
  if (!start) errors.start = 'Start date is required.';
  if (!end) errors.end = 'End date is required.';
  if (start && end && start > end) errors.end = 'End date must be on or after the start date.';
  if (Object.keys(errors).length) return { errors };
  const days = countWorkingDays(start, end, c);
  if (days === 0) { errors.end = 'This range has no working days.'; return { errors, days }; }
  const clash = getLeaves().find(l => l.employeeId === empId && l.id !== excludeId && isActiveLeave(l) && start <= l.endDate && end >= l.startDate);
  if (clash) { errors.start = 'Overlaps your ' + clash.status + ' leave (' + clash.startDate + ' to ' + clash.endDate + ').'; return { errors, days }; }
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    const used = approvedDaysInYear(empId, y, c, excludeId), want = leaveDaysInYear({ startDate: start, endDate: end }, y, c);
    if (used + want > c.leaveQuota) { errors.end = 'Exceeds the ' + c.leaveQuota + '-day quota for ' + y + ' (' + used + ' approved, ' + want + ' requested).'; break; }
  }
  return { errors, days };
}
function applyLeave(d) {
  const user = currentUser();
  if (!user || user.role !== 'employee') return fail('Only employees can apply for leave.');
  const v = validateLeaveRange(user.id, d.startDate, d.endDate);
  const errors = {}; if (v.errors.start) errors.start = v.errors.start; if (v.errors.end) errors.end = v.errors.end;
  if (!d.reason.trim()) errors.reason = 'Please give a reason.';
  if (!['casual', 'sick', 'other'].includes(d.type)) errors.type = 'Choose a leave type.';
  if (Object.keys(errors).length) return fail('Leave request not submitted.', errors);
  const list = getLeaves();
  list.push({ id: newId(), employeeId: user.id, type: d.type, startDate: d.startDate, endDate: d.endDate, days: v.days, reason: d.reason.trim(), status: 'pending', adminComment: '', createdAt: todayStr() });
  saveLeaves(list);
  return ok({ message: 'Leave request submitted (' + v.days + ' working day' + (v.days === 1 ? '' : 's') + ').' });
}
function processLeave(id, status, comment) {
  if (!hasRole('admin')) return fail('Only the Admin can process leave requests.');
  const list = getLeaves(), l = list.find(x => x.id === id);
  if (!l) return fail('Request not found.');
  if (l.status !== 'pending') return fail('This request was already ' + l.status + '.');
  if (!comment.trim()) return fail('Add a comment before ' + (status === 'approved' ? 'approving' : 'rejecting') + '.');
  if (status === 'approved') {
    const v = validateLeaveRange(l.employeeId, l.startDate, l.endDate, l.id);
    if (Object.keys(v.errors).length) return fail('Cannot approve: ' + Object.values(v.errors)[0]);
    l.days = v.days;
  }
  l.status = status; l.adminComment = comment.trim(); l.processedAt = todayStr();
  saveLeaves(list);
  return ok({ message: 'Request ' + status + '.' });
}
const empName = id => { const u = getUsers().find(x => x.id === id); return u ? u.name : 'Unknown'; };

function initLeaveForm(user, onDone) {
  const form = $('leaveForm');
  form.onsubmit = e => {
    e.preventDefault();
    const r = applyLeave({ type: $('lv-type').value, startDate: $('lv-start').value, endDate: $('lv-end').value, reason: $('lv-reason').value });
    if (!r.ok) { showFieldErrors(mapErr(r.errors, 'lv-')); showMessage(r.error, 'error', 'leaveMsg'); return; }
    form.reset(); clearFieldErrors(); showMessage(r.message, 'success', 'leaveMsg'); onDone();
  };
}
function initLeavesPage() {
  const user = requireRole('admin'); if (!user) return;
  renderShell(user, 'leaves.html');
  const render = () => {
    const f = $('statusFilter').value;
    const rows = getLeaves().filter(l => getUsers().some(u => u.id === l.employeeId) && (!f || l.status === f)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('leaveTable').innerHTML = rows.length ? '<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead><tbody>' +
      rows.map(l => '<tr><td>' + escapeHtml(empName(l.employeeId)) + '</td><td>' + escapeHtml(l.type) + '</td><td>' + l.startDate + ' to ' + l.endDate + '</td><td>' + l.days + '</td><td>' + escapeHtml(l.reason) + '</td><td>' + badge(l.status) + '</td><td>' +
        (l.status === 'pending' ? '<label class="sr" for="c-' + l.id + '">Comment</label><input id="c-' + l.id + '" placeholder="Comment (required)"><div class="row"><button class="btn small" data-act="approved" data-id="' + l.id + '">Approve</button><button class="btn small danger" data-act="rejected" data-id="' + l.id + '">Reject</button></div>' : escapeHtml(l.adminComment || '—')) + '</td></tr>').join('') + '</tbody></table></div>'
      : emptyState('No leave requests', 'Requests from employees will appear here.');
  };
  $('statusFilter').onchange = render;
  $('leaveTable').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const r = processLeave(b.dataset.id, b.dataset.act, $('c-' + b.dataset.id).value);
    showMessage(r.ok ? r.message : r.error, r.ok ? 'success' : 'error'); if (r.ok) render();
  });
  render();
}
