# Makerspace

Check-in / check-out for the lab, built on React + Vite + Tailwind, with Supabase as the backend.
Hosted free on Cloudflare Pages. No emails and no Google login.

## Status

- Done: QR check-in/out, one-time student registration, staff "inside now" list, admin QR page, staff password login
- Next: ideas, component requests, inventory, projects, Google Sheets mirror

## How login works

```
Student: scan lab QR -> phone gets an anonymous account (needs the QR token)
         -> fills profile once -> every later scan is one tap
Staff:   email + password (accounts created by an admin in the Supabase dashboard)
```

- Students never type an email or password. The phone remembers them.
- If a student clears browser data, uses incognito, or changes phone, they register again. Their
  registration number is already taken, so free the old record (see Admin guide).
- Nothing proves a student is who they claim. The protections are: you must have the QR token to
  register, staff watch the "Inside now" list, and each registration number is unique.

## Setup (all in the browser)

1. Supabase: create a project. In the SQL Editor run, in this order:
   - `makerspace_schema.sql`
   - `migrations/001_no_email_login.sql`
2. Supabase: Authentication, Sign In / Providers: turn ON "Allow anonymous sign-ins".
   Keep "Confirm email" ON (staff accounts are created by the dashboard with Auto Confirm).
3. Supabase: Authentication, Rate Limits: raise the limit for anonymous sign-ins (for example to 300 per hour).
   Students share the campus network address, so a rush of first-time registrations can hit the default.
4. Cloudflare Pages: connect this GitHub repo. Framework preset Vite, build command `npm run build`,
   output directory `dist`.
5. Cloudflare Pages: add environment variables (Settings, Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the public anon key; never use the service_role key)
6. Create the first admin (see below), log in at `/login`, open "Lab QR", print it.

## Admin guide

Create a staff account (admin or intern):

1. SQL Editor: `insert into public.allowed_emails(email) values ('person@example.com');`
2. Supabase: Authentication, Users, Add user, Create new user. Enter that email and a password
   and tick "Auto Confirm User".
3. SQL Editor: `update public.profiles set role = 'intern' where email = 'person@example.com';`
   (use `'admin'` for an admin)

Other tasks:

- Show/print the lab QR: log in as admin, open "Lab QR".
- Rotate the QR token if the code is leaked. Print the new code afterwards.
- A student is blocked as "already registered" (new phone): run
  `update public.profiles set reg_no = reg_no || ' (old)' where lower(reg_no) = lower('THEIR-REG-NO');`
  then they register again. Their old visit history stays on the old record.
- Reset a staff password: Supabase, Authentication, Users, open the user.
- Auto-close forgotten check-outs nightly: see the optional pg_cron block at the end of the schema file.

## Editing without installing anything

- Press `.` on the GitHub repo page to open the browser editor (github.dev), edit, commit.
- Cloudflare rebuilds automatically after each commit (about 1-2 minutes).
- For a live preview while editing, open the repo in GitHub Codespaces.

## Layout

```
migrations/           SQL changes, run in order after makerspace_schema.sql
src/
  main.jsx            entry
  App.jsx             routes
  AuthContext.jsx     session + profile
  supabaseClient.js   Supabase connection
  components/         Layout, route guards (Guards.jsx also creates the student account)
  pages/              Login (staff), Home, Profile, CheckIn
  pages/staff/        Inside (live list), QRPage (admin)
  lib/                small helpers
```
