import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { rememberPath } from '../lib/afterLogin'
import { formatIST } from '../lib/format'

export default function CheckIn() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('t')
  const navigate = useNavigate()
  const loc = useLocation()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_visit_status')
    if (error) setMsg({ type: 'error', text: error.message })
    else setStatus(data)
  }, [])

  useEffect(() => {
    if (profile && !profile.profile_complete) {
      rememberPath(loc.pathname + loc.search)
      navigate('/profile', { replace: true })
      return
    }
    loadStatus()
  }, [profile, loc.pathname, loc.search, navigate, loadStatus])

  async function act() {
    setBusy(true)
    setMsg(null)
    const { data, error } = await supabase.rpc('toggle_visit', { p_token: token })
    setBusy(false)
    if (error) return setMsg({ type: 'error', text: error.message })
    setMsg({
      type: 'ok',
      text: data.action === 'checked_in' ? 'You are checked in. Enjoy the lab!' : 'You are checked out. See you soon!',
    })
    loadStatus()
  }

  if (!token) {
    return (
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-4">
        Scan the QR code at the lab entrance to check in or out.
      </div>
    )
  }

  const inside = status?.inside

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Lab check-in</h1>

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 text-center">
        {status === null ? (
          <p className="text-slate-500">Checking your status…</p>
        ) : (
          <>
            <p className="text-lg">
              {inside ? (
                <>You are <span className="font-semibold text-green-700">inside</span> since {formatIST(status.since)}</>
              ) : (
                <>You are <span className="font-semibold text-slate-700">outside</span></>
              )}
            </p>
            <button
              onClick={act}
              disabled={busy}
              className={
                'w-full rounded-lg py-3 font-medium text-white disabled:opacity-50 ' +
                (inside ? 'bg-red-600' : 'bg-green-600')
              }
            >
              {busy ? 'Please wait…' : inside ? 'Check out' : 'Check in'}
            </button>
          </>
        )}
      </div>

      {msg && (
        <div
          className={
            'rounded-md border p-3 text-sm ' +
            (msg.type === 'ok'
              ? 'bg-green-50 border-green-300 text-green-900'
              : 'bg-red-50 border-red-300 text-red-900')
          }
        >
          {msg.text}
        </div>
      )}
    </div>
  )
}
