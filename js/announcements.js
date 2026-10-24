/* announcements.js — Admin posts, everyone reads (newest first) */
function addAnnouncement(title, message) {
  const user = currentUser();
  if (!user || user.role !== 'admin') return fail('Only the Admin can post announcements.');
  const errors = {};
  if (!title.trim()) errors.title = 'Title is required.';
  if (!message.trim()) errors.message = 'Message is required.';
  if (Object.keys(errors).length) return fail('Announcement not posted.', errors);
  const list = getAnnouncements();
  list.push({ id: newId(), title: title.trim(), message: message.trim(), createdAt: new Date().toISOString(), author: user.name });
  saveAnnouncements(list);
  return ok({ message: 'Announcement posted.' });
}
function renderAnnouncements(containerId) {
  const list = getAnnouncements().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  $(containerId).innerHTML = list.length ? list.map(a => '<article class="note"><h3>' + escapeHtml(a.title) + '</h3><p>' + escapeHtml(a.message) + '</p><small>' + escapeHtml(a.author) + ' · ' + new Date(a.createdAt).toLocaleDateString() + '</small></article>').join('')
    : emptyState('No announcements', 'Posted announcements will show up here.');
}
function initAnnounceForm() {
  $('announceForm').onsubmit = e => {
    e.preventDefault();
    const r = addAnnouncement($('an-title').value, $('an-message').value);
    if (!r.ok) { showFieldErrors(mapErr(r.errors, 'an-')); showMessage(r.error, 'error'); return; }
    $('announceForm').reset(); clearFieldErrors(); showMessage(r.message, 'success'); renderAnnouncements('announceList');
  };
}
