import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { Card, ErrorBox, StatusBadge, btn, btnGhost, input, useLoad } from '../../components/ui'
import { formatIST } from '../../lib/format'

const SELECT =
  'id,status,note,review_note,created_at,issued_at, ideas(title), profiles!requester_id(full_name,reg_no,phone), request_items(id,qty,qty_issued,qty_returned, components(name,stock,is_consumable))'

const TABS = [
  { key: 'pending', label: 'To review' },
  { key: 'approved', label: 'To hand over' },
  { key: 'issued', label: 'Out with students' },
  { key: 'history', label: 'History' },
]

export default function Queue() {
  const [tab, setTab] = useState('pending')
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const active = useLoad(
    () =>
      supabase
        .from('requests')
        .select(SELECT)
        .in('status', ['pending', 'approved', 'issued'])
        .order('created_at'),
    [],
  )
  const history = useLoad(
    () =>
      tab === 'history'
        ? supabase
            .from('requests')
            .select(SELECT)
            .in('status', ['closed', 'rejected', 'cancelled'])
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    [tab],
  )

  // Several staff may work at the same time: refresh every 20 seconds.
  useEffect(() => {
    const t = setInterval(() => active.reload(), 20000)
    return () => clearInterval(t)
  }, [active.reload])

  async function act(id, fn) {
    setActionError(null)
    setBusyId(id)
    const { error } = await fn()
    setBusyId(null)
    if (error) setActionError(error.message)
    active.reload()
    history.reload()
  }

  const rows = tab === 'history' ? history.data : (active.data || []).filter((r) => r.status === tab)
  const count = (k) => (active.data || []).filter((r) => r.status === k).length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Request queue</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-sm ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
            }`}
          >
            {t.label}
            {t.key !== 'history' && ` (${count(t.key)})`}
          </button>
        ))}
      </div>
      <ErrorBox error={active.error || history.error || actionError} />
      {(active.loading || (tab === 'history' && history.loading)) && (
        <p className="text-sm text-slate-500">Loading…</p>
      )}
      {rows && rows.length === 0 && <p className="text-sm text-slate-500">Nothing here.</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {rows?.map((r) => (
          <RequestCard key={r.id} r={r} busy={busyId === r.id} act={act} />
        ))}
      </div>
    </div>
  )
}

function RequestCard({ r, busy, act }) {
  const [note, setNote] = useState('')
  const [qty, setQty] = useState({}) // request_item_id -> qty to return

  const notEnough = r.request_items.some((it) => it.qty > (it.components?.stock ?? 0) && it.qty_issued === 0)

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{r.profiles?.full_name}</div>
          <div className="text-xs text-slate-500">
            {r.profiles?.reg_no} · {r.profiles?.phone} · {formatIST(r.created_at)}
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <p className="text-sm">Idea: <b>{r.ideas?.title}</b></p>
      {r.note && <p className="text-xs text-slate-500">Student note: {r.note}</p>}
      {r.review_note && <p className="text-xs text-slate-500">Staff note: {r.review_note}</p>}

      <ul className="text-sm divide-y divide-slate-100">
        {r.request_items.map((it) => {
          const outstanding = it.qty_issued - it.qty_returned
          const consumable = it.components?.is_consumable
          const short = it.qty_issued === 0 && it.qty > (it.components?.stock ?? 0)
          return (
            <li key={it.id} className="py-1.5 flex items-center justify-between gap-2">
              <span>
                {it.components?.name} × {it.qty}
                {short && <span className="text-red-700"> (only {it.components?.stock} in stock)</span>}
                {consumable && <span className="text-slate-400"> consumable</span>}
              </span>
              {r.status === 'issued' && !consumable && (
                outstanding > 0 ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max={outstanding}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={qty[it.id] ?? outstanding}
                      onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
                    />
                    <button
                      className={btnGhost}
                      disabled={busy}
                      onClick={() =>
                        act(r.id, () =>
                          supabase.rpc('return_item', {
                            p_request_item_id: it.id,
                            p_qty: Number(qty[it.id] ?? outstanding),
                          }),
                        )
                      }
                    >
                      Returned
                    </button>
                  </span>
                ) : (
                  <span className="text-xs text-green-700">returned</span>
                )
              )}
            </li>
          )
        })}
      </ul>

      {r.status === 'pending' && (
        <div className="space-y-2">
          <input
            className={input}
            placeholder="Note to student (optional, shown on reject)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={btn}
              disabled={busy}
              onClick={() =>
                act(r.id, () =>
                  supabase.rpc('review_request', { p_request_id: r.id, p_approve: true, p_note: note.trim() || null }),
                )
              }
            >
              Approve
            </button>
            <button
              className={btnGhost}
              disabled={busy}
              onClick={() =>
                act(r.id, () =>
                  supabase.rpc('review_request', { p_request_id: r.id, p_approve: false, p_note: note.trim() || null }),
                )
              }
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {r.status === 'approved' && (
        <button
          className={btn}
          disabled={busy || notEnough}
          onClick={() => act(r.id, () => supabase.rpc('issue_request', { p_request_id: r.id }))}
        >
          {notEnough ? 'Not enough stock' : 'Hand over items'}
        </button>
      )}
    </Card>
  )
}
