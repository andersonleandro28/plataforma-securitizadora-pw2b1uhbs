import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  DollarSign,
  ArrowDownToLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/use-notifications'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id)

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
      case 'redemption':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
      default:
        return <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-lg">
        <DropdownMenuLabel className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAll}
              className="h-7 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar lidas
            </Button>
          )}
        </DropdownMenuLabel>

        <ScrollArea className="max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma notificação</p>
              <p className="text-xs">Você está com tudo em dia!</p>
            </div>
          ) : (
            <DropdownMenuGroup className="divide-y divide-border/40">
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 cursor-pointer flex items-start gap-3 transition-colors ${
                    !n.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  {getIcon(n.type)}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs font-semibold leading-tight truncate ${
                          !n.read ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatNotificationDate(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    {n.metadata?.netValue && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-background/80 text-emerald-600 border-emerald-200"
                        >
                          Líquido: {formatCurrency(n.metadata.netValue)}
                        </Badge>
                        {n.metadata?.status && (
                          <Badge variant="secondary" className="text-[10px]">
                            {getStatusLabel(n.metadata.status)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  {!n.read && (
                    <span
                      className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5"
                      title="Não lida"
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2 text-center bg-muted/20">
              <span className="text-[11px] text-muted-foreground">
                Atualizado em tempo real pelo sistema
              </span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  function markAllAll(e: React.MouseEvent) {
    e.stopPropagation()
    markAllAsRead()
  }
}

function formatNotificationDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60))

  if (diffMinutes < 1) return 'Agora'
  if (diffMinutes < 60) return `${diffMinutes}m atrás`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h atrás`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays}d atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'paid':
      return 'Pago / Liquidado'
    case 'approved':
      return 'Aprovado'
    case 'rejected':
      return 'Rejeitado'
    case 'pending':
      return 'Pendente'
    default:
      return status
  }
}
