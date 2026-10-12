// Supabase Edge Function: manage-staff
// Lets an ADMIN (logged in to the portal) create staff accounts, reset passwords and deactivate people.
// It runs on Supabase's servers, so the secret service key never reaches the browser.
//
// Deploy: Supabase dashboard -> Edge Functions -> Deploy a new function -> Via Editor
//         name it exactly: manage-staff   (paste this file, Deploy)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (error: string) => reply({ ok: false, error })

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // 1. Who is calling? Must be a signed-in admin.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: auth, error: authError } = await admin.auth.getUser(jwt)
    if (authError || !auth?.user) return fail('You are not signed in.')
    const callerId = auth.user.id
    const { data: me } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle()
    if (me?.role !== 'admin') return fail('Admins only.')

    const body = await req.json().catch(() => ({}))

    // 2. Create a staff account, or update an existing one (also re-activates and resets the password)
    if (body.action === 'upsert') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const role = body.role
      const fullName = String(body.full_name || '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email.')
      if (password.length < 8) return fail('Password must be at least 8 characters.')
      if (role !== 'intern' && role !== 'admin') return fail('Role must be intern or admin.')

      // the sign-up trigger only accepts approved emails
      const approve = await admin.from('allowed_emails').upsert({ email }, { onConflict: 'email' })
      if (approve.error) return fail(approve.error.message)

      const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
      let userId: string
      if (existing) {
        userId = existing.id
        if (userId === callerId && role !== 'admin') return fail('You cannot remove your own admin role.')
        const upd = await admin.auth.admin.updateUserById(userId, {
          password,
          ban_duration: 'none',
          email_confirm: true,
        })
        if (upd.error) return fail(upd.error.message)
      } else {
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })
        if (created.error || !created.data?.user) return fail(created.error?.message || 'Could not create the user.')
        userId = created.data.user.id
      }

      const patch: Record<string, string> = { role }
      if (fullName) patch.full_name = fullName
      const prof = await admin.from('profiles').update(patch).eq('id', userId)
      if (prof.error) return fail(prof.error.message)
      return reply({ ok: true, created: !existing, id: userId })
    }

    // 3. Deactivate: back to student and block the login
    if (body.action === 'deactivate') {
      const userId = String(body.user_id || '')
      if (!userId) return fail('Missing user.')
      if (userId === callerId) return fail('You cannot deactivate yourself.')
      const ban = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      if (ban.error) return fail(ban.error.message)
      const prof = await admin.from('profiles').update({ role: 'student' }).eq('id', userId)
      if (prof.error) return fail(prof.error.message)
      return reply({ ok: true })
    }

    return fail('Unknown action.')
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error.')
  }
}

Deno.serve(handle)
