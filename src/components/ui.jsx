import { useCallback, useEffect, useState } from 'react'

export const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white'
export const btn =
  'rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50'
export const btnGhost =
  'rounded-lg border border-slate-300 bg-white text-slate-800 px-3 py-1.5 text-sm disabled:opacity-50'

// Runs a Supabase query (a function returning { data, error }) and keeps the result.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const { data, error } = await fn()
    setState({ data, error: error ? error.message : null, loading: false })
  }, deps)
  useEffect(() => {
    run()
  }, [run])
  return { ...state, reload: run }
}

export function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div className="rounded-md bg-red-50 border border-red-300 p-2 text-sm text-red-900">{error}</div>
  )
}

const tone = {
  submitted: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  dropped: 'bg-slate-200 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  issued: 'bg-purple-100 text-purple-800',
  closed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone[status] || 'bg-slate-100'}`}
    >
      {String(status).replace('_', ' ')}
    </span>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>{children}</div>
}
