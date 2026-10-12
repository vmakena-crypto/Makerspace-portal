import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { formatIST } from '../../lib/format'

export default function Inside() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('v_inside_now').select('*')
    if (error) setError(error.message)
    else {
      setError(null)
      setRows(data)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  async function checkout(id) {
    const { error } = await supabase.rpc('staff_checkout', { p_visit_id: id })
    if (error) setError(error.message)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Inside now</h1>
        <span className="text-sm text-slate-500">
          {rows ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : ''}
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-300 p-2 text-sm text-red-900">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Reg no</th>
              <th className="p-2">Branch</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Since</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td className="p-3 text-slate-500" colSpan={6}>Loading…</td></tr>
            )}
            {rows?.length === 0 && (
              <tr><td className="p-3 text-slate-500" colSpan={6}>Nobody is inside right now.</td></tr>
            )}
            {rows?.map((r) => (
              <tr key={r.visit_id} className="border-t border-slate-100">
                <td className="p-2">{r.full_name}</td>
                <td className="p-2">{r.reg_no}</td>
                <td className="p-2">{r.branch}</td>
                <td className="p-2">{r.phone}</td>
                <td className="p-2">{formatIST(r.checked_in_at)}</td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => checkout(r.visit_id)}
                    className="rounded-md bg-red-600 text-white px-3 py-1 text-xs"
                  >
                    Check out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Refreshes every 15 seconds.</p>
    </div>
  )
}
