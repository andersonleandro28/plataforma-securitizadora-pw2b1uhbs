import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from './hooks/use-auth'
import Layout from './components/Layout'
import NotFound from './pages/NotFound'
import { ForceChangePassword } from './components/auth/ForceChangePassword'

import Index from './pages/Index'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Onboarding from './pages/Onboarding'
import Operations from './pages/Operations'
import Debentures from './pages/Debentures'
import Investments from './pages/Investments'
import InvestmentCheckout from './pages/investor/InvestmentCheckout'
import Trustee from './pages/Trustee'
import Treasury from './pages/Treasury'
import Profile from './pages/Profile'
import Users from './pages/admin/Users'
import FinancialParameters from './pages/admin/FinancialParameters'
import InvestmentProducts from './pages/admin/InvestmentProducts'
import BankAccounts from './pages/admin/BankAccounts'
import InvestmentsReview from './pages/admin/InvestmentsReview'
import AdminCcbRequests from './pages/admin/AdminCcbRequests'
import KycOnboarding from './pages/KycOnboarding'
import CcbDigital from './pages/borrower/CcbDigital'
import { AuthGuard } from './components/auth/AuthGuard'
import { RoleGuard } from './components/auth/RoleGuard'

// Ignore browser extension errors (e.g., MetaMask) that crash the preview
if (typeof window !== 'undefined') {
  const suppressError = (event: ErrorEvent | PromiseRejectionEvent) => {
    let errorMsg = ''
    if (event instanceof ErrorEvent) {
      errorMsg = event.message || event.error?.message || ''
    } else if (event instanceof PromiseRejectionEvent) {
      errorMsg = event.reason?.message || event.reason || ''
    }

    if (
      typeof errorMsg === 'string' &&
      (errorMsg.toLowerCase().includes('metamask') || errorMsg.includes('chrome-extension'))
    ) {
      event.preventDefault()
      event.stopPropagation()
      return true
    }
  }

  window.addEventListener('error', suppressError as EventListener, true)
  window.addEventListener('unhandledrejection', suppressError as EventListener, true)

  const originalConsoleError = console.error
  console.error = (...args) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : a?.message || '')).join(' ')
    if (msg.toLowerCase().includes('metamask') || msg.includes('chrome-extension')) {
      return
    }
    originalConsoleError(...args)
  }
}

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ForceChangePassword />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route path="/" element={<Index />} />

            <Route
              path="/kyc"
              element={
                <RoleGuard allowedRoles={['investor', 'borrower']}>
                  <KycOnboarding />
                </RoleGuard>
              }
            />

            <Route
              path="/ccb-digital"
              element={
                <RoleGuard allowedRoles={['borrower']}>
                  <CcbDigital />
                </RoleGuard>
              }
            />

            <Route
              path="/onboarding"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <Onboarding />
                </RoleGuard>
              }
            />
            <Route
              path="/operations"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <Operations />
                </RoleGuard>
              }
            />
            <Route path="/debentures" element={<Debentures />} />
            <Route
              path="/investments"
              element={
                <RoleGuard allowedRoles={['investor']}>
                  <Investments />
                </RoleGuard>
              }
            />
            <Route
              path="/investments/checkout/:id"
              element={
                <RoleGuard allowedRoles={['investor']}>
                  <InvestmentCheckout />
                </RoleGuard>
              }
            />
            <Route
              path="/trustee"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <Trustee />
                </RoleGuard>
              }
            />
            <Route
              path="/treasury"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <Treasury />
                </RoleGuard>
              }
            />

            <Route
              path="/admin/users"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Users />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/parameters"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <FinancialParameters />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/products"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <InvestmentProducts />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/bank-accounts"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <BankAccounts />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/investments"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <InvestmentsReview />
                </RoleGuard>
              }
            />
            <Route
              path="/admin/ccb-requests"
              element={
                <RoleGuard allowedRoles={['admin', 'staff']}>
                  <AdminCcbRequests />
                </RoleGuard>
              }
            />

            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
