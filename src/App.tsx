import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Layout from './components/Layout'
import NotFound from './pages/NotFound'

import Index from './pages/Index'
import Onboarding from './pages/Onboarding'
import Operations from './pages/Operations'
import Debentures from './pages/Debentures'
import Trustee from './pages/Trustee'
import Treasury from './pages/Treasury'

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Index />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/debentures" element={<Debentures />} />
          <Route path="/trustee" element={<Trustee />} />
          <Route path="/treasury" element={<Treasury />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
