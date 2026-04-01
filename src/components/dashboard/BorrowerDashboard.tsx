import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { BorrowerNewOperation } from './BorrowerNewOperation'
import { BorrowerOperationsList } from './BorrowerOperationsList'
import { BorrowerVault } from './BorrowerVault'
import { BorrowerLiquidations } from './BorrowerLiquidations'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Wallet,
  TrendingUp,
  Clock,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Banknote,
  FileSignature,
} from 'lucide-react'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

const PendingSignatureBanner = ({
  type,
  url,
  onSign,
}: {
  type: string
  url: string
  onSign: () => void
}) => (
  <Alert className="bg-blue-50 border-blue-200 mb-6">
    <AlertCircle className="h-5 w-5 text-blue-600" />
    <AlertTitle className="text-blue-800 font-bold">Assinatura Pendente (DocuSign)</AlertTitle>
    <AlertDescription className="text-blue-700 flex flex-col sm:flex-row sm:items-center justify-between mt-2 gap-4">
      <span>
        Você possui um documento de <strong>{type}</strong> aguardando sua assinatura eletrônica via
        DocuSign.
      </span>
      <Button
        size="sm"
        onClick={onSign}
        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
      >
        <FileSignature className="w-4 h-4 mr-2" /> Assinar Agora
      </Button>
    </AlertDescription>
  </Alert>
)

export default function BorrowerDashboard() {
  const { user, profile } = useAuth()
  const [pendingSignatures, setPendingSignatures] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalAnticipated: 0,
    inAnalysis: 0,
    nextMaturities: 0,
    creditLimit: 1500000, // Fixed mock limit for UI purposes
  })
  const [latestOp, setLatestOp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    if (!user) return
    setLoading(true)

    // Fetch operations for stats
    const { data: operations } = await supabase
      .from('credit_operations')
      .select('status, requested_value, due_date, operation_calculations(net_value)')
      .eq('borrower_id', user.id)

    if (operations) {
      const totalAnticipated = operations
        .filter((op) => ['pago', 'liquidado'].includes(op.status || ''))
        .reduce((sum, op) => sum + (op.operation_calculations?.[0]?.net_value || 0), 0)

      const inAnalysis = operations
        .filter((op) =>
          ['enviado', 'em_triagem', 'em_analise', 'pendencia_documental'].includes(op.status || ''),
        )
        .reduce((sum, op) => sum + Number(op.requested_value || 0), 0)

      const nextMaturities = operations
        .filter((op) => {
          if (!op.due_date) return false
          const due = new Date(op.due_date)
          const now = new Date()
          const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24)
          return (
            diffDays > 0 &&
            diffDays <= 30 &&
            !['liquidado', 'cancelado', 'reprovado'].includes(op.status || '')
          )
        })
        .reduce((sum, op) => sum + Number(op.requested_value || 0), 0)

      setStats((prev) => ({ ...prev, totalAnticipated, inAnalysis, nextMaturities }))
    }

    // Fetch latest operation for timeline
    const { data: latest } = await supabase
      .from('credit_operations')
      .select('id, status, created_at, receivable_type, requested_value')
      .eq('borrower_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (latest) setLatestOp(latest)

    // Fetch pending signatures
    const { data: pendingOps } = await supabase
      .from('credit_operations')
      .select('id, signature_url')
      .eq('borrower_id', user.id)
      .eq('signature_status', 'enviado')

    if (pendingOps) setPendingSignatures(pendingOps)

    setLoading(false)
  }

  useEffect(() => {
    fetchDashboardData()
  }, [user])

  const getTimelineStep = (status: string) => {
    if (['enviado', 'em_triagem'].includes(status)) return 1
    if (['em_analise', 'pendencia_documental'].includes(status)) return 2
    if (['aprovado', 'aguardando_formalizacao', 'formalizado'].includes(status)) return 3
    if (['pago', 'liquidado'].includes(status)) return 4
    if (['reprovado', 'cancelado'].includes(status)) return -1 // Error state
    return 0
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-10 max-w-7xl mx-auto">
      {(profile as any)?.kyc_signature_status === 'enviado' &&
        (profile as any)?.kyc_signature_url && (
          <PendingSignatureBanner
            type="KYC (Compliance)"
            url={(profile as any).kyc_signature_url}
            onSign={() => window.open((profile as any).kyc_signature_url, '_blank')}
          />
        )}
      {pendingSignatures.map((op) => (
        <PendingSignatureBanner
          key={op.id}
          type={`Aditivo de Cessão #${op.id.split('-')[0].toUpperCase()}`}
          url={op.signature_url}
          onSign={() => window.open(op.signature_url, '_blank')}
        />
      ))}

      {/* 1. Dashboard de Boas-Vindas (Overview) */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">
            Acompanhe o limite disponível e o status das suas operações.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Valor Antecipado (YTD)</p>
                <Banknote className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAnticipated)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Volume em Análise</p>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(stats.inAnalysis)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Limite Disponível</p>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.creditLimit - stats.inAnalysis - stats.totalAnticipated)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Vencimentos (30 dias)</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(stats.nextMaturities)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline da Última Solicitação */}
        {latestOp && (
          <Card className="shadow-sm border-primary/10">
            <CardHeader className="pb-4 border-b bg-muted/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Status da Última Operação
              </CardTitle>
              <CardDescription>
                Acompanhamento em tempo real da solicitação enviada em{' '}
                {new Date(latestOp.created_at).toLocaleDateString('pt-BR')}.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {getTimelineStep(latestOp.status) === -1 ? (
                <div className="flex items-center gap-3 text-destructive bg-destructive/10 p-4 rounded-md">
                  <AlertCircle className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">Operação {latestOp.status}</p>
                    <p className="text-sm text-destructive/80">
                      Por favor, verifique a aba de histórico para mais detalhes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t-2 border-muted" />
                  </div>
                  <div className="relative flex justify-between">
                    {[
                      { step: 1, label: 'Solicitado', desc: 'Enviado' },
                      { step: 2, label: 'Em Análise', desc: 'Análise de Risco' },
                      { step: 3, label: 'Aprovado', desc: 'Aguardando Assinatura' },
                      { step: 4, label: 'Pago', desc: 'Valor Liberado' },
                    ].map((item, idx) => {
                      const currentStep = getTimelineStep(latestOp.status)
                      const isCompleted = currentStep >= item.step
                      const isCurrent = currentStep === item.step

                      return (
                        <div key={idx} className="flex flex-col items-center">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background z-10 transition-colors
                              ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'}`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <span>{item.step}</span>
                            )}
                          </div>
                          <div className="mt-3 text-center hidden sm:block">
                            <p
                              className={`text-sm font-semibold ${isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}
                            >
                              {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-4 h-auto">
          <TabsTrigger value="new" className="py-3">
            Nova Solicitação
          </TabsTrigger>
          <TabsTrigger value="history" className="py-3">
            Minhas Antecipações
          </TabsTrigger>
          <TabsTrigger value="liquidations" className="py-3">
            Liquidações Pendentes
          </TabsTrigger>
          <TabsTrigger value="vault" className="py-3">
            Central de Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6">
          <BorrowerNewOperation onSuccess={fetchDashboardData} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <BorrowerOperationsList />
        </TabsContent>

        <TabsContent value="liquidations" className="mt-6">
          <BorrowerLiquidations />
        </TabsContent>

        <TabsContent value="vault" className="mt-6">
          <BorrowerVault />
        </TabsContent>
      </Tabs>
    </div>
  )
}
