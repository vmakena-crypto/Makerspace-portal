import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { Card, ErrorBox, StatusBadge, btnGhost, useLoad } from '../components/ui'
import { formatIST } from '../lib/format'

export default function Requests() {
  const { user } = useAuth()
  const [actionError, setActionError] = useState(null)
  const { data, error, loading, reload } = useLoad(
    () =>
      supabase
        .from('requests')
        .select(
          'id,status,note,review_note,created_at,issued_at, ideas(title), request_items(id,qty,qty_issued,qty_returned, components(name,is_consumable))',
        )
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false }),
    [user.id],
  )

  async function cancel(id) {
    setActionError(null)
    const { error } = await supabase.rpc('cancel_request', { p_request_id: id })
    if (error) setActionError(error.message)
    reload()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My requests</h1>
        <Link to="/requests/new" className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium">
          New request
        </Link>
      </div>
      <ErrorBox error={error || actionError} />
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && data?.length === 0 && (
        <p className="text-sm text-slate-500">
          No requests yet. Register an <Link to="/ideas" className="underline">idea</Link> first, then request components.
        </p>
      )}
      {data?.map((r) => (
        <Card key={r.id} className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{r.ideas?.title}</h3>
              <p className="text-xs text-slate-500">{formatIST(r.created_at)}</p>
            </div>
            <StatusBadge status={r.status} />
          </div>
          <ul className="text-sm divide-y divide-slate-100">
            {r.request_items.map((it) => (
              <li key={it.id} className="py-1 flex justify-between gap-3">
                <span>{it.components?.name}</span>
                <span className="text-slate-600 whitespace-nowrap">
                  {it.qty_issued > 0
                    ? it.components?.is_consumable
                      ? `${it.qty_issued} given`
                      : `${it.qty_issued} given, ${it.qty_returned} returned`
                    : `× ${it.qty}`}
                </span>
              </li>
            ))}
          </ul>
          {r.note && <p className="text-xs text-slate-500">Your note: {r.note}</p>}
          {r.review_note && <p className="text-sm text-slate-700">Staff note: {r.review_note}</p>}
          {r.status === 'approved' && (
            <p className="text-sm text-blue-800">Approved. Collect it from the lab staff.</p>
          )}
          {r.status === 'issued' && (
            <p className="text-sm text-purple-800">Please return the borrowed items when you are done.</p>
          )}
          {r.status === 'pending' && (
            <button className={btnGhost} onClick={() => cancel(r.id)}>Cancel request</button>
          )}
        </Card>
      ))}
    </div>
  )
}
