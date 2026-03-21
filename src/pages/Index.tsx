import { useAuth } from '@/hooks/use-auth'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import InvestorDashboard from '@/components/dashboard/InvestorDashboard'
import BorrowerDashboard from '@/components/dashboard/BorrowerDashboard'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { AlertCircle, Clock } from 'lucide-react'

export default function Index() {
  const { profile, activeRole, user } = useAuth()

  // Força o papel de admin imediatamente para não piscar a tela de erro enquanto o activeRole carrega
  const isSuperAdmin = user?.email === 'andersonleandro28@gmail.com'
  const effectiveRole = isSuperAdmin && !activeRole ? 'admin' : activeRole

  const renderKycBanner = () => {
    if (!profile) return null
    if (effectiveRole === 'admin' || effectiveRole === 'staff') return null
    if (profile.kyc_status === 'approved') return null

    let alertConfig = {
      variant: 'destructive' as const,
      icon: <AlertCircle className="h-4 w-4" />,
      title: 'Cadastro Incompleto (KYC)',
      description:
        'Por favor, complete seu cadastro e envie seus documentos para acessar todas as funcionalidades da plataforma.',
      buttonText: 'Completar Cadastro',
      buttonLink: '/kyc',
    }

    if (profile.kyc_status === 'under_review') {
      alertConfig = {
        variant: 'default' as const,
        icon: <Clock className="h-4 w-4 text-warning" />,
        title: 'Documentação em Análise',
        description:
          'Seus documentos estão sendo analisados pela nossa equipe de compliance. Em breve seu acesso será liberado.',
        buttonText: 'Ver Status',
        buttonLink: '/kyc',
      }
    } else if (profile.kyc_status === 'rejected') {
      alertConfig.title = 'Ajustes Necessários na Documentação'
      alertConfig.description =
        'Foi identificado um problema nos seus documentos. Por favor, revise e reenvie para nova análise.'
    }

    const isDefault = alertConfig.variant === 'default'

    return (
      <Alert
        variant={alertConfig.variant}
        className={`mb-6 animate-fade-in-down ${
          isDefault ? 'border-warning/50 bg-warning/5 text-foreground' : ''
        }`}
      >
        {alertConfig.icon}
        <AlertTitle className={isDefault ? 'text-warning font-semibold' : ''}>
          {alertConfig.title}
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <span>{alertConfig.description}</span>
          <Button
            variant={alertConfig.variant === 'destructive' ? 'destructive' : 'outline'}
            size="sm"
            asChild
            className={
              isDefault ? 'border-warning text-warning hover:bg-warning/10 hover:text-warning' : ''
            }
          >
            <Link to={alertConfig.buttonLink}>{alertConfig.buttonText}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {renderKycBanner()}
      {effectiveRole === 'admin' || effectiveRole === 'staff' ? (
        <AdminDashboard />
      ) : effectiveRole === 'borrower' ? (
        <BorrowerDashboard />
      ) : effectiveRole === 'investor' ? (
        <InvestorDashboard />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Perfil Não Configurado</h2>
          <p className="text-muted-foreground max-w-md">
            Seu usuário ainda não possui um perfil de acesso definido. Aguarde a liberação por um
            administrador.
          </p>
        </div>
      )}
    </div>
  )
}
