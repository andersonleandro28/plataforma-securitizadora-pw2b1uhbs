import { Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ActionCenter } from './ActionCenter'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function Header() {
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
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-sm font-medium leading-none">Admin Executivo</span>
            <span className="text-xs text-muted-foreground">Fundo Securitizador I</span>
          </div>
          <Avatar className="h-9 w-9 border">
            <AvatarImage src="https://img.usecurling.com/ppl/thumbnail?gender=female" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
