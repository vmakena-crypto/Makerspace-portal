import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { rememberPath } from '../lib/afterLogin'

export function Splash() {
  return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!user) {
    rememberPath(loc.pathname + loc.search)
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
