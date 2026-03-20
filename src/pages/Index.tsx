import { useAuth } from '@/hooks/use-auth'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import InvestorDashboard from '@/components/dashboard/InvestorDashboard'
import BorrowerDashboard from '@/components/dashboard/BorrowerDashboard'

export default function Index() {
  const { profile } = useAuth()

  if (profile?.role === 'investor') {
    return <InvestorDashboard />
  }

  if (profile?.role === 'borrower') {
    return <BorrowerDashboard />
  }

  // Admin and Staff roles share the same operational dashboard
  return <AdminDashboard />
}
