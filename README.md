# HCM Lite — Saylani Hackathon (Beginner Track)

A small HR web app for an Admin and Employees, built with only HTML, CSS and vanilla JavaScript. All data lives in the browser's `localStorage`. No framework, no backend, no build step, no API keys.

## Features
- First-run company + Admin setup, login/logout, change password, role-protected pages
- Admin: add/edit/delete employees (creates their login), search + department filter, company settings, leave approval with comment, payslips for anyone, announcements, dashboard totals, smart helper
- Employee: check in/out (present / late / half day), own attendance history, apply for leave, leave balance, own payslip, announcements, smart helper (own data only)
- Payslip with print-friendly layout (use the browser's **Save as PDF**)

## Folder structure
```
hcm-lite/
├── index.html  admin.html  employees.html  leaves.html  settings.html  employee.html  payslip.html
├── css/style.css
├── js/ storage.js  auth.js  employees.js  attendance.js  leave.js  helper.js
│       dashboard.js  payslip.js  settings.js  announcements.js
└── README.md
```

## Run locally
Double-click `index.html`, or (recommended) run a tiny static server in the folder: `python -m http.server 8000` then open http://localhost:8000. (VS Code "Live Server" also works.) Use ONE address consistently — localStorage is separate per address.

## First use
1. Open `index.html` → fill in company name + Admin name/email/password → you land on the Admin dashboard.
2. **Settings**: set office start time, grace minutes, yearly leave quota, working days.
3. **Employees**: add an employee (name, email, password, department, salary).
4. Log out, log in as the employee: **Check in**, later **Check out**; apply for leave.
5. Log in as Admin: **Leave requests** → approve/reject with a comment. Open **Payslips**.
6. Try the Smart helper on both dashboards.

## Roles
- **Admin** manages everything. **Employee** sees only their own attendance, leave, salary slip and helper answers. Every page checks the session/role on load, and each action re-checks the role.

## localStorage keys
`hcm_company` (name, officeStart, graceMinutes, leaveQuota, workingDays[0=Sun..6=Sat]) · `hcm_users` · `hcm_attendance` · `hcm_leaves` · `hcm_session` · `hcm_announcements`.

## Business rules (as implemented)
- Late: check-in strictly after office start + grace. Work under 5 h (at check-out) = half day; this overrides late (record keeps `late: true`).
- Absent: a configured working day with no attendance record and no approved leave. Today and future days are never counted in payslips; the dashboard shows "Absent" today for working-day employees who have not checked in yet. Days before an employee was added are not absences.
- Leave: working days only; no overlap with pending/approved requests; approved days per calendar year can't exceed the quota (leave across New Year is split by year); rules re-checked on approval; a comment is required to approve or reject.
- Payslip: per day = salary ÷ working days in month; deduction = per day × (absent + 0.5 × half days); net = salary − deduction. Zero working days → no deduction.

## Reset the demo
Browser DevTools → Application → Local Storage → delete the `hcm_*` keys (or "Clear site data"), then reload.

## Testing checklist
See the 40-step list in the hackathon brief. Quick manual pass: setup → add employee → login as employee → check in twice (blocked) → check out (<5h = half day) → apply overlapping leave (blocked) → approve as Admin → balance drops → reject another → balance unchanged → payslip → helper questions → resize to phone width.

## Deploy
- **GitHub Pages**: create a repo, upload the folder contents, Settings → Pages → deploy from `main` / root.
- **Netlify**: drag the folder onto app.netlify.com/drop.
- **Vercel**: import the repo (framework "Other", no build command).
Then submit the repo link and hosted link on https://lms.saylaniit.com/.

## Limitations
Passwords are stored in plain text in localStorage and anyone with access to the browser can read or edit all data — this is a learning demo, not secure authentication. Data stays in one browser on one device and does not sync between browsers or devices.
