import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { consumePath } from '../lib/afterLogin'

const empty = { full_name: '', reg_no: '', branch: '', year: '', phone: '' }

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        reg_no: profile.reg_no || '',
        branch: profile.branch || '',
        year: profile.year || '',
        phone: profile.phone || '',
      })
    }
  }, [profile])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!form.full_name.trim() || !form.reg_no.trim()) {
      return setError('Name and registration number are required.')
    }
    if (form.phone.replace(/\D/g, '').length < 10) {
      return setError('Enter a valid phone number (at least 10 digits).')
    }
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        reg_no: form.reg_no.trim(),
        branch: form.branch.trim(),
        year: form.year,
        phone: form.phone.trim(),
      })
      .eq('id', user.id)
    setBusy(false)
    if (error) return setError(error.message)
    await refreshProfile()
    navigate(consumePath() || '/', { replace: true })
  }

  const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white'

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Your profile</h1>
      <p className="text-sm text-slate-600">You only fill this in once.</p>

      <form onSubmit={submit} className="space-y-3 bg-white rounded-lg border border-slate-200 p-4">
        <label className="block text-sm">
          Full name
          <input className={input} value={form.full_name} onChange={set('full_name')} />
        </label>
        <label className="block text-sm">
          Registration number
          <input className={input} value={form.reg_no} onChange={set('reg_no')} />
        </label>
        <label className="block text-sm">
          Branch / department
          <input className={input} value={form.branch} onChange={set('branch')} />
        </label>
        <label className="block text-sm">
          Year
          <select className={input} value={form.year} onChange={set('year')}>
            <option value="">Select</option>
            <option>1</option>
            <option>2</option>
            <option>3</option>
            <option>4</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-sm">
          Phone number
          <input className={input} inputMode="tel" value={form.phone} onChange={set('phone')} />
        </label>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 p-2 text-sm text-red-900">{error}</div>
        )}

        <button
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
