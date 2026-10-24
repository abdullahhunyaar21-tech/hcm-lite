/* payslip.js — monthly salary slip. Absences count only dates BEFORE today (current day is in progress,
   future days never count). Approved-leave days are not absences. */
function calcPayslip(empId, ym) {
  const viewer = currentUser();
  if (!viewer || (viewer.role !== 'admin' && viewer.id !== empId)) return fail('You can only view your own payslip.');
  const emp = getUsers().find(u => u.id === empId && u.role === 'employee');
  if (!emp) return fail('Employee not found.');
  const c = getCompany(), [y, m] = ym.split('-').map(Number);
  const first = ym + '-01', last = toDateStr(new Date(y, m, 0));
  const workingDays = countWorkingDays(first, last, c);
  const absentDays = getAbsentDates(emp, first, last).length;
  const halfDays = getAttendance().filter(a => a.employeeId === emp.id && a.date >= first && a.date <= last && a.status === 'half-day').length;
  const perDay = workingDays > 0 ? emp.salary / workingDays : 0;
  const deduction = perDay * (absentDays + 0.5 * halfDays);
  return ok({ company: c.name, emp, ym, workingDays, absentDays, halfDays, perDay, deduction, net: emp.salary - deduction });
}
function renderPayslip() {
  const me = currentUser(), empId = me && me.role === 'admin' ? $('slipEmp').value : (me ? me.id : ''), ym = $('slipMonth').value;
  if (!empId || !ym) { $('slip').innerHTML = emptyState('Nothing to show', 'Choose an employee and a month.'); return; }
  const r = calcPayslip(empId, ym);
  if (!r.ok) { $('slip').innerHTML = emptyState(r.error); return; }
  const monthName = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const row = (a, b) => '<tr><th scope="row">' + a + '</th><td>' + b + '</td></tr>';
  $('slip').innerHTML = '<h2>' + escapeHtml(r.company) + '</h2><p class="muted">Salary slip — ' + monthName + '</p><div class="table-wrap"><table class="kv"><tbody>' +
    row('Employee', escapeHtml(r.emp.name)) + row('Department', escapeHtml(r.emp.department)) + row('Monthly base salary', money(r.emp.salary)) +
    row('Working days in month', r.workingDays) + row('Absent days', r.absentDays) + row('Half days', r.halfDays) + row('Per-day salary', money(r.perDay)) +
    row('Total deduction', money(r.deduction)) + '<tr class="net"><th scope="row">Net salary</th><td>' + money(r.net) + '</td></tr></tbody></table></div>' +
    (r.workingDays === 0 ? '<p class="muted">No working days are configured for this month, so no per-day salary or deduction applies.</p>' : '') +
    '<p class="muted small-text">Absences are counted up to yesterday for the current month. Approved leave is not deducted.</p>';
}
function initPayslipPage() {
  const user = requireRole('any'); if (!user) return;
  renderShell(user, 'payslip.html');
  $('slipMonth').value = todayStr().slice(0, 7);
  if (user.role === 'admin') {
    const emps = getUsers().filter(u => u.role === 'employee');
    $('slipEmp').innerHTML = emps.map(e => '<option value="' + e.id + '">' + escapeHtml(e.name) + '</option>').join('');
    $('empPick').hidden = false; $('slipEmp').onchange = renderPayslip;
  }
  $('slipMonth').onchange = renderPayslip; $('printBtn').onclick = () => window.print();
  renderPayslip();
}
