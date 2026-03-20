import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase, Building, ShieldCheck, TrendingUp } from 'lucide-react'

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
          {availableRoles.map((role) => {
            const config = roleConfig[role]
            const Icon = config.icon
            return (
              <Card
                key={role}
                className="cursor-pointer hover:border-primary transition-colors hover:shadow-md border-border/50 group"
                onClick={() => setActiveRole(role)}
              >
                <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl">{config.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{config.desc}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
