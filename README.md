# PSIT Kanpur — Digital Campus ERP (Full-Stack)

A real, working ERP: Node.js/Express/MongoDB backend + the existing animated frontend,
served together as one app. Student accounts, admin dashboard, file uploads,
PDF downloads, login tracking, and notifications all run against a real database.

> **Important change from the previous version:** this can no longer be hosted on
> GitHub Pages alone — GitHub Pages only serves static files, and this app needs a
> live Node server plus a MongoDB database. See **Deploying** below for the easiest
> free path (Render + MongoDB Atlas), while still keeping your code on GitHub.

---

## What's real vs. what's still a demo

To keep this honest:

**Fully wired to the backend (real CRUD, persists after refresh):**
Student & Admin login/logout, session resume on refresh, forgot/reset password,
change password/email, profile fields (name, phone, address, social links, skills,
projects, achievements, parent & emergency contacts), profile photo upload/remove,
resume upload/replace/delete/download, certificate upload/delete/download (multiple),
attendance & results (populated by admin bulk upload), notices/assignments/placements
(posted by admin, instantly visible to students), notifications, admin student CRUD
(add/edit/delete/suspend/reset password), CSV bulk upload for results & attendance,
credential export (CSV/Excel/PDF), login history with IP/browser/OS/device tracking,
and PDF downloads for marksheet, transcript, fee receipt, bonafide certificate,
attendance report, admit card, and profile.

**Still client-side demo data (not requested in the backend scope, kept as rich
interactive UI):** Timetable, Library (book borrow/return), Hostel mess menu/leave
form, and Bus Transport tracking. These look and behave the same as before but
aren't backed by the database yet — a natural next step if you want them wired up too.

**Known limitation:** the "recently generated credentials" list (for CSV/Excel/PDF
export) is kept in server memory, not the database — it resets if the server
restarts. Fine for demo/small-batch use; for production you'd want a small
`Credential` collection instead.

---

## Project structure

```
psit-erp-app/
├── backend/
│   ├── server.js            # Express app entry point
│   ├── seed.js               # creates the first admin + sample students
│   ├── .env.example           # copy to .env and fill in
│   ├── config/db.js
│   ├── models/                # Student, Admin, LoginLog, Notice/Assignment/Placement/Notification
│   ├── controllers/
│   ├── routes/
│   ├── middleware/            # auth (JWT), upload (multer), validation, error handling
│   ├── utils/                 # JWT signing, credential/ID generation, PDF generator
│   └── uploads/                # photos / resumes / certificates land here
└── public/
    └── index.html             # the existing animated frontend (unchanged design), now calling the API
```

---

## 1. Run it locally first (recommended before deploying)

You'll need [Node.js 18+](https://nodejs.org) and a MongoDB connection string —
the fastest way to get one free is [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
(create a free M0 cluster, add a database user, and copy the connection string).

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `MONGO_URI` — your Atlas connection string (include a database name, e.g. `.../psit_erp?...`)
- `JWT_SECRET` — any long random string (e.g. run `openssl rand -hex 32`)
- Leave `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` as-is or customize them

Then seed the database with an admin account and 3 sample students:

```bash
npm run seed
```

This prints the admin login and each sample student's login to your terminal —
copy them down. Now start the server:

```bash
npm start
```

Visit **http://localhost:5000** — that's the full app, frontend and API together.
Log in with the admin credentials to reach the Admin Dashboard, or a student
account to see the student side. Use "Forgot password?" to test the reset flow
(since no email service is configured, the reset token is shown to you directly —
this is clearly labeled as dev-mode behavior in the UI).

---

## 2. Push it to GitHub

```bash
cd psit-erp-app
git init
git add .
git commit -m "PSIT ERP full-stack app"
```

Create a new repo at [github.com/new](https://github.com/new), then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Your `.env` file is git-ignored on purpose — never commit real secrets.

---

## 3. Deploy it live (Render + MongoDB Atlas — both free)

1. Make sure you already have a MongoDB Atlas cluster and connection string (step 1 above).
   In Atlas, under **Network Access**, add `0.0.0.0/0` so your host can connect.
2. Go to [render.com](https://render.com), sign up, and click **New → Web Service**.
3. Connect your GitHub account and pick the repo you just pushed.
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment**, add the same variables from your `.env`:
   `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `CORS_ORIGIN` (your Render URL once known, or leave as `*` to start).
6. Click **Create Web Service**. Render builds and deploys automatically.
7. Once live, run the seed script once against your production database — easiest way:
   temporarily set your local `.env`'s `MONGO_URI` to the same Atlas URI and run
   `npm run seed` locally (it connects straight to Atlas, no need to run it on Render).
8. Your live URL will look like `https://<your-app>.onrender.com` — that's the whole
   ERP, live and shareable. Every future `git push` to `main` auto-redeploys it.

Render's free tier sleeps after inactivity and takes ~30–60 seconds to wake up on
the first request — normal for free hosting, not a bug.

---

## Auth model — how "only your own data" is enforced

Every Student document *is* the login account (no separate User table needed) —
`studentId`, `email`, `rollNumber`, `registrationNumber`, and `password` all live
directly on it. The flow is:

1. Login matches one student by `studentId` / `rollNumber` / `registrationNumber` / `email`.
2. The JWT is signed with **that student's own `_id`** — never a hardcoded or first-found ID.
3. `middleware/auth.js` decodes the token on every request and re-fetches
   `Student.findById(decoded.id)`, attaching it as `req.user`.
4. Every `/students/me/*` route reads `req.user._id` — it never accepts a
   student ID from the client for "my own data." Only admin routes accept an
   `:id` param, and those require the `adminOnly` middleware.

This means a student can never see or edit another student's data, by construction —
there's no code path where that could happen. If you ever see mismatched data in
practice, it's almost always a stale token in the browser's `localStorage` from a
previous session; log out (or test in an incognito window) and it'll resolve.

## Extended student fields (Admin → Add/Edit Student)

Beyond the original field set, the Student model and admin form now also support:
`registrationNumber` (unique, optional), `semester`, `admissionYear`, `dateOfBirth`,
`gender`, `bloodGroup`, `category`, plus `parentName`/`parentContact` (stored under
`parentDetails`) and a plain `address` line. Students can log in with their
**Student ID, Roll Number, Registration Number, or Email** — all four resolve to
the same account.

---

## Security notes

- Passwords are hashed with bcrypt, never stored in plain text.
- Auth uses JWTs (`Authorization: Bearer <token>`), verified on every protected route.
- File uploads are restricted by type and size (see `middleware/upload.js`).
- Login/auth endpoints are rate-limited to slow down brute-force attempts.
- Forgot-password doesn't reveal whether an account exists, and reset tokens expire in 30 minutes.
- Change `JWT_SECRET` and the seeded admin password before sharing this with real students.
