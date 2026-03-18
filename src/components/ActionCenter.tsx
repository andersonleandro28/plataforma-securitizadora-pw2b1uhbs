import { Bell, AlertTriangle, FileSignature, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

const pendingActions = [
  {
    id: 1,
    title: 'Assinatura Pendente',
    desc: 'Borderô #4092 - Cedente Alpha Ltda',
    type: 'signature',
    time: 'Há 2 horas',
  },
  {
    id: 2,
    title: 'Alerta de Covenant',
    desc: 'Índice de Liquidez < 1.2x (Série 1)',
    type: 'alert',
    time: 'Há 5 horas',
  },
  {
    id: 3,
    title: 'NF-e Inválida',
    desc: 'Nota Fiscal 55920 reprovada na SEFAZ',
    type: 'error',
    time: 'Ontem',
  },
]

export function ActionCenter() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse-ring" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-background border-l">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5" />
            Central de Ações Pendentes
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="flex flex-col gap-3 pr-4">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="mt-0.5">
                  {action.type === 'signature' && <FileSignature className="h-5 w-5 text-accent" />}
                  {action.type === 'alert' && <AlertTriangle className="h-5 w-5 text-warning" />}
                  {action.type === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <span className="text-xs text-muted-foreground">{action.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{action.desc}</p>
                  <div className="pt-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs">
                      Resolver
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-emerald-800 font-medium">
                Todas as integrações bancárias sincronizadas hoje.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
