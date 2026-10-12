import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileFor, setProfileFor] = useState(null) // user id the loaded profile belongs to

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    // keep this callback synchronous: no supabase calls inside it
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileFor(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setProfileFor(userId)
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const profileReady = !userId || profileFor === userId

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading: sessionLoading || !profileReady,
    refreshProfile: loadProfile,
    signOut: () => supabase.auth.signOut(),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
