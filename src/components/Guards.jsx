import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { rememberPath } from '../lib/afterLogin'

export function Splash({ text = 'Loading…' }) {
  return <div className="min-h-screen grid place-items-center text-slate-500">{text}</div>
}

function friendlyStart(message = '') {
  if (/database error|invalid lab/i.test(message)) {
    return 'This QR code is not valid any more. Scan the current code at the lab entrance.'
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Many people are signing up at once. Wait a minute and scan again.'
  }
  if (/anonymous/i.test(message)) {
    return 'Anonymous sign-ins are turned off in Supabase. Tell the lab admin.'
  }
  return 'Something went wrong. Try scanning again.'
}

// First scan on a new phone: create the anonymous account using the QR token.
function AutoStart({ token }) {
  const started = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    supabase.auth
      .signInAnonymously({ options: { data: { lab_token: token } } })
      .then(({ error }) => {
        if (error) setError(error.message)
      })
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-sm rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 space-y-2 text-sm">
          <p className="font-medium">We could not set up your check-in.</p>
          <p>{friendlyStart(error)}</p>
          <p className="text-xs opacity-70">Details: {error}</p>
        </div>
      </div>
    )
  }
  return <Splash text="Setting up…" />
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!user) {
    const token = loc.pathname === '/checkin' ? new URLSearchParams(loc.search).get('t') : null
    if (token) return <AutoStart token={token} />
    rememberPath(loc.pathname + loc.search) // staff come back here after logging in
    return <Navigate to="/login" replace />
  }
  return children
}

export function RequireRole({ roles, children }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
        You do not have access to this page.
      </div>
    )
  }
  return children
}
