import { useAuth } from '@/hooks/use-auth'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import InvestorDashboard from '@/components/dashboard/InvestorDashboard'
import BorrowerDashboard from '@/components/dashboard/BorrowerDashboard'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { AlertCircle, Clock } from 'lucide-react'

export default function Index() {
  const { profile } = useAuth()

  const renderKycBanner = () => {
    if (!profile) return null
    if (profile.is_admin || profile.is_staff) return null
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
      {profile?.is_admin || profile?.is_staff ? (
        <AdminDashboard />
      ) : profile?.is_borrower ? (
        <BorrowerDashboard />
      ) : profile?.is_investor ? (
        <InvestorDashboard />
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          Nenhum perfil ativo associado à sua conta.
        </div>
      )}
    </div>
  )
}
