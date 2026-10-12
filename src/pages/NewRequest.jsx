import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { Card, ErrorBox, btn, input, useLoad } from '../components/ui'

export default function NewRequest() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ideas = useLoad(
    () =>
      supabase
        .from('ideas')
        .select('id,title')
        .eq('owner_id', user.id)
        .in('status', ['submitted', 'in_progress'])
        .order('created_at', { ascending: false }),
    [user.id],
  )
  const parts = useLoad(
    () =>
      supabase
        .from('components')
        .select('id,name,category,location,stock,is_consumable')
        .order('name'),
    [],
  )

  const [ideaId, setIdeaId] = useState(params.get('idea') || '')
  const [cart, setCart] = useState({}) // component_id -> qty
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (parts.data || []).filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        (c.category || '').toLowerCase().includes(needle),
    )
  }, [parts.data, q])

  const byId = useMemo(() => Object.fromEntries((parts.data || []).map((c) => [c.id, c])), [parts.data])
  const cartRows = Object.entries(cart)

  function setQty(c, value) {
    const n = Math.max(0, Math.min(c.stock, Number(value) || 0))
    const next = { ...cart }
    if (n === 0) delete next[c.id]
    else next[c.id] = n
    setCart(next)
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!ideaId) return setError('Choose the idea this request is for.')
    if (cartRows.length === 0) return setError('Add at least one component.')
    setBusy(true)
    const { error } = await supabase.rpc('create_request', {
      p_idea_id: ideaId,
      p_items: cartRows.map(([component_id, qty]) => ({ component_id, qty })),
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/requests', { replace: true })
  }

  if (ideas.loading || parts.loading) return <p className="text-sm text-slate-500">Loading…</p>

  if (!ideas.data?.length) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold">New request</h1>
        <ErrorBox error={ideas.error} />
        <p className="text-sm text-slate-700">
          You need an active idea before you can request components.{' '}
          <Link to="/ideas" className="underline">Register your idea</Link>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">New request</h1>

      <Card className="space-y-3">
        <label className="block text-sm">
          Which idea is this for?
          <select className={input} value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
            <option value="">Select an idea</option>
            {ideas.data.map((i) => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Note for staff (optional)
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Components</h2>
        <input
          className={input}
          placeholder="Search by name or category"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ErrorBox error={parts.error} />
        {parts.data?.length === 0 && (
          <p className="text-sm text-slate-500">The inventory is empty. Ask the lab staff.</p>
        )}
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {shown.map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {[c.category, c.stock > 0 ? `${c.stock} in stock` : 'Out of stock', c.is_consumable && 'not returned']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max={c.stock}
                disabled={c.stock === 0}
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={cart[c.id] || ''}
                placeholder="0"
                onChange={(e) => setQty(c, e.target.value)}
              />
            </li>
          ))}
        </ul>
      </Card>

      {cartRows.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-1">Your list</h2>
          <ul className="text-sm">
            {cartRows.map(([id, qty]) => (
              <li key={id}>{qty} × {byId[id]?.name}</li>
            ))}
          </ul>
        </Card>
      )}

      <ErrorBox error={error} />
      <button className={btn} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
    </form>
  )
}
