import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Home() {
  const { profile } = useAuth()
  const staff = profile && ['intern', 'admin'].includes(profile.role)
  const admin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi {profile?.full_name || 'there'}</h1>
        <p className="text-sm text-slate-500 capitalize">Role: {profile?.role}</p>
      </div>

      {!profile?.profile_complete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 space-y-2">
          <p className="font-medium">Complete your profile once, then check-in is one tap.</p>
          <Link to="/profile" className="inline-block underline">Complete profile</Link>
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <h2 className="font-semibold">How to check in and out</h2>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Scan the QR code at the lab entrance with your phone camera.</li>
          <li>Tap the button on the page that opens.</li>
          <li>Scan the same QR again when you leave.</li>
          <li>Use the same phone and browser each time. Private or incognito mode forgets you.</li>
        </ul>
      </section>

      {staff && (
        <section className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
          <h2 className="font-semibold">Staff</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/staff/inside" className="underline">Who is inside now</Link>
            {admin && <Link to="/staff/qr" className="underline">Lab QR code</Link>}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-400">Ideas, component requests and inventory are coming next.</p>
    </div>
  )
}
