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
  const isExtensionError = (err: any) => {
    try {
      if (!err) return false

      let errorMsg = ''
      let stack = ''

      if (typeof err === 'string') {
        errorMsg = err
      } else if (err instanceof Error) {
        errorMsg = err.message
        stack = err.stack || ''
      } else if (err instanceof ErrorEvent) {
        errorMsg = err.message || err.error?.message || ''
        stack = err.error?.stack || ''
      } else if (err instanceof PromiseRejectionEvent) {
        errorMsg = err.reason?.message || (typeof err.reason === 'string' ? err.reason : '')
        stack = err.reason?.stack || ''
      } else if (typeof err === 'object') {
        errorMsg = err.message || err.error?.message || err.reason?.message || ''
        stack = err.stack || err.error?.stack || err.reason?.stack || ''
        if (typeof err.error === 'string') {
          errorMsg = errorMsg || err.error
        }
      }

      let strData = ''
      try {
        strData =
          typeof err === 'object'
            ? JSON.stringify(err, (k, v) => (typeof v === 'bigint' ? v.toString() : v))
            : ''
      } catch (e) {
        // ignore circular reference errors
      }

      const fullStr = (String(errorMsg) + ' ' + String(stack) + ' ' + strData).toLowerCase()
      return (
        fullStr.includes('metamask') ||
        fullStr.includes('chrome-extension') ||
        fullStr.includes('inpage.js') ||
        fullStr.includes('ethereum') ||
        fullStr.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
      )
    } catch (e) {
      return false
    }
  }

  const suppressError = (event: any) => {
    if (isExtensionError(event)) {
      if (typeof event.preventDefault === 'function') event.preventDefault()
      if (typeof event.stopPropagation === 'function') event.stopPropagation()
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
      return true
    }
  }

  window.addEventListener('error', suppressError, true)
  window.addEventListener('unhandledrejection', suppressError, true)

  const originalOnerror = window.onerror
  window.onerror = function (...args: any[]) {
    const [msg, url, , , error] = args
    if (
      isExtensionError(msg) ||
      isExtensionError(error) ||
      String(url).includes('chrome-extension') ||
      String(msg).toLowerCase().includes('metamask')
    ) {
      return true
    }
    if (originalOnerror) {
      return originalOnerror.apply(this, args as any)
    }
  }

  const originalOnunhandledrejection = window.onunhandledrejection
  window.onunhandledrejection = function (...args: any[]) {
    const [event] = args
    if (isExtensionError(event)) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault()
      return true
    }
    if (originalOnunhandledrejection) {
      return originalOnunhandledrejection.apply(this, args as any)
    }
  }

  const originalConsoleError = console.error
  console.error = (...args) => {
    try {
      const msg = args
        .map((a) => {
          if (typeof a === 'string') return a
          if (a instanceof Error) return a.message + ' ' + (a.stack || '')
          if (a && typeof a === 'object') {
            try {
              return JSON.stringify(a, (k, v) => (typeof v === 'bigint' ? v.toString() : v))
            } catch (e) {
              return String(a)
            }
          }
          return String(a)
        })
        .join(' ')
        .toLowerCase()

      if (
        msg.includes('metamask') ||
        msg.includes('chrome-extension') ||
        msg.includes('inpage.js') ||
        msg.includes('ethereum') ||
        msg.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
      ) {
        return
      }
    } catch (e) {
      // ignore
    }
    originalConsoleError(...args)
  }

  // Intercept postMessage to prevent the preview platform from displaying the error overlay
  const wrapPostMessage = (target: Window) => {
    if (!target) return
    try {
      const orig = target.postMessage
      target.postMessage = function (message: any, ...rest: any[]) {
        try {
          if (
            message &&
            (message.type === 'preview:error' || message.error || message.type === 'error')
          ) {
            const str = JSON.stringify(message, (k, v) =>
              typeof v === 'bigint' ? v.toString() : v,
            ).toLowerCase()
            if (
              str.includes('metamask') ||
              str.includes('chrome-extension') ||
              str.includes('inpage.js') ||
              str.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
            ) {
              return // Drop the message entirely
            }
          }
        } catch (e) {
          // ignore
        }
        return orig.apply(this, [message, ...rest])
      }
    } catch (err) {
      // ignore cross-origin errors
    }
  }

  try {
    wrapPostMessage(window)
  } catch (e) {}
  try {
    if (window.parent && window.parent !== window) {
      wrapPostMessage(window.parent)
    }
  } catch (e) {}
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
