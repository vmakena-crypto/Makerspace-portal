import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../AuthContext'
import { Card, ErrorBox, btn, btnGhost, input, useLoad } from '../../components/ui'

const blank = { name: '', category: '', part_no: '', location: '', stock: 0, min_stock: 0, is_consumable: false }

export default function Inventory() {
  const { profile } = useAuth()
  const admin = profile?.role === 'admin'
  const { data, error, loading, reload } = useLoad(
    () => supabase.from('components').select('*').order('name'),
    [],
  )
  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [message, setMessage] = useState(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data || []).filter(
      (c) =>
        (!needle ||
          c.name.toLowerCase().includes(needle) ||
          (c.category || '').toLowerCase().includes(needle) ||
          (c.location || '').toLowerCase().includes(needle)) &&
        (!lowOnly || c.stock <= c.min_stock),
    )
  }, [data, q, lowOnly])

  const lowCount = (data || []).filter((c) => c.stock <= c.min_stock).length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inventory</h1>
      <ErrorBox error={error || actionError} />
      {message && <div className="rounded-md bg-green-50 border border-green-300 p-2 text-sm text-green-900">{message}</div>}

      {admin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <AddOne onDone={reload} setError={setActionError} setMessage={setMessage} />
          <BulkAdd onDone={reload} setError={setActionError} setMessage={setMessage} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input className={input + ' max-w-xs'} placeholder="Search name, category, shelf" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only ({lowCount})
        </label>
        <span className="text-sm text-slate-500 ml-auto">{rows.length} items</span>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Category</th>
              <th className="p-2">Shelf</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Min</th>
              {admin && <th className="p-2" title="Consumables are never returned">Consumable</th>}
              {admin && <th className="p-2">Adjust</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <Row key={c.id} c={c} admin={admin} reload={reload} setError={setActionError} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Row({ c, admin, reload, setError }) {
  const [delta, setDelta] = useState('')
  const [busy, setBusy] = useState(false)
  const low = c.stock <= c.min_stock

  async function adjust(sign) {
    const n = Number(delta)
    if (!n || n < 0) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('adjust_stock', {
      p_component_id: c.id,
      p_delta: sign * n,
      p_reason: sign > 0 ? 'restock' : 'correction',
    })
    setBusy(false)
    if (error) setError(error.message)
    else setDelta('')
    reload()
  }

  async function toggleConsumable(value) {
    setError(null)
    const { error } = await supabase.from('components').update({ is_consumable: value }).eq('id', c.id)
    if (error) setError(error.message)
    reload()
  }

  return (
    <tr className={low ? 'bg-red-50' : ''}>
      <td className="p-2">
        {c.name}
      </td>
      <td className="p-2 text-slate-600">{c.category}</td>
      <td className="p-2 text-slate-600">{c.location}</td>
      <td className={`p-2 text-right font-medium ${low ? 'text-red-700' : ''}`}>{c.stock}</td>
      <td className="p-2 text-right text-slate-500">{c.min_stock}</td>
      {admin && (
        <td className="p-2 text-center">
          <input type="checkbox" checked={c.is_consumable} onChange={(e) => toggleConsumable(e.target.checked)} />
        </td>
      )}
      {admin && (
        <td className="p-2">
          <span className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              className="w-16 rounded-md border border-slate-300 px-2 py-1"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
            <button className={btnGhost} disabled={busy} onClick={() => adjust(1)}>+</button>
            <button className={btnGhost} disabled={busy} onClick={() => adjust(-1)}>−</button>
          </span>
        </td>
      )}
    </tr>
  )
}

function AddOne({ onDone, setError, setMessage }) {
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!f.name.trim()) return setError('Name is required.')
    setBusy(true)
    const { error } = await supabase.from('components').insert({
      name: f.name.trim(),
      category: f.category.trim() || null,
      part_no: f.part_no.trim() || null,
      location: f.location.trim() || null,
      stock: Math.max(0, Number(f.stock) || 0),
      min_stock: Math.max(0, Number(f.min_stock) || 0),
      is_consumable: f.is_consumable,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setMessage(`Added ${f.name.trim()}.`)
    setF(blank)
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-2">
        <h2 className="font-semibold">Add one component</h2>
        <input className={input} placeholder="Name" value={f.name} onChange={set('name')} />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Category" value={f.category} onChange={set('category')} />
          <input className={input} placeholder="Shelf / bin" value={f.location} onChange={set('location')} />
          <input className={input} placeholder="Part no (optional)" value={f.part_no} onChange={set('part_no')} />
          <input className={input} type="number" min="0" placeholder="Stock" value={f.stock} onChange={set('stock')} />
          <input className={input} type="number" min="0" placeholder="Low-stock alert at" value={f.min_stock} onChange={set('min_stock')} />
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={f.is_consumable} onChange={(e) => setF({ ...f, is_consumable: e.target.checked })} />
          Consumable (resistors, wire; never returned)
        </label>
        <button className={btn} disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
      </form>
    </Card>
  )
}

// One component per line: name, category, stock, shelf, min stock, consumable (yes/no)
function BulkAdd({ onDone, setError, setMessage }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const rows = []
    for (const [n, line] of text.split('\n').entries()) {
      if (!line.trim()) continue
      const [name, category, stock, location, min, cons] = line.split(',').map((s) => s.trim())
      if (!name) return setError(`Line ${n + 1}: name is missing.`)
      if (stock && Number.isNaN(Number(stock))) return setError(`Line ${n + 1}: stock must be a number.`)
      rows.push({
        name,
        category: category || null,
        stock: Math.max(0, Number(stock) || 0),
        location: location || null,
        min_stock: Math.max(0, Number(min) || 0),
        is_consumable: /^(y|yes|true|1)$/i.test(cons || ''),
      })
    }
    if (rows.length === 0) return setError('Paste at least one line.')
    setBusy(true)
    const { error } = await supabase.from('components').insert(rows)
    setBusy(false)
    if (error) return setError(error.message)
    setMessage(`Added ${rows.length} components.`)
    setText('')
    onDone()
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-2">
        <h2 className="font-semibold">Bulk add</h2>
        <p className="text-xs text-slate-500">
          One per line: name, category, stock, shelf, low-stock alert, consumable (yes/no). Do not use commas inside a field.
        </p>
        <textarea
          rows={6}
          className={input + ' font-mono'}
          placeholder={'Arduino Uno, Microcontroller, 10, A1, 3, no\n10k resistor, Passive, 200, B2, 50, yes'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className={btn} disabled={busy}>{busy ? 'Adding…' : 'Add all'}</button>
      </form>
    </Card>
  )
}
