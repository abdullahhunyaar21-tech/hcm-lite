/* dashboard.js — Admin and Employee dashboards (all numbers calculated from stored records) */
const statCard = (label, value, cls) => '<div class="stat ' + (cls || '') + '"><strong>' + value + '</strong><span>' + label + '</span></div>';

function initAdminPage() {
  const user = requireRole('admin'); if (!user) return;
  renderShell(user, 'admin.html'); initChat(); initAnnounceForm(); renderAnnouncements('announceList');
  const emps = getUsers().filter(u => u.role === 'employee'), today = todayStr(), b = dayBreakdown(today);
  const pending = getLeaves().filter(l => l.status === 'pending' && emps.some(e => e.id === l.employeeId)).length;
  $('stats').innerHTML = statCard('Active employees', emps.length) + statCard('Present (on time)', b.present.length, 'good') + statCard('Late', b.late.length, 'warn') +
    statCard('Half day', b.half.length, 'warn') + statCard('Absent', b.absent.length, 'bad') + statCard('On leave', b.onLeave.length, 'info') + statCard('Pending leaves', pending, 'info');
  const depts = [...new Set(emps.map(e => e.department))].sort();
  $('deptChart').innerHTML = depts.length ? depts.map(d => {
    const team = emps.filter(e => e.department === d), here = team.filter(e => getRecord(e.id, today)).length;
    return '<div class="bar-row"><span>' + escapeHtml(d) + '</span><div class="bar"><i style="width:' + Math.round(here / team.length * 100) + '%"></i></div><b>' + here + '/' + team.length + '</b></div>';
  }).join('') : emptyState('No departments yet', 'Add employees to see attendance by department.');
  const recent = getAttendance().filter(a => emps.some(e => e.id === a.employeeId)).sort((a, b2) => (b2.date + b2.checkIn).localeCompare(a.date + a.checkIn)).slice(0, 8);
  $('recentTable').innerHTML = recent.length ? '<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Date</th><th>In</th><th>Out</th><th>Status</th></tr></thead><tbody>' +
    recent.map(a => '<tr><td>' + escapeHtml(empName(a.employeeId)) + '</td><td>' + a.date + '</td><td>' + a.checkIn + '</td><td>' + (a.checkOut || '—') + '</td><td>' + badge(a.status) + '</td></tr>').join('') + '</tbody></table></div>'
    : emptyState('No attendance yet', 'Records appear when employees check in.');
}

function initEmployeePage() {
  const user = requireRole('employee'); if (!user) return;
  renderShell(user, 'employee.html'); initChat(); renderAnnouncements('announceList');
  initLeaveForm(user, render);
  const act = fn => () => { const r = fn(); showMessage(r.ok ? r.message : r.error, r.ok ? 'success' : 'error'); render(); };
  $('checkInBtn').onclick = act(checkIn); $('checkOutBtn').onclick = act(checkOut);
  function render() {
    const c = getCompany(), today = todayStr(), rec = getRecord(user.id, today), year = new Date().getFullYear();
    const working = isWorkingDay(today, c), onLeave = isOnLeave(user.id, today);
    $('empInfo').textContent = user.name + ' · ' + user.department;
    $('todayStatus').innerHTML = !working ? '<span class="badge leave">Non-working day</span>' : onLeave && !rec ? badge('leave')
      : rec ? badge(rec.status) + (rec.late && rec.status === 'half-day' ? ' <span class="badge late">Arrived late</span>' : '') : '<span class="badge pending">Not checked in</span>';
    $('todayTimes').textContent = rec ? 'In ' + rec.checkIn + ' · Out ' + (rec.checkOut || '—') + ' · Worked ' + (rec.checkOut ? formatDuration(durationMinutes(rec)) : 'in progress') : 'Late after ' + minutesToHHMM(lateThreshold(c)) + '.';
    $('checkInBtn').disabled = !!rec || !working || onLeave; $('checkOutBtn').disabled = !rec || !!rec.checkOut;
    const monthStart = today.slice(0, 7) + '-01';
    $('balance').textContent = leaveBalance(user.id, year); $('quotaNote').textContent = 'of ' + c.leaveQuota + ' days in ' + year;
    $('absentMonth').textContent = getAbsentDates(user, monthStart, today).length;
    const hist = getAttendance().filter(a => a.employeeId === user.id).sort((a, b) => b.date.localeCompare(a.date));
    $('historyTable').innerHTML = hist.length ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Duration</th></tr></thead><tbody>' +
      hist.map(a => '<tr><td>' + a.date + '</td><td>' + a.checkIn + '</td><td>' + (a.checkOut || '—') + '</td><td>' + badge(a.status) + '</td><td>' + formatDuration(durationMinutes(a)) + '</td></tr>').join('') + '</tbody></table></div>' : emptyState('No attendance yet', 'Check in to start your history.');
    const mine = getLeaves().filter(l => l.employeeId === user.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
    $('myLeaves').innerHTML = mine.length ? '<div class="table-wrap"><table><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Admin comment</th></tr></thead><tbody>' +
      mine.map(l => '<tr><td>' + escapeHtml(l.type) + '</td><td>' + l.startDate + ' to ' + l.endDate + '</td><td>' + l.days + '</td><td>' + badge(l.status) + '</td><td>' + escapeHtml(l.adminComment || '—') + '</td></tr>').join('') + '</tbody></table></div>' : emptyState('No leave requests', 'Use the form to apply for leave.');
  }
  render();
}
