import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShieldCheck,
  FileText,
  Landmark,
  Building,
  Briefcase,
  PieChart,
  Users as UsersIcon,
  TrendingUp,
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
import { useAuth } from '@/hooks/use-auth'

const allNavItems = [
  {
    title: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'staff', 'investor', 'borrower'],
  },
  {
    title: 'Gestão de Usuários',
    path: '/admin/users',
    icon: UsersIcon,
    roles: ['admin'],
  },
  {
    title: 'Compliance & KYC',
    path: '/onboarding',
    icon: ShieldCheck,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Operações (Lastro)',
    path: '/operations',
    icon: FileText,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Investimentos',
    path: '/investments',
    icon: TrendingUp,
    roles: ['investor'],
  },
  {
    title: 'Debêntures',
    path: '/debentures',
    icon: Landmark,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Fiduciário (Covenants)',
    path: '/trustee',
    icon: Building,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Tesouraria & Escrow',
    path: '/treasury',
    icon: Briefcase,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Relatórios',
    path: '/reports',
    icon: PieChart,
    roles: ['admin', 'staff', 'investor', 'borrower'],
  },
]

export function AppSidebar() {
  const location = useLocation()
  const { activeRole } = useAuth()

  const navItems = allNavItems.filter((item) => {
    if (!activeRole) return false
    return item.roles.includes(activeRole)
  })

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
