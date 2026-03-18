import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  Landmark,
  Building,
  Briefcase,
  PieChart,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar'

const navItems = [
  { title: 'Dashboard', path: '/', icon: LayoutDashboard },
  { title: 'Compliance & KYC', path: '/onboarding', icon: ShieldCheck },
  { title: 'Operações (Lastro)', path: '/operations', icon: FileText },
  { title: 'Debêntures', path: '/debentures', icon: Landmark },
  { title: 'Fiduciário (Covenants)', path: '/trustee', icon: Building },
  { title: 'Tesouraria & Escrow', path: '/treasury', icon: Briefcase },
  { title: 'Relatórios', path: '/reports', icon: PieChart },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-xl text-sidebar-foreground tracking-tight">
          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-white">
            S
          </div>
          <span className="group-data-[collapsible=icon]:hidden">Securix</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos Principais</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                    tooltip={item.title}
                  >
                    <Link to={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
