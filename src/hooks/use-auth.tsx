import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export type AppRole = 'admin' | 'staff' | 'investor' | 'borrower' | 'accountant'

export interface Profile {
  id: string
  full_name: string | null
  email?: string | null
  avatar_url: string | null
  role: 'admin' | 'investor' | 'borrower' | 'staff' | 'accountant'
  is_admin: boolean
  is_staff: boolean
  is_investor: boolean
  is_borrower: boolean
  is_accountant?: boolean
  is_blocked?: boolean
  force_password_change?: boolean
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
  wallet_balance?: number
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
  isLoadingProfile: boolean
  profileError: string | null
  retryLoadProfile: () => void
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
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

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

  const loadProfile = useCallback(
    async (currentUser: User) => {
      setIsLoadingProfile(true)
      setProfileError(null)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (error && (error.code === 'PGRST301' || error.code === '401')) {
          supabase.auth.signOut().catch(() => {})
          throw error
        }

        if (error) throw error

        const p = data ? (data as Profile) : null
        const isSuperAdmin = currentUser.email === 'andersonleandro28@gmail.com'

        if (p?.is_blocked && !isSuperAdmin) {
          toast.error('Seu acesso à plataforma foi temporariamente suspenso.')
          supabase.auth.signOut().catch(() => {})
          setProfile(null)
          setActiveRole(null)
          setAvailableRoles([])
          setProfileLoadedFor(null)
          setIsLoadingProfile(false)
          return
        }

        setProfile(p)

        const roles: AppRole[] = []

        const isAdmin = p?.is_admin || p?.role === 'admin' || isSuperAdmin
        const isStaff = p?.is_staff || p?.role === 'staff'
        const isAccountant = p?.is_accountant || p?.role === 'accountant' || isSuperAdmin

        if (isAdmin) roles.push('admin')
        if (isStaff) roles.push('staff')
        if (isAccountant) roles.push('accountant')
        if (p?.is_investor || p?.role === 'investor' || isAdmin || isStaff) roles.push('investor')
        if (p?.is_borrower || p?.role === 'borrower' || isAdmin || isStaff) roles.push('borrower')

        const uniqueRoles = Array.from(new Set(roles))
        setAvailableRoles(uniqueRoles)

        const currentActive = sessionStorage.getItem('activeRole') as AppRole | null

        if (uniqueRoles.length > 0) {
          if (currentActive && uniqueRoles.includes(currentActive)) {
            setActiveRole(currentActive)
          } else {
            const defaultRole = uniqueRoles.includes('admin') ? 'admin' : uniqueRoles[0]
            setActiveRole(defaultRole)
          }
        } else {
          setActiveRole(null)
        }

        setProfileLoadedFor(currentUser.id)
        setIsLoadingProfile(false)
      } catch (err: any) {
        setProfileError(err.message || 'Erro ao carregar perfil.')
        setIsLoadingProfile(false)
      }
    },
    [setActiveRole],
  )

  const retryLoadProfile = useCallback(() => {
    if (user) {
      loadProfile(user)
    }
  }, [user, loadProfile])

  useEffect(() => {
    let mounted = true

    if (user && profileLoadedFor !== user.id) {
      loadProfile(user)
    } else if (!user && profileLoadedFor) {
      if (mounted) {
        setProfile(null)
        setAvailableRoles([])
        setActiveRole(null)
        setProfileLoadedFor(null)
        setIsLoadingProfile(false)
      }
    } else if (!user) {
      if (mounted) setIsLoadingProfile(false)
    } else if (user && profileLoadedFor === user.id) {
      if (mounted) setIsLoadingProfile(false)
    }

    const handleProfileUpdate = () => {
      if (user) loadProfile(user)
    }

    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => {
      mounted = false
      window.removeEventListener('profile-updated', handleProfileUpdate)
    }
  }, [user, profileLoadedFor, loadProfile, setActiveRole])

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

  const loading = loadingSession

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
        isLoadingProfile,
        profileError,
        retryLoadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
