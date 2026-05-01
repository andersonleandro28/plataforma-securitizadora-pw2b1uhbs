import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export function useCheckPermission(requiredRole: 'investor' | 'borrower') {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    async function checkPermission() {
      if (loading) return
      if (!user) {
        if (mounted) setIsAllowed(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, is_admin, is_staff, is_investor, is_borrower')
          .eq('id', user.id)
          .single()

        if (error || !data) {
          if (mounted) setIsAllowed(false)
          return
        }

        const isAdmin = data.is_admin || data.role === 'admin'
        const isStaff = data.is_staff || data.role === 'staff'

        if (isAdmin || isStaff) {
          if (mounted) setIsAllowed(true)
          return
        }

        const isInvestor = data.role === 'investor' || data.is_investor
        const isBorrower = data.role === 'borrower' || data.is_borrower

        if (requiredRole === 'investor' && !isInvestor) {
          toast.error('Você não tem permissão para acessar esta área.')
          if (isBorrower) {
            sessionStorage.setItem('activeRole', 'borrower')
          }
          window.location.href = '/'
          if (mounted) setIsAllowed(false)
          return
        }

        if (requiredRole === 'borrower' && !isBorrower) {
          toast.error('Você não tem permissão para acessar esta área.')
          if (isInvestor) {
            sessionStorage.setItem('activeRole', 'investor')
          }
          window.location.href = '/'
          if (mounted) setIsAllowed(false)
          return
        }

        if (mounted) setIsAllowed(true)
      } catch (err) {
        if (mounted) setIsAllowed(false)
      }
    }

    checkPermission()

    return () => {
      mounted = false
    }
  }, [user, loading, requiredRole, navigate])

  return { isAllowed }
}
