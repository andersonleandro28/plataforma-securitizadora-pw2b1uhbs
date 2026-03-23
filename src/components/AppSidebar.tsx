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
  Settings2,
  Package,
  CreditCard,
  CheckSquare,
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
    title: 'Parâmetros Financeiros',
    path: '/admin/parameters',
    icon: Settings2,
    roles: ['admin'],
  },
  {
    title: 'Contas Bancárias',
    path: '/admin/bank-accounts',
    icon: CreditCard,
    roles: ['admin'],
  },
  {
    title: 'Gestão de Produtos',
    path: '/admin/products',
    icon: Package,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Aprovações de Aportes',
    path: '/admin/investments',
    icon: CheckSquare,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Compliance & KYC',
    path: '/onboarding',
    icon: ShieldCheck,
    roles: ['admin', 'staff'],
  },
  {
    title: 'Mesa de Operações',
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
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r-0 [&_[data-sidebar=sidebar]]:bg-[#0f0f11] [&_[data-sidebar=sidebar]]:text-zinc-300 [&_[data-sidebar=menu-button]]:text-zinc-300 [&_[data-sidebar=menu-button][data-active=true]]:bg-zinc-800/50 [&_[data-sidebar=menu-button][data-active=true]]:text-white [&_[data-sidebar=menu-button]:hover]:bg-zinc-800/50 [&_[data-sidebar=menu-button]:hover]:text-white border-zinc-800"
    >
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-zinc-800/50">
        <div className="flex items-center gap-2 font-bold text-xl text-white tracking-tight">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            S
          </div>
          <span className="group-data-[collapsible=icon]:hidden">Securix</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-zinc-500 font-medium">
            Módulos Principais
          </SidebarGroupLabel>
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
                      <item.icon className="text-zinc-400 group-data-[active=true]/menu-button:text-primary transition-colors" />
                      <span className="font-medium">{item.title}</span>
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
