/* employees.js — add / edit / delete employees (Admin only) */
function validateEmployee(d, editId) {
  const errors = {}, email = d.email.trim().toLowerCase();
  if (!d.name.trim()) errors.name = 'Full name is required.';
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  else if (getUsers().some(u => u.id !== editId && u.email && u.email.toLowerCase() === email)) errors.email = 'This email already belongs to another account.';
  if (!editId && !d.password) errors.password = 'Password is required.';
  else if (d.password && d.password.length < 6) errors.password = 'Use at least 6 characters.';
  if (!d.department.trim()) errors.department = 'Department is required.';
  const salary = Number(d.salary);
  if (d.salary === '' || isNaN(salary)) errors.salary = 'Salary is required.';
  else if (salary <= 0) errors.salary = 'Salary must be greater than zero.';
  return errors;
}
function saveEmployee(d, editId) {
  if (!hasRole('admin')) return fail('Only the Admin can manage employees.');
  const errors = validateEmployee(d, editId);
  if (Object.keys(errors).length) return fail('Please fix the highlighted fields.', errors);
  const users = getUsers();
  if (editId) {
    const u = users.find(x => x.id === editId && x.role === 'employee');
    if (!u) return fail('Employee not found.');
    Object.assign(u, { name: d.name.trim(), email: d.email.trim().toLowerCase(), department: d.department.trim(), salary: Number(d.salary) });
    if (d.password) u.password = d.password;
  } else {
    users.push({ id: newId(), name: d.name.trim(), email: d.email.trim().toLowerCase(), password: d.password, role: 'employee',
      department: d.department.trim(), salary: Number(d.salary), createdAt: todayStr() });
  }
  saveUsers(users);
  return ok({ message: editId ? 'Employee updated.' : 'Employee added. They can now log in with their email and password.' });
}
function deleteEmployee(id) {
  if (!hasRole('admin')) return fail('Only the Admin can manage employees.');
  const users = getUsers(), u = users.find(x => x.id === id);
  if (!u || u.role !== 'employee') return fail('Only employee accounts can be deleted.');
  saveUsers(users.filter(x => x.id !== id));
  saveAttendance(getAttendance().filter(a => a.employeeId !== id));   // no orphaned records
  saveLeaves(getLeaves().filter(l => l.employeeId !== id));
  return ok({ message: u.name + ' and their records were deleted.' });
}
function initEmployeesPage() {
  const user = requireRole('admin'); if (!user) return;
  renderShell(user, 'employees.html');
  let editId = null;
  const fields = ['name', 'email', 'password', 'department', 'salary'];
  const resetForm = () => { editId = null; $('empForm').reset(); clearFieldErrors(); $('formTitle').textContent = 'Add employee'; $('saveBtn').textContent = 'Add employee'; $('cancelEdit').hidden = true; $('f-password').placeholder = ''; };
  const render = () => {
    const emps = getUsers().filter(u => u.role === 'employee'), q = $('search').value.trim().toLowerCase(), dep = $('deptFilter').value;
    const depts = [...new Set(emps.map(e => e.department))].sort();
    $('deptFilter').innerHTML = '<option value="">All departments</option>' + depts.map(d => '<option' + (d === dep ? ' selected' : '') + '>' + escapeHtml(d) + '</option>').join('');
    $('deptList').innerHTML = depts.map(d => '<option value="' + escapeHtml(d) + '">').join('');
    const rows = emps.filter(e => (!q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) && (!$('deptFilter').value || e.department === $('deptFilter').value));
    $('empTable').innerHTML = !emps.length ? emptyState('No employees yet', 'Use the form to add your first employee.')
      : !rows.length ? emptyState('No matches', 'Try a different search or department.')
      : '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Monthly salary</th><th>Actions</th></tr></thead><tbody>' +
        rows.map(e => '<tr><td>' + escapeHtml(e.name) + '</td><td>' + escapeHtml(e.email) + '</td><td>' + escapeHtml(e.department) + '</td><td>' + money(e.salary) + '</td><td><div class="row"><button class="btn small ghost" data-edit="' + e.id + '">Edit</button><button class="btn small danger" data-del="' + e.id + '">Delete</button></div></td></tr>').join('') + '</tbody></table></div>';
  };
  $('empForm').onsubmit = e => {
    e.preventDefault();
    const d = {}; fields.forEach(f => { d[f] = $('f-' + f).value; });
    const r = saveEmployee(d, editId);
    if (!r.ok) { showFieldErrors(r.errors); showMessage(r.error, 'error'); return; }   // keeps the typed values
    resetForm(); showMessage(r.message, 'success'); render();
  };
  $('cancelEdit').onclick = resetForm;
  $('search').oninput = render; $('deptFilter').onchange = render;
  $('empTable').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) {
      const u = getUsers().find(x => x.id === ed.dataset.edit); if (!u) return;
      editId = u.id; fields.forEach(f => { $('f-' + f).value = f === 'password' ? '' : u[f]; });
      $('f-password').placeholder = 'Leave blank to keep current'; $('formTitle').textContent = 'Edit employee'; $('saveBtn').textContent = 'Save changes'; $('cancelEdit').hidden = false; clearFieldErrors(); $('f-name').focus();
    } else if (del) {
      const u = getUsers().find(x => x.id === del.dataset.del);
      if (u && confirm('Delete ' + u.name + '? Their attendance and leave records will also be removed.')) {
        const r = deleteEmployee(u.id); showMessage(r.ok ? r.message : r.error, r.ok ? 'success' : 'error'); if (editId === u.id) resetForm(); render();
      }
    }
  });
  render();
}
