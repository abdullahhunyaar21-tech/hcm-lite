/* attendance.js — check-in/out rules, status, absence and daily breakdown.
   Policy: status is 'present' | 'late' | 'half-day'. A half day (work < 5h) overrides late
   (the record keeps late:true). Today's absence = working day with no record and not on leave;
   past absences exclude today (the day is still in progress) and days before the employee was added. */
const HALF_DAY_MINUTES = 300;
const STATUS_LABEL = { present: 'Present', late: 'Late', 'half-day': 'Half day', absent: 'Absent', leave: 'On leave' };
const badge = s => '<span class="badge ' + s + '">' + (STATUS_LABEL[s] || s) + '</span>';
const getRecord = (empId, date) => getAttendance().find(a => a.employeeId === empId && a.date === date);
const lateThreshold = c => timeToMinutes(c.officeStart) + Number(c.graceMinutes);

function durationMinutes(rec) {
  if (!rec || !rec.checkIn || !rec.checkOut) return null;
  const d = timeToMinutes(rec.checkOut) - timeToMinutes(rec.checkIn);
  return d >= 0 ? d : null;
}
function checkIn() {
  const user = currentUser(), c = getCompany();
  if (!user || user.role !== 'employee') return fail('Only employees can check in.');
  const date = todayStr();
  if (!isWorkingDay(date, c)) return fail('Today is not a working day.');
  if (getRecord(user.id, date)) return fail('You have already checked in today.');
  if (isOnLeave(user.id, date)) return fail('You are on approved leave today.');
  const time = nowTime(), late = timeToMinutes(time) > lateThreshold(c);
  const list = getAttendance();
  list.push({ id: newId(), employeeId: user.id, date, checkIn: time, checkOut: null, status: late ? 'late' : 'present', late });
  saveAttendance(list);
  return ok({ message: late ? 'Checked in at ' + time + ' — marked late.' : 'Checked in at ' + time + '.' });
}
function checkOut() {
  const user = currentUser();
  if (!user || user.role !== 'employee') return fail('Only employees can check out.');
  const list = getAttendance(), rec = list.find(a => a.employeeId === user.id && a.date === todayStr());
  if (!rec) return fail('Check in before you check out.');
  if (rec.checkOut) return fail('You have already checked out today.');
  const time = nowTime();
  if (timeToMinutes(time) < timeToMinutes(rec.checkIn)) return fail('Check-out cannot be before check-in.');
  rec.checkOut = time;
  const mins = durationMinutes(rec);
  rec.status = mins < HALF_DAY_MINUTES ? 'half-day' : (rec.late ? 'late' : 'present');
  saveAttendance(list);
  return ok({ message: 'Checked out at ' + time + '. Worked ' + formatDuration(mins) + (rec.status === 'half-day' ? ' (half day).' : '.') });
}
/* Absent dates between from..to (inclusive); never today/future, never before the employee joined. */
function getAbsentDates(emp, from, to) {
  const c = getCompany(), out = [], last = to < addDays(todayStr(), -1) ? to : addDays(todayStr(), -1);
  const first = emp.createdAt && emp.createdAt > from ? emp.createdAt : from;
  if (first > last) return out;
  const recs = new Set(getAttendance().filter(a => a.employeeId === emp.id).map(a => a.date));
  eachDate(first, last, ds => { if (isWorkingDay(ds, c) && !recs.has(ds) && !isOnLeave(emp.id, ds)) out.push(ds); });
  return out;
}
/* Mutually exclusive categories for one date (no double counting). Arrays of user objects. */
function dayBreakdown(date) {
  const c = getCompany(), b = { present: [], late: [], half: [], absent: [], onLeave: [] };
  getUsers().filter(u => u.role === 'employee' && (!u.createdAt || u.createdAt <= date)).forEach(u => {
    const rec = getRecord(u.id, date);
    if (rec) { (rec.status === 'half-day' ? b.half : rec.status === 'late' ? b.late : b.present).push(u); }
    else if (isOnLeave(u.id, date)) b.onLeave.push(u);
    else if (isWorkingDay(date, c)) b.absent.push(u);
  });
  return b;
}
