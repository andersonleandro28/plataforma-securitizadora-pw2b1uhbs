import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase, Building, ShieldCheck, TrendingUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const roleConfig = {
  admin: { title: 'Administrador', icon: ShieldCheck, desc: 'Acesso total à plataforma.' },
  staff: { title: 'Equipe Interna', icon: Briefcase, desc: 'Gestão operacional e análise.' },
  investor: {
    title: 'Investidor',
    icon: TrendingUp,
    desc: 'Acompanhe seus rendimentos e portfólio.',
  },
  borrower: { title: 'Tomador', icon: Building, desc: 'Gerencie seu limite e borderôs.' },
}

export function RoleSelection() {
  const { availableRoles, setActiveRole } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="max-w-3xl w-full space-y-8 animate-fade-in-up">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo(a) de volta!</h1>
          <p className="text-muted-foreground">
            Identificamos que você possui múltiplos perfis de acesso. Selecione qual deseja utilizar
            nesta sessão.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from(new Set(['investor', 'borrower', ...availableRoles] as AppRole[])).map(
            (role) => {
              const config = roleConfig[role]
              if (!config) return null

              const Icon = config.icon
              const isAuthorized = availableRoles.includes(role)

              const cardContent = (
                <Card
                  className={cn(
                    'transition-colors border-border/50',
                    isAuthorized
                      ? 'cursor-pointer hover:border-primary hover:shadow-md group'
                      : 'opacity-50 cursor-not-allowed bg-muted',
                  )}
                  onClick={() => {
                    if (isAuthorized) setActiveRole(role)
                  }}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                    <div
                      className={cn(
                        'h-16 w-16 rounded-full flex items-center justify-center transition-colors',
                        isAuthorized
                          ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                          : 'bg-muted-foreground/10 text-muted-foreground',
                      )}
                    >
                      <Icon className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xl">{config.title}</h3>
                      <p className="text-sm text-muted-foreground mt-2">{config.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              )

              if (!isAuthorized) {
                return (
                  <Tooltip key={role}>
                    <TooltipTrigger asChild>
                      <div>{cardContent}</div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Seu perfil não permite acessar esta área</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return <div key={role}>{cardContent}</div>
            },
          )}
        </div>
      </div>
    </div>
  )
}
