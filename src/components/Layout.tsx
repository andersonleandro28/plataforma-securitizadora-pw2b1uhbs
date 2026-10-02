import { Outlet } from 'react-router-dom'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import { useAuth } from '@/hooks/use-auth'
import { RoleSelection } from './auth/RoleSelection'
import { AssistantChat } from '@/components/assistant/AssistantChat'

export default function Layout() {
  const { activeRole, availableRoles, profile } = useAuth()

  if (profile && availableRoles.length > 1 && !activeRole) {
    return <RoleSelection />
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background font-sans text-foreground print:block print:min-h-0 print:bg-white print:text-black">
        <div className="print:hidden">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0 relative print:block print:m-0 print:p-0 print:border-none print:shadow-none print:overflow-visible">
          <div className="print:hidden">
            <Header />
          </div>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden animate-fade-in-up print:block print:p-0 print:m-0 print:overflow-visible print:transform-none">
            <Outlet />
          </main>
          {/* Chat assistente manual interativo disponível em todas as áreas logadas */}
          <div className="print:hidden" id="assistant-chat-wrapper">
            <AssistantChat />
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
