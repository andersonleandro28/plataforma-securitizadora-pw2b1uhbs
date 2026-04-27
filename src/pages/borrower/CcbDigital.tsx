import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Landmark,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle2,
  Download,
  UploadCloud,
  Loader2,
} from 'lucide-react'
import { CcbWizard } from '@/components/ccb/CcbWizard'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function CcbDigital() {
  const { user } = useAuth()
  const [showWizard, setShowWizard] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [activeOps, setActiveOps] = useState<any[]>([])
  const [uploading, setUploading] = useState<string | null>(null)

  const [reviewModal, setReviewModal] = useState<any>(null)

  const fetchData = async () => {
    if (!user) return
    const [{ data: reqs }, { data: ops }] = await Promise.all([
      supabase
        .from('ccb_solicitacoes')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('operacoes_antecipacao')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    if (reqs) setRequests(reqs)
    if (ops) setActiveOps(ops)
  }

  useEffect(() => {
    fetchData()
  }, [user])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovada':
        return <Badge className="bg-emerald-500">Aprovada</Badge>
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>
      case 'em_analise':
        return <Badge className="bg-amber-500">Em Análise BDIGITAL</Badge>
      case 'proposta_ajustada':
        return <Badge className="bg-blue-500">Proposta Ajustada (Ação Necessária)</Badge>
      case 'aceite_tomador':
        return <Badge className="bg-indigo-500">Aceito (Aguardando Emissão)</Badge>
      default:
        return <Badge variant="secondary">Pendente Envio</Badge>
    }
  }

  const handleUploadReceipt = async (opId: string, instId: string, file: File) => {
    if (!file) return
    setUploading(instId)
    try {
      const path = `comprovantes_ccb/${opId}/${instId}_${Date.now()}.pdf`
      const { error: upErr } = await supabase.storage.from('ccb-docs').upload(path, file)
      if (upErr) throw upErr

      const op = activeOps.find((o) => o.id === opId)
      const newInst = op.installments.map((i: any) =>
        i.id === instId ? { ...i, receipt_url: path, status: 'pendente_analise' } : i,
      )

      const { error: dbErr } = await supabase
        .from('operacoes_antecipacao')
        .update({ installments: newInst })
        .eq('id', opId)
      if (dbErr) throw dbErr

      toast.success('Comprovante enviado com sucesso!')
      fetchData()
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message)
    } finally {
      setUploading(null)
    }
  }

  const downloadFile = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from('ccb-docs').createSignedUrl(path, 60)
      if (error) throw error
      if (data) window.open(data.signedUrl, '_blank')
    } catch (e) {
      toast.error('Erro ao baixar documento')
    }
  }

  const handleAcceptProposal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ccb_solicitacoes')
        .update({ status: 'aceite_tomador', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Proposta aceita! O comitê dará prosseguimento à sua solicitação.')
      setReviewModal(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erro ao aceitar proposta: ' + e.message)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-10">
      <div className="bg-gradient-to-r from-[#001b33] to-[#004e8a] rounded-2xl overflow-hidden shadow-lg border border-[#00C2E0]/30 relative">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[#00C2E0]/20 rounded-full blur-3xl"></div>
        <div className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-white max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-xs font-semibold tracking-wide">
              <Landmark className="h-4 w-4 text-[#00C2E0]" /> Parceria Exclusiva BDIGITAL
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              Simule e Emita sua CCB Digital <span className="text-[#00C2E0]">em 5 minutos</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Antecipação imediata com simulação em tempo real e aprovação bancária direto do seu
              painel. Crédito rápido, sem burocracia, para valores a partir de R$ 5.000.
            </p>
          </div>
          <div className="hidden md:flex flex-col gap-4 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm min-w-[280px]">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Simulação Instantânea</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Espelho em PDF</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Assinatura Eletrônica</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="nova" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="nova" className="px-6">
            Solicitar/Simular CCB
          </TabsTrigger>
          <TabsTrigger value="ativas" className="px-6 relative">
            Minhas Operações e Parcelas
            {activeOps.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#00C2E0] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {activeOps.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="space-y-6">
          {showWizard ? (
            <CcbWizard
              onSuccess={() => {
                setShowWizard(false)
                fetchData()
              }}
            />
          ) : (
            <div className="space-y-6">
              <Button
                size="lg"
                className="bg-[#00C2E0] hover:bg-[#00a9c4] text-white border-0 font-semibold gap-2 h-14 px-8"
                onClick={() => setShowWizard(true)}
              >
                Nova Simulação de CCB <ArrowRight className="h-5 w-5" />
              </Button>

              {requests.length > 0 && (
                <div className="space-y-4 pt-6">
                  {requests.some((r) => r.status === 'proposta_ajustada') && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-start gap-3 shadow-sm mb-4 animate-fade-in">
                      <div className="bg-blue-100 p-2 rounded-full mt-0.5">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Ação Necessária</h4>
                        <p className="text-sm mt-1">
                          Sua proposta foi revisada. Confira as novas condições nos cartões abaixo e
                          clique em{' '}
                          <strong className="font-semibold">Analisar Nova Proposta</strong> para
                          prosseguir com a aprovação.
                        </p>
                      </div>
                    </div>
                  )}

                  <h3 className="text-xl font-bold border-b pb-2">Histórico de Solicitações</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {requests.map((req) => (
                      <Card
                        key={req.id}
                        className="shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-muted"
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-mono text-muted-foreground">
                              ID: {req.id.split('-')[0].toUpperCase()}
                            </span>
                            {getStatusBadge(req.status)}
                          </div>
                          <div>
                            <p className="text-2xl font-bold">
                              R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground">{req.term_months} meses</p>
                          </div>
                          <div className="flex flex-col gap-2 pt-4 border-t text-sm">
                            <span className="text-muted-foreground mb-1">
                              Data: {new Date(req.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {req.pdf_file_path && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 text-[#00C2E0] border-[#00C2E0]/30 hover:bg-[#00C2E0]/10 flex-1"
                                  onClick={() => downloadFile(req.pdf_file_path)}
                                  title="Visualizar o espelho do contrato"
                                >
                                  <FileText className="h-4 w-4" /> PDF
                                </Button>
                              )}
                              {req.status === 'proposta_ajustada' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white border-0 flex-1 animate-pulse shadow-blue-500/50 shadow-sm"
                                  onClick={() => setReviewModal(req)}
                                >
                                  Analisar Nova Proposta
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ativas" className="space-y-6">
          {activeOps.length === 0 ? (
            <Card className="bg-muted/30 border-dashed py-12 text-center">
              <CardContent>
                <p className="text-muted-foreground">
                  Você não possui operações CCB ativas no momento.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {activeOps.map((op) => (
                <Card key={op.id} className="border border-border/60 shadow-sm overflow-hidden">
                  <div className="bg-muted/40 p-4 border-b flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">
                        Operação #{op.ccb_id.split('-')[0].toUpperCase()}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Emitida via {op.partner_bank} em{' '}
                        {new Date(op.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor Líquido Antecipado</p>
                      <p className="font-bold text-xl text-primary">
                        R$ {Number(op.net_value).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="parcelas" className="border-b-0">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/20">
                          <span className="font-semibold text-[#00C2E0]">
                            Ver Cronograma de Parcelas ({op.installments.length})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-0 space-y-3 bg-muted/10">
                          {op.installments.map((inst: any) => (
                            <div
                              key={inst.id}
                              className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg bg-background shadow-sm gap-4"
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-base">Parcela {inst.number}</span>
                                  <Badge
                                    variant={
                                      inst.status === 'paga'
                                        ? 'default'
                                        : inst.status === 'pendente_analise'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                    className={
                                      inst.status === 'paga'
                                        ? 'bg-emerald-500'
                                        : inst.status === 'pendente_analise'
                                          ? 'bg-amber-500'
                                          : ''
                                    }
                                  >
                                    {inst.status === 'paga'
                                      ? 'Mês Quitado'
                                      : inst.status === 'pendente_analise'
                                        ? 'Em Análise'
                                        : 'Em Aberto'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Vencimento:{' '}
                                  <span className="font-medium text-foreground">
                                    {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                                  </span>{' '}
                                  | Valor:{' '}
                                  <span className="font-medium text-foreground">
                                    R${' '}
                                    {Number(inst.value).toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                {inst.boleto_url && inst.status !== 'paga' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => downloadFile(inst.boleto_url)}
                                    className="gap-2"
                                  >
                                    <Download className="h-4 w-4" /> Baixar Boleto
                                  </Button>
                                )}
                                {inst.status !== 'paga' && inst.status !== 'pendente_analise' && (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      id={`receipt-${inst.id}`}
                                      className="hidden"
                                      accept="image/*,.pdf"
                                      onChange={(e) =>
                                        handleUploadReceipt(
                                          op.id,
                                          inst.id,
                                          e.target.files?.[0] as File,
                                        )
                                      }
                                    />
                                    <Button
                                      size="sm"
                                      className="gap-2 bg-[#00C2E0] hover:bg-[#00a9c4]"
                                      onClick={() =>
                                        document.getElementById(`receipt-${inst.id}`)?.click()
                                      }
                                      disabled={uploading === inst.id}
                                    >
                                      {uploading === inst.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <UploadCloud className="h-4 w-4" />
                                      )}
                                      Enviar Comprovante
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewModal} onOpenChange={(v) => !v && setReviewModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Proposta de Crédito</DialogTitle>
            <DialogDescription>
              O comitê revisou sua solicitação e ajustou as seguintes condições. Verifique e
              confirme se estiver de acordo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md text-sm border shadow-inner">
              <div>
                <span className="text-muted-foreground block mb-1">Taxa de Juros</span>
                <span className="font-bold text-base">
                  {reviewModal?.operation_data?.simulation?.interest_rate_monthly}% a.m.
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Tarifa de Emissão</span>
                <span className="font-bold text-base">
                  R${' '}
                  {Number(reviewModal?.operation_data?.simulation?.fixed_cost || 0).toLocaleString(
                    'pt-BR',
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Valor da Parcela</span>
                <span className="font-bold text-base">
                  R${' '}
                  {Number(
                    reviewModal?.operation_data?.simulation?.installment_value || 0,
                  ).toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Custo Efetivo Total (CET)</span>
                <span className="font-bold text-base text-primary">
                  {Number(reviewModal?.operation_data?.simulation?.cet || 0).toFixed(2)}% a.m.
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleAcceptProposal(reviewModal.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Aceitar Condições
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
