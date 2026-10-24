/* helper.js — keyword-based smart helper. Answers come from real localStorage records only. */
const has = (q, words) => words.some(w => q.includes(w));
const names = list => list.map(u => u.name).join(', ');

function adminAnswer(q) {
  const today = todayStr(), b = dayBreakdown(today), emps = getUsers().filter(u => u.role === 'employee');
  if (has(q, ['pending'])) { const n = getLeaves().filter(l => l.status === 'pending' && emps.some(e => e.id === l.employeeId)).length; return n + ' leave request' + (n === 1 ? ' is' : 's are') + ' pending.'; }
  if (has(q, ['leave', 'vacation'])) return b.onLeave.length ? b.onLeave.length + ' on approved leave today: ' + names(b.onLeave) + '.' : 'Nobody is on approved leave today.';
  if (has(q, ['late'])) { const l = emps.filter(u => { const r = getRecord(u.id, today); return r && r.late; }); return l.length ? l.length + ' late today: ' + names(l) + '.' : 'Nobody has been late today.'; }
  if (has(q, ['absent'])) return b.absent.length ? b.absent.length + ' not checked in / absent today: ' + names(b.absent) + '.' : 'Nobody is absent today.';
  if (has(q, ['present', 'checked in', 'attendance', 'here'])) { const n = b.present.length + b.late.length + b.half.length; return n + ' of ' + emps.length + ' employees have checked in today (' + b.present.length + ' on time, ' + b.late.length + ' late, ' + b.half.length + ' half day).'; }
  if (has(q, ['employee', 'staff', 'headcount', 'people'])) return 'You have ' + emps.length + ' employee' + (emps.length === 1 ? '' : 's') + '.';
  return 'Sorry, I can’t answer that yet. Try: “How many employees do we have?”, “Who is on leave today?”, “Who was late today?”, “How many employees are present today?” or “How many leave requests are pending?”';
}
function employeeAnswer(q, user) {
  const c = getCompany(), today = todayStr(), rec = getRecord(user.id, today);
  const others = getUsers().filter(u => u.id !== user.id && u.name.length > 2 && (q.includes(u.name.toLowerCase()) || q.includes((u.email || '').toLowerCase())));
  if (others.length || /\b(who|everyone|everybody|colleagues?|coworkers?|others?|employees|company|salary of)\b/.test(q)) return 'I can only answer questions about your own records.';
  if (has(q, ['left', 'remaining', 'balance', 'how many leave'])) { const left = leaveBalance(user.id, new Date().getFullYear()); return 'You have ' + left + ' leave day' + (left === 1 ? '' : 's') + ' left this year (quota ' + c.leaveQuota + ').'; }
  if (has(q, ['leave', 'request', 'applied'])) {
    const mine = getLeaves().filter(l => l.employeeId === user.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
    return mine.length ? 'Your latest request' + (mine.length > 1 ? 's: ' : ': ') + mine.map(l => l.type + ' ' + l.startDate + ' to ' + l.endDate + ' is ' + l.status).join('; ') + '.' : 'You have not submitted any leave requests.';
  }
  if (has(q, ['late'])) return !rec ? 'You have not checked in today yet.' : rec.late ? 'Yes, you checked in at ' + rec.checkIn + ', after the late limit of ' + minutesToHHMM(lateThreshold(c)) + '.' : 'No, you were on time today (checked in at ' + rec.checkIn + ').';
  if (has(q, ['hour', 'worked', 'work', 'week'])) {
    const d = parseDate(today), monday = addDays(today, -((d.getDay() + 6) % 7));
    const done = getAttendance().filter(a => a.employeeId === user.id && a.date >= monday && a.date <= today && durationMinutes(a) !== null);
    const total = done.reduce((n, a) => n + durationMinutes(a), 0);
    return 'This week (Monday ' + monday + ' to today) you worked ' + formatDuration(total) + ' over ' + done.length + ' completed day' + (done.length === 1 ? '' : 's') + '.';
  }
  if (has(q, ['attendance', 'status', 'today', 'checked', 'present'])) {
    if (!isWorkingDay(today, c)) return 'Today is not a working day.';
    if (isOnLeave(user.id, today)) return 'You are on approved leave today.';
    return rec ? 'Today you are marked ' + (STATUS_LABEL[rec.status] || rec.status).toLowerCase() + ' (in ' + rec.checkIn + (rec.checkOut ? ', out ' + rec.checkOut : ', not checked out yet') + ').' : 'You have not checked in today yet.';
  }
  return 'Sorry, I can’t answer that yet. Try: “How many leaves do I have left?”, “Was I late today?”, “How many hours did I work this week?”, “What is my attendance status today?” or “What is the status of my leave request?”';
}
function askHelper(question) {
  const user = currentUser(); if (!user) return 'Please log in again.';
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return 'Please type a question.';
  return user.role === 'admin' ? adminAnswer(q) : employeeAnswer(q, user);
}
function initChat() {
  const log = $('chatLog'), add = (t, who) => { const p = document.createElement('p'); p.className = 'msg ' + who; p.textContent = t; log.appendChild(p); log.scrollTop = log.scrollHeight; };
  add('Hi! Ask me about your HR data.', 'bot');
  $('chatForm').onsubmit = e => { e.preventDefault(); const q = $('chatInput').value.trim(); if (!q) return; add(q, 'me'); add(askHelper(q), 'bot'); $('chatInput').value = ''; };
}
