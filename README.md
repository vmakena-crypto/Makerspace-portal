# Makerspace

Check-in / check-out for the lab, built on React + Vite + Tailwind, with Supabase as the backend.
Hosted free on Cloudflare Pages.

## Status

- Done: Google login, one-time profile, QR check-in/out, staff "inside now" list, admin QR page
- Next: ideas, component requests, inventory, projects, Google Sheets mirror

## Setup (all in the browser)

1. Supabase: create a project, then run `makerspace_schema.sql` in the SQL Editor.
2. Supabase: Authentication, Providers, Google: enable it with a Google Cloud OAuth client.
3. Supabase: Authentication, URL Configuration:
   - Site URL: your Cloudflare Pages address
   - Redirect URLs: add `https://YOUR-SITE.pages.dev/**` (and `http://localhost:5173/**` if you ever run it locally)
4. Cloudflare Pages: connect this GitHub repo. Framework preset Vite, build command `npm run build`,
   output directory `dist`.
5. Cloudflare Pages: add environment variables (Settings, Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the public anon key; never use the service_role key)
6. Log in once, then make yourself admin in the Supabase SQL Editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`

## Admin guide

- Show/print the lab QR: sign in as admin, open "Lab QR".
- Rotate the QR token if the code is leaked. Print the new code afterwards.
- Make someone an intern: `update public.profiles set role = 'intern' where email = '...';`
- Allow a non-college email to sign up: `insert into public.allowed_emails(email) values ('...');`
- Auto-close forgotten check-outs nightly: see the optional pg_cron block at the end of the schema file.

## Editing without installing anything

- Press `.` on the GitHub repo page to open the browser editor (github.dev), edit, commit.
- Cloudflare rebuilds automatically after each commit (about 1-2 minutes).
- For a live preview while editing, open the repo in GitHub Codespaces.

## Layout

```
src/
  main.jsx            entry
  App.jsx             routes
  AuthContext.jsx     session + profile
  supabaseClient.js   Supabase connection
  components/         Layout, route guards
  pages/              Login, Home, Profile, CheckIn
  pages/staff/        Inside (live list), QRPage (admin)
  lib/                small helpers
```
