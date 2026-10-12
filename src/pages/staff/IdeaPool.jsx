import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import { Card, ErrorBox, StatusBadge, btnGhost, input, useLoad } from '../../components/ui'
import { formatIST } from '../../lib/format'

const STATUSES = ['submitted', 'in_progress', 'completed', 'dropped']

export default function IdeaPool() {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const [filter, setFilter] = useState('')
  const [q, setQ] = useState('')
  const [actionError, setActionError] = useState(null)
  const { data, error, loading, reload } = useLoad(
    () =>
      supabase
        .from('ideas')
        .select('id,owner_id,title,description,domain,team_members,status,created_at, profiles!owner_id(full_name,reg_no,branch)')
        .order('created_at', { ascending: false }),
    [],
  )

  const projects = useLoad(() => supabase.from('projects').select('idea_id'), [])
  const hasProject = new Set((projects.data || []).map((x) => x.idea_id))

  async function makeProject(i) {
    setActionError(null)
    const { error } = await supabase.from('projects').insert({
      idea_id: i.id,
      name: i.title,
      description: i.description,
      lead_id: i.owner_id,
      status: 'planned',
    })
    if (error) return setActionError(error.message)
    await supabase.from('ideas').update({ status: 'in_progress' }).eq('id', i.id)
    projects.reload()
    reload()
  }

  async function setStatus(id, status) {
    setActionError(null)
    const { error } = await supabase.from('ideas').update({ status }).eq('id', id)
    if (error) setActionError(error.message)
    reload()
  }

  const needle = q.trim().toLowerCase()
  const rows = (data || []).filter(
    (i) =>
      (!filter || i.status === filter) &&
      (!needle ||
        i.title.toLowerCase().includes(needle) ||
        (i.domain || '').toLowerCase().includes(needle) ||
        (i.profiles?.full_name || '').toLowerCase().includes(needle)),
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Idea pool</h1>
      <div className="flex flex-wrap gap-3">
        <input className={input + ' max-w-xs'} placeholder="Search title, domain, student" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input + ' max-w-[10rem]'} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500 self-center ml-auto">{rows.length} ideas</span>
      </div>
      <ErrorBox error={error || actionError} />
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((i) => (
          <Card key={i.id} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{i.title}</h3>
              <StatusBadge status={i.status} />
            </div>
            <p className="text-xs text-slate-500">
              {i.profiles?.full_name} · {i.profiles?.reg_no} · {i.profiles?.branch} · {formatIST(i.created_at)}
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{i.description}</p>
            {(i.domain || i.team_members) && (
              <p className="text-xs text-slate-500">
                {[i.domain, i.team_members && `Team: ${i.team_members}`].filter(Boolean).join(' · ')}
              </p>
            )}
            <label className="text-xs text-slate-500 flex items-center gap-2">
              Status
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white"
                value={i.status}
                onChange={(e) => setStatus(i.id, e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            {admin && (
              hasProject.has(i.id) ? (
                <p className="text-xs text-green-700">Already a project</p>
              ) : (
                <button className={btnGhost} onClick={() => makeProject(i)}>Make project</button>
              )
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
