/* settings.js — company settings (Admin only), stored in hcm_company */
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function saveSettings(d) {
  if (!hasRole('admin')) return fail('Only the Admin can change settings.');
  const errors = {}, grace = Number(d.graceMinutes), quota = Number(d.leaveQuota);
  if (!d.name.trim()) errors.name = 'Company name is required.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.officeStart)) errors.officeStart = 'Enter a valid time.';
  if (d.graceMinutes === '' || !Number.isInteger(grace) || grace < 0 || grace > 240) errors.graceMinutes = 'Enter whole minutes from 0 to 240.';
  if (d.leaveQuota === '' || !Number.isInteger(quota) || quota < 0 || quota > 365) errors.leaveQuota = 'Enter whole days from 0 to 365.';
  if (Object.keys(errors).length) return fail('Settings not saved.', errors);
  saveCompany({ name: d.name.trim(), officeStart: d.officeStart, graceMinutes: grace, leaveQuota: quota, workingDays: d.workingDays });
  return ok({ message: 'Settings saved. They apply to all calculations immediately.' });
}
function initSettingsPage() {
  const user = requireRole('admin'); if (!user) return;
  renderShell(user, 'settings.html');
  const c = getCompany();
  $('st-name').value = c.name; $('st-start').value = c.officeStart; $('st-grace').value = c.graceMinutes; $('st-quota').value = c.leaveQuota;
  $('dayBoxes').innerHTML = DAY_LABELS.map((l, i) => '<label class="check"><input type="checkbox" value="' + i + '"' + (c.workingDays.includes(i) ? ' checked' : '') + '> ' + l + '</label>').join('');
  $('settingsForm').onsubmit = e => {
    e.preventDefault();
    const days = [...document.querySelectorAll('#dayBoxes input:checked')].map(i => Number(i.value));
    const r = saveSettings({ name: $('st-name').value, officeStart: $('st-start').value, graceMinutes: $('st-grace').value, leaveQuota: $('st-quota').value, workingDays: days });
    if (!r.ok) { showFieldErrors(r.errors); showMessage(r.error, 'error'); return; }
    clearFieldErrors(); showMessage(r.message + (days.length ? '' : ' Note: no working days selected, so no day counts as working.'), 'success'); renderShell(user, 'settings.html');
  };
}
