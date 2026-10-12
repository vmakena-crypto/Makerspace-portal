# Makerspace

Check-in / check-out for the lab, built on React + Vite + Tailwind, with Supabase as the backend.
Hosted free on Cloudflare Pages. No emails and no Google login.

## Status

- Done: QR check-in/out, one-time student registration, staff "inside now" list, admin QR page, staff password login,
  idea registration, component requests, staff request queue (approve, hand over, returns), inventory (admin add/bulk add/restock), idea pool
- Google Sheets mirror (migration 002 + `sheets/Code.gs`, syncs every 10 minutes)
- Projects page (admin: make a project from an idea, track status/dates/notes)
- Team page (admin adds/manages interns in the portal)
- Next: nothing planned; see Admin guide

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
   - `migrations/002_sheet_mirror.sql`
   - `migrations/003_sheet_projects.sql`
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

## Google Sheets mirror

- Supabase stays the database; the Sheet is a read-only copy refreshed every 10 minutes (up to 10 minutes behind).
- Tabs: Visits, Requests, Outstanding, Inventory, Ideas, Projects, Status.
- Setup: run `migrations/002_sheet_mirror.sql`; get the secret with
  `select value from public.settings where key = 'sheet_secret';`
  then in a new Google Sheet: Extensions, Apps Script, paste `sheets/Code.gs`, fill the 3 values, run `installTrigger` once.
- The Sheet contains names and phone numbers: keep it private (do not share it with a link).
- If the secret leaks: update `public.settings` set `sheet_secret` to a new value (SQL is at the bottom of migration 002) and paste it into the script.

## Admin guide

Create a staff account (admin or intern) from the portal: log in as admin, open **Team**, add the email, a password
and a role. This needs the `manage-staff` Edge Function deployed once (see below).

Deploy `manage-staff` once (browser only): Supabase, Edge Functions, Deploy a new function, Via Editor, name it
exactly `manage-staff`, paste `supabase/functions/manage-staff/index.ts`, Deploy. If Team shows "Invalid JWT",
open the function's settings and turn OFF "Verify JWT" (the function checks the login itself).

Manual fallback (SQL + dashboard):

1. SQL Editor: `insert into public.allowed_emails(email) values ('person@example.com');`
2. Supabase: Authentication, Users, Add user, Create new user. Enter that email and a password
   and tick "Auto Confirm User".
3. SQL Editor: `update public.profiles set role = 'intern' where email = 'person@example.com';`
   (use `'admin'` for an admin)

Other tasks:

- Load the lab's existing stock in one go: run `import_inventory.sql` in the SQL Editor (safe to run twice).
  Then check the Consumable ticks in Inventory (consumables are never returned).
- Stock the lab first: Inventory, "Bulk add" (one component per line). Students can only request what is listed.
- Request flow: student registers an idea, requests parts; staff open Queue: Approve, then "Hand over items"
  (stock drops), later "Returned" per item. Consumables are never returned.
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
sheets/Code.gs        Google Apps Script that fills the Sheet
supabase/functions/   Edge Function used by the Team page
src/
  main.jsx            entry
  App.jsx             routes
  AuthContext.jsx     session + profile
  supabaseClient.js   Supabase connection
  components/         Layout, ui helpers, route guards (Guards.jsx also creates the student account)
  pages/              Login (staff), Home, Profile, CheckIn, Ideas, Requests, NewRequest
  pages/staff/        Inside, Queue, Inventory, IdeaPool, Projects, Team (admin), QRPage (admin)
  lib/                small helpers
```
