import { Search, User, LogOut, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ActionCenter } from './ActionCenter'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profileName, setProfileName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    const loadHeaderProfile = async () => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfileName(data.full_name || '')
        setAvatarUrl(data.avatar_url || '')
      }
    }

    loadHeaderProfile()

    const handleUpdate = () => loadHeaderProfile()
    window.addEventListener('profile-updated', handleUpdate)
    return () => window.removeEventListener('profile-updated', handleUpdate)
  }, [user])

  const handleLogout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger />
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar Cedentes, Sacados ou Borderôs..."
            className="w-full bg-muted/50 pl-9 border-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ActionCenter />
        <div className="h-8 w-px bg-border hidden sm:block" />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1.5 rounded-lg transition-colors">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-medium leading-none">
                    {profileName || 'Usuário'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {user.email}
                  </span>
                </div>
                <Avatar className="h-9 w-9 border">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {profileName ? (
                      profileName.charAt(0).toUpperCase()
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="w-full flex items-center cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações do Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-3 cursor-pointer">
            <Link
              to="/profile"
              className="flex items-center gap-3 hover:bg-muted/50 p-1.5 rounded-lg transition-colors"
            >
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-medium leading-none">Acessar</span>
                <span className="text-xs text-muted-foreground">Fazer login</span>
              </div>
              <Avatar className="h-9 w-9 border bg-muted">
                <AvatarFallback>
                  <User className="h-4 w-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
