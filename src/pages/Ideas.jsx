import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { Card, ErrorBox, StatusBadge, btn, input, useLoad } from '../components/ui'
import { formatIST } from '../lib/format'

const empty = { title: '', description: '', domain: '', team_members: '' }

// Students register an idea first. Components can only be requested against an idea.
export default function Ideas() {
  const { user, profile } = useAuth()
  const { data: ideas, error, loading, reload } = useLoad(
    () =>
      supabase.from('ideas').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    [user.id],
  )
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim() || form.description.trim().length < 20) {
      return setFormError('Give a title and describe the idea in at least 20 characters.')
    }
    setBusy(true)
    const { error } = await supabase.from('ideas').insert({
      owner_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      domain: form.domain.trim() || null,
      team_members: form.team_members.trim() || null,
    })
    setBusy(false)
    if (error) return setFormError(error.message)
    setForm(empty)
    reload()
  }

  const needsProfile = !profile?.profile_complete

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My ideas</h1>

      {needsProfile && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Complete your <Link to="/profile" className="underline">profile</Link> first so we know who the idea belongs to.
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-3">
          <h2 className="font-semibold">Register a new idea</h2>
          <label className="block text-sm">
            Title
            <input className={input} value={form.title} onChange={set('title')} />
          </label>
          <label className="block text-sm">
            What do you want to build, and why?
            <textarea
              rows={4}
              className={input}
              value={form.description}
              onChange={set('description')}
              placeholder="Problem, rough approach, what you expect to get at the end"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              Domain (optional)
              <input className={input} value={form.domain} onChange={set('domain')} placeholder="IoT, robotics, ..." />
            </label>
            <label className="block text-sm">
              Team members (optional)
              <input className={input} value={form.team_members} onChange={set('team_members')} placeholder="Names / reg nos" />
            </label>
          </div>
          <ErrorBox error={formError} />
          <button className={btn} disabled={busy || needsProfile}>
            {busy ? 'Saving…' : 'Submit idea'}
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        <ErrorBox error={error} />
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && ideas?.length === 0 && (
          <p className="text-sm text-slate-500">No ideas yet. Register one above, then you can request components.</p>
        )}
        {ideas?.map((i) => {
          const active = ['submitted', 'in_progress'].includes(i.status)
          return (
            <Card key={i.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{i.title}</h3>
                <StatusBadge status={i.status} />
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{i.description}</p>
              <p className="text-xs text-slate-500">
                {[i.domain, i.team_members && `Team: ${i.team_members}`, formatIST(i.created_at)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {active && (
                <Link to={`/requests/new?idea=${i.id}`} className="inline-block text-sm underline">
                  Request components for this idea
                </Link>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
