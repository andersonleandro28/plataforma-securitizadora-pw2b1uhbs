import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from './hooks/use-auth'
import Layout from './components/Layout'
import NotFound from './pages/NotFound'

import Index from './pages/Index'
import Onboarding from './pages/Onboarding'
import Operations from './pages/Operations'
import Debentures from './pages/Debentures'
import Trustee from './pages/Trustee'
import Treasury from './pages/Treasury'
import Profile from './pages/Profile'
import { AuthGuard } from './components/auth/AuthGuard'
import { RoleGuard } from './components/auth/RoleGuard'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route
              path="/"
              element={
                <RoleGuard allowedRoles={['admin', 'staff', 'investor', 'borrower']}>
                  <Index />
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
            <Route
              path="/debentures"
              element={
                <RoleGuard allowedRoles={['admin', 'staff', 'investor']}>
                  <Debentures />
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
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
