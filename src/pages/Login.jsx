import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { consumePath } from '../lib/afterLogin'

// Staff login only. Students never see this page: scanning the lab QR signs them in.
export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const redirected = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loading && user && !redirected.current) {
      redirected.current = true
      navigate(consumePath() || '/', { replace: true })
    }
  }, [user, loading, navigate])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)
    if (error) {
      // Only the real "bad password / unknown user" error gets the friendly text.
      // Anything else (bad API key, unconfirmed email, network) shows its real message.
      const wrongCredentials = /invalid login credentials/i.test(error.message)
      setError(
        wrongCredentials
          ? 'Wrong email or password.'
          : `${error.message} (code: ${error.code || error.status || 'none'})`,
      )
    }
  }

  const input = 'w-full rounded-md border border-slate-300 px-3 py-2.5 text-base bg-white'

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Makerspace</h1>

        <div className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          <b>Students:</b> scan the QR code at the lab entrance. You do not need to log in.
        </div>

        <form onSubmit={submit} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600">Staff login</h2>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="Email"
            className={input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <div className="rounded-md bg-red-50 border border-red-300 p-2 text-sm text-red-900">{error}</div>
          )}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
