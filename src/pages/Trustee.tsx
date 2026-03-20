import { useEffect, useCallback, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

import { getSerasaHistory, type SerasaConsultationRecord } from '@/services/serasa'
import { useAuth } from '@/hooks/use-auth'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { RiskDashboard } from '@/components/trustee/RiskDashboard'
import { ConsultationHistory } from '@/components/trustee/ConsultationHistory'
import { SerasaForm } from '@/components/trustee/SerasaForm'
import { CovenantsPanel } from '@/components/trustee/CovenantsPanel'

function TrusteeContent() {
  const { user, signOut } = useAuth()
  const [history, setHistory] = useState<SerasaConsultationRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadHistory = useCallback(async () => {
    try {
      const records = await getSerasaHistory()
      setHistory(records)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar o histórico de consultas.')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadHistory()
    }
  }, [user, loadHistory])

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Trustee Corner</h1>
          <p className="text-muted-foreground mt-1">
            Painel consolidado de Análise de Risco, Covenants e Auditoria Fiduciária.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão
        </Button>
      </div>

      {loadingHistory ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin mb-4" />
          <p>Carregando dados operacionais...</p>
        </div>
      ) : (
        <div className="space-y-8">
          <RiskDashboard history={history} />
          <SerasaForm onSaved={loadHistory} />
          <ConsultationHistory history={history} />
          <CovenantsPanel />
        </div>
      )}
    </div>
  )
}

export default function Trustee() {
  return (
    <AuthGuard>
      <TrusteeContent />
    </AuthGuard>
  )
}
