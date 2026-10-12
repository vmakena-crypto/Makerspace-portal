import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import { consumePath } from '../lib/afterLogin'

function readAuthError() {
  const q = new URLSearchParams(window.location.search)
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return q.get('error_description') || h.get('error_description')
}

const IN_APP = /Instagram|FBAN|FBAV|Snapchat|LinkedInApp|Line\//i

export default function Login() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const redirected = useRef(false)
  const [busy, setBusy] = useState(false)
  const rawError = readAuthError()
  const [error, setError] = useState(
    rawError
      ? /database error|not allowed/i.test(rawError)
        ? 'This email is not allowed. Sign in with your GITAM email, or ask an admin to add yours.'
        : rawError
      : null,
  )

  useEffect(() => {
    if (!loading && user && !redirected.current) {
      redirected.current = true
      navigate(consumePath() || '/', { replace: true })
    }
  }, [user, loading, navigate])

  async function signIn() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">Makerspace</h1>
        <p className="text-sm text-slate-600">Sign in with your college Google account.</p>

        {IN_APP.test(navigator.userAgent) && (
          <div className="rounded-md bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900">
            You are inside an app browser. Google sign-in may fail here. Open this page in
            Chrome or Safari.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-300 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        <button
          onClick={signIn}
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 font-medium disabled:opacity-50"
        >
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}
