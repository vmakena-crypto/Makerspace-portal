import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import { Card, ErrorBox, btn, btnGhost, input, useLoad } from '../../components/ui'

// Calls the manage-staff Edge Function (runs on Supabase, holds the secret key).
async function manage(body) {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body })
  if (error) {
    throw new Error(
      'Could not reach the staff manager. Is the "manage-staff" function deployed? (' + error.message + ')',
    )
  }
  if (!data?.ok) throw new Error(data?.error || 'Something went wrong.')
  return data
}

function makePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function Team() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useLoad(
    () =>
      supabase
        .from('profiles')
        .select('id,full_name,email,role,created_at')
        .in('role', ['intern', 'admin'])
        .order('role')
        .order('full_name'),
    [],
  )
  const [f, setF] = useState({ email: '', full_name: '', password: '', role: 'intern' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [listError, setListError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setFormError(null)
    setNotice(null)
    setBusy(true)
    try {
      const r = await manage({ action: 'upsert', ...f })
      setNotice(
        `${r.created ? 'Created' : 'Updated'} ${f.email.trim().toLowerCase()}. Give them this password now ` +
          `(it cannot be viewed later): ${f.password}`,
      )
      setF({ email: '', full_name: '', password: '', role: 'intern' })
      reload()
    } catch (err) {
      setFormError(err.message)
    }
    setBusy(false)
  }

  async function changeRole(p, role) {
    setListError(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) setListError(error.message)
    reload()
  }

  async function resetPassword(p) {
    const pw = window.prompt(`New password for ${p.email} (at least 8 characters):`, makePassword())
    if (!pw) return
    setListError(null)
    setNotice(null)
    try {
      await manage({ action: 'upsert', email: p.email, full_name: p.full_name, password: pw, role: p.role })
      setNotice(`Password for ${p.email} changed. Give it to them now: ${pw}`)
    } catch (err) {
      setListError(err.message)
    }
  }

  async function deactivate(p) {
    if (!window.confirm(`Deactivate ${p.full_name || p.email}? They will be signed out of staff access and blocked from logging in.`)) return
    setListError(null)
    try {
      await manage({ action: 'deactivate', user_id: p.id })
      reload()
    } catch (err) {
      setListError(err.message)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="text-sm text-slate-600">
        Interns and admins log in at /login with email and password. Students never appear here.
      </p>

      <Card>
        <form onSubmit={submit} className="space-y-2">
          <h2 className="font-semibold">Add a staff member (or reset by re-adding the same email)</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className={input} type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
            <input className={input} placeholder="Name (optional)" value={f.full_name} onChange={set('full_name')} />
            <div className="flex gap-2">
              <input
                className={input}
                placeholder="Password (min 8)"
                value={f.password}
                onChange={set('password')}
                required
              />
              <button type="button" className={btnGhost} onClick={() => setF({ ...f, password: makePassword() })}>
                Generate
              </button>
            </div>
            <select className={input} value={f.role} onChange={set('role')}>
              <option value="intern">Intern</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <ErrorBox error={formError} />
          <button className={btn} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      </Card>

      {notice && (
        <div className="rounded-md bg-green-50 border border-green-300 p-3 text-sm text-green-900 break-words">
          {notice}
        </div>
      )}
      <ErrorBox error={error || listError} />
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {data?.map((p) => {
          const self = p.id === user.id
          return (
            <div key={p.id} className="p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-medium text-sm">
                  {p.full_name || '(no name yet)'} {self && <span className="text-xs text-slate-400">you</span>}
                </div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </div>
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white"
                value={p.role}
                disabled={self}
                onChange={(e) => changeRole(p, e.target.value)}
              >
                <option value="intern">Intern</option>
                <option value="admin">Admin</option>
              </select>
              <button className={btnGhost} onClick={() => resetPassword(p)}>New password</button>
              {!self && <button className={btnGhost} onClick={() => deactivate(p)}>Deactivate</button>}
            </div>
          )
        })}
        {data?.length === 0 && <p className="p-3 text-sm text-slate-500">No staff yet.</p>}
      </div>
    </div>
  )
}
