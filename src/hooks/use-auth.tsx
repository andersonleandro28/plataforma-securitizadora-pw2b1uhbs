import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'investor' | 'borrower' | 'staff'
  is_admin: boolean
  is_staff: boolean
  is_investor: boolean
  is_borrower: boolean
  kyc_status?: 'pending' | 'under_review' | 'approved' | 'rejected'
  entity_type?: 'pf' | 'pj'
  document_number?: string
  phone?: string
  address_zip?: string
  address_street?: string
  address_number?: string
  address_city?: string
  address_state?: string
  address_complement?: string
  address_neighborhood?: string
  is_pep?: boolean
  lgpd_accepted?: boolean
  pf_mother_name?: string
  pf_father_name?: string
  pf_marital_status?: string
  pf_occupation?: string
  pf_nationality?: string
  pf_birth_city?: string
  pf_rg?: string
  pj_company_name?: string
  pj_trade_name?: string
  pj_tax_regime?: string
  pj_annual_revenue?: number
  pj_cnae?: string
  pj_foundation_date?: string
  pj_rep_name?: string
  pj_rep_cpf?: string
  pj_rep_rg?: string
  pj_rep_role?: string
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
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
      }
      setLoadingSession(false)
    })

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) supabase.auth.signOut().catch(() => {})
        setSession(session ?? null)
        setUser(session?.user ?? null)
        setLoadingSession(false)
      })
      .catch(() => setLoadingSession(false))

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
          .maybeSingle()
          .then(({ data, error }) => {
            if (error && (error.code === 'PGRST301' || error.code === '401')) {
              supabase.auth.signOut().catch(() => {})
            }
            if (mounted) {
              setProfile(data ? (data as Profile) : null)
              setLoadingProfile(false)
            }
          })
          .catch(() => mounted && setLoadingProfile(false))
      } else {
        if (mounted) {
          setProfile(null)
          setLoadingProfile(false)
        }
      }
    }
    loadProfile()
    window.addEventListener('profile-updated', loadProfile)
    return () => {
      mounted = false
      window.removeEventListener('profile-updated', loadProfile)
    }
  }, [user])

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('public-signup', {
        body: { email, password, fullName },
      })
      if (invokeError) return { error: invokeError }
      if (data?.error) return { error: { message: data.error } }
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
