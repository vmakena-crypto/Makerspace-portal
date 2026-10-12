import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext'

const link = ({ isActive }) =>
  'px-3 py-1.5 rounded-md text-sm ' +
  (isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200')

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const staff = profile && ['intern', 'admin'].includes(profile.role)
  const admin = profile?.role === 'admin'
  // Students are anonymous accounts: signing out would make the phone forget them,
  // so only staff accounts get a sign-out button.
  const canSignOut = user && !user.is_anonymous

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="font-bold mr-4">Makerspace</span>
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/ideas" className={link}>Ideas</NavLink>
          <NavLink to="/requests" className={link}>Requests</NavLink>
          <NavLink to="/profile" className={link}>Profile</NavLink>
          {staff && <span className="hidden sm:inline text-slate-300 px-1">|</span>}
          {staff && <NavLink to="/staff/inside" className={link}>Inside now</NavLink>}
          {staff && <NavLink to="/staff/queue" className={link}>Queue</NavLink>}
          {staff && <NavLink to="/staff/inventory" className={link}>Inventory</NavLink>}
          {staff && <NavLink to="/staff/ideas" className={link}>Idea pool</NavLink>}
          {staff && <NavLink to="/staff/projects" className={link}>Projects</NavLink>}
          {admin && <NavLink to="/staff/qr" className={link}>Lab QR</NavLink>}
          <span className="ml-auto text-xs text-slate-500 hidden sm:inline">
            {profile?.full_name || user?.email}
          </span>
          {canSignOut && (
            <button onClick={signOut} className="text-sm underline text-slate-700">Sign out</button>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
