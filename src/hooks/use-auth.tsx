import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export type AppRole = 'admin' | 'staff' | 'investor' | 'borrower'

export interface Profile {
  id: string
  full_name: string | null
  email?: string | null
  avatar_url: string | null
  role: 'admin' | 'investor' | 'borrower' | 'staff'
  is_admin: boolean
  is_staff: boolean
  is_investor: boolean
  is_borrower: boolean
  requires_password_change?: boolean
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
  pj_rep_is_procurator?: boolean
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  activeRole: AppRole | null
  availableRoles: AppRole[]
  setActiveRole: (role: AppRole | null) => void
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
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)

  const [activeRole, setActiveRoleState] = useState<AppRole | null>(() => {
    return (sessionStorage.getItem('activeRole') as AppRole) || null
  })
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([])

  const [loadingSession, setLoadingSession] = useState(true)

  const setActiveRole = useCallback((role: AppRole | null) => {
    setActiveRoleState(role)
    if (role) sessionStorage.setItem('activeRole', role)
    else sessionStorage.removeItem('activeRole')
  }, [])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
        setActiveRoleState(null)
        sessionStorage.removeItem('activeRole')
        setAvailableRoles([])
        setProfileLoadedFor(null)
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

    const loadProfile = async (currentUser: User) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (error && (error.code === 'PGRST301' || error.code === '401')) {
          supabase.auth.signOut().catch(() => {})
        }

        if (mounted) {
          const p = data ? (data as Profile) : null
          setProfile(p)

          if (p) {
            const roles: AppRole[] = []

            const isSuperAdmin = currentUser.email === 'andersonleandro28@gmail.com'

            if (p.is_admin || p.role === 'admin' || isSuperAdmin) roles.push('admin')
            if (p.is_staff || p.role === 'staff') roles.push('staff')
            if (p.is_investor || p.role === 'investor') roles.push('investor')
            if (p.is_borrower || p.role === 'borrower') roles.push('borrower')

            // Fallback: If they are super admin, ensure they have at least admin role
            if (roles.length === 0 && isSuperAdmin) {
              roles.push('admin')
            }

            const uniqueRoles = Array.from(new Set(roles))
            setAvailableRoles(uniqueRoles)

            const currentActive = sessionStorage.getItem('activeRole') as AppRole | null

            if (uniqueRoles.length === 1) {
              setActiveRole(uniqueRoles[0])
            } else if (uniqueRoles.length > 1) {
              // Se há múltiplos papéis e o usuário já selecionou um válido, mantém
              if (currentActive && uniqueRoles.includes(currentActive)) {
                setActiveRole(currentActive)
              } else {
                // Caso contrário (primeiro login ou valor inválido), deixa nulo para forçar a escolha
                setActiveRole(null)
              }
            } else {
              setActiveRole(null)
            }
          } else {
            // Fallback for super admin without profile yet
            if (currentUser.email === 'andersonleandro28@gmail.com') {
              setAvailableRoles(['admin'])
              setActiveRole('admin')
            } else {
              setAvailableRoles([])
              setActiveRole(null)
            }
          }

          setProfileLoadedFor(currentUser.id)
        }
      } catch (err) {
        if (mounted) setProfileLoadedFor(currentUser.id)
      }
    }

    if (user && profileLoadedFor !== user.id) {
      loadProfile(user)
    } else if (!user && profileLoadedFor) {
      if (mounted) {
        setProfile(null)
        setAvailableRoles([])
        setActiveRole(null)
        setProfileLoadedFor(null)
      }
    }

    const handleProfileUpdate = () => {
      if (user) loadProfile(user)
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      mounted = false
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [user, profileLoadedFor, setActiveRole])

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
      sessionStorage.removeItem('activeRole')
      setActiveRoleState(null)
      return { error }
    } catch (error: any) {
      return { error }
    }
  }

  const loading = loadingSession || (!!user && profileLoadedFor !== user.id)

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        activeRole,
        availableRoles,
        setActiveRole,
        signUp,
        signIn,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
