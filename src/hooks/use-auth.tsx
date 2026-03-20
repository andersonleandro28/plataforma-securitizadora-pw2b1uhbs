import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'investor' | 'borrower' | 'staff'
  kyc_status?: 'pending' | 'under_review' | 'approved' | 'rejected'
  entity_type?: 'pf' | 'pj'
  document_number?: string
  phone?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_city?: string
  address_state?: string
  is_pep?: boolean
  lgpd_accepted?: boolean
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoadingSession(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoadingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let mounted = true

    const loadProfile = () => {
      if (user) {
        setLoadingProfile(true)
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (mounted) {
              setProfile(data as Profile)
              setLoadingProfile(false)
            }
          })
      } else {
        if (mounted) {
          setProfile(null)
          setLoadingProfile(false)
        }
      }
    }

    loadProfile()

    // Setup listener for dynamic profile reloads across the app
    window.addEventListener('profile-updated', loadProfile)

    return () => {
      mounted = false
      window.removeEventListener('profile-updated', loadProfile)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      const sessionKey = `access_logged_${user.id}`
      if (!sessionStorage.getItem(sessionKey)) {
        ;(supabase as any)
          .from('access_logs')
          .insert({ user_id: user.id })
          .then(({ error }: any) => {
            if (!error) {
              sessionStorage.setItem(sessionKey, 'true')
            }
          })
      }
    }
  }, [user])

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('public-signup', {
        body: { email, password, fullName },
      })

      if (invokeError) {
        return { error: invokeError }
      }

      if (data?.error) {
        return { error: { message: data.error } }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      return { error: signInError }
    } catch (error: any) {
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    } catch (error: any) {
      return { error }
    }
  }

  const signOut = async () => {
    if (user) sessionStorage.removeItem(`access_logged_${user.id}`)
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error: any) {
      return { error }
    }
  }

  const loading = loadingSession || (!!user && loadingProfile)

  return (
    <AuthContext.Provider value={{ user, profile, session, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
