import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import { Card, ErrorBox, StatusBadge, btn, input, useLoad } from '../../components/ui'

const STATUSES = ['planned', 'active', 'on_hold', 'completed', 'cancelled']
// Keep the linked idea in step with the project.
const IDEA_STATUS = { active: 'in_progress', completed: 'completed', cancelled: 'dropped' }

export default function Projects() {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [filter, setFilter] = useState('')
  const [actionError, setActionError] = useState(null)
  const { data, error, loading, reload } = useLoad(
    () =>
      supabase
        .from('projects')
        .select(
          'id,name,description,status,start_date,end_date,notes,idea_id,created_at, ideas(title), profiles!lead_id(full_name,reg_no,phone)',
        )
        .order('created_at', { ascending: false }),
    [],
  )

  const rows = (data || []).filter((p) => !filter || p.status === filter)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="text-sm text-slate-600">
        {admin
          ? 'Turn an idea into a project from the Idea pool ("Make project"), or add one here.'
          : 'Read only. Admins manage projects.'}
      </p>

      {admin && <NewProject onDone={reload} setError={setActionError} />}

      <div className="flex flex-wrap gap-3 items-center">
        <select className={input + ' max-w-[10rem]'} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500 ml-auto">{rows.length} projects</span>
      </div>

      <ErrorBox error={error || actionError} />
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No projects yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((p) => (
          <ProjectCard key={p.id} p={p} admin={admin} reload={reload} setError={setActionError} />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ p, admin, reload, setError }) {
  const [f, setF] = useState({
    status: p.status,
    start_date: p.start_date || '',
    end_date: p.end_date || '',
    notes: p.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const dirty =
    f.status !== p.status ||
    f.start_date !== (p.start_date || '') ||
    f.end_date !== (p.end_date || '') ||
    f.notes !== (p.notes || '')

  async function save() {
    setError(null)
    setBusy(true)
    const { error } = await supabase
      .from('projects')
      .update({
        status: f.status,
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        notes: f.notes.trim() || null,
      })
      .eq('id', p.id)
    if (!error && p.idea_id && f.status !== p.status && IDEA_STATUS[f.status]) {
      const r = await supabase.from('ideas').update({ status: IDEA_STATUS[f.status] }).eq('id', p.idea_id)
      if (r.error) setError(r.error.message)
    }
    setBusy(false)
    if (error) setError(error.message)
    reload()
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{p.name}</h3>
        <StatusBadge status={p.status} />
      </div>
      <p className="text-xs text-slate-500">
        {p.profiles ? `Lead: ${p.profiles.full_name} (${p.profiles.reg_no})` : 'No lead set'}
        {p.ideas?.title && ` · Idea: ${p.ideas.title}`}
      </p>
      {p.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.description}</p>}

      {admin ? (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-slate-500">
              Status
              <select
                className={input}
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Start
              <input type="date" className={input} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
            </label>
            <label className="text-xs text-slate-500">
              End
              <input type="date" className={input} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
            </label>
          </div>
          <textarea
            rows={2}
            className={input}
            placeholder="Notes"
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
          <button className={btn} disabled={!dirty || busy} onClick={save}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {[p.start_date && `Start ${p.start_date}`, p.end_date && `End ${p.end_date}`].filter(Boolean).join(' · ')}
          {p.notes && ` · ${p.notes}`}
        </p>
      )}
    </Card>
  )
}

function NewProject({ onDone, setError }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Project name is required.')
    setBusy(true)
    const { error } = await supabase
      .from('projects')
      .insert({ name: name.trim(), description: description.trim() || null })
    setBusy(false)
    if (error) return setError(error.message)
    setName('')
    setDescription('')
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-2">
        <h2 className="font-semibold">New project (not from an idea)</h2>
        <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea rows={2} className={input} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className={btn} disabled={busy}>{busy ? 'Adding…' : 'Add project'}</button>
      </form>
    </Card>
  )
}
