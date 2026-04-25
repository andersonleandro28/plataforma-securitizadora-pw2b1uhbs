import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Wallet,
  TrendingUp,
  PieChart,
  Receipt,
  CalendarDays,
  Loader2,
  AlertCircle,
  FileText,
  ArrowRight,
  ArrowDownToLine,
  History,
  FileSignature,
  Trash2,
  List,
  Download,
  Percent,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const chartConfig = {
  rendimento: { label: 'Rendimento Líquido (R$)', color: 'hsl(var(--primary))' },
}

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

const calculateInvestmentMetrics = (inv: any) => {
  const prod = inv.investment_products || {}
  const unitPrice = inv.unit_price || prod.quota_value || 1000
  const activeQuotas = inv.quotas - (inv.redeemed_quotas || 0)
  const principal = activeQuotas * unitPrice

  const startDate = new Date(inv.transfer_date || inv.created_at)
  const today = new Date()
  const daysElapsed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 3600 * 24))

  const rateMatch = prod.rate?.match(/(\d+[.,]\d+|\d+)/)
  const numericRate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 10
  const annualRate = numericRate / 100

  const yieldAmount =
    principal > 0 ? principal * Math.pow(1 + annualRate, daysElapsed / 365) - principal : 0

  let irRate = 0.225
  if (daysElapsed > 720) irRate = 0.15
  else if (daysElapsed > 360) irRate = 0.175
  else if (daysElapsed > 180) irRate = 0.2

  const estimatedIR = yieldAmount * irRate
  const netYield = yieldAmount - estimatedIR
  const netValue = principal + netYield

  return {
    principal,
    yieldAmount,
    estimatedIR,
    netYield,
    netValue,
    daysElapsed,
    annualRate,
    activeQuotas,
    unitPrice,
  }
}

export default function InvestorDashboard() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [myInvestments, setMyInvestments] = useState<any[]>([])
  const [myRedemptions, setMyRedemptions] = useState<any[]>([])

  const [redemptionInv, setRedemptionInv] = useState<any>(null)
  const [redemptionType, setRedemptionType] = useState<'total' | 'capital' | 'rendimentos'>('total')
  const [redeemQuotas, setRedeemQuotas] = useState<number>(1)
  const [savingRedemption, setSavingRedemption] = useState(false)

  const [detailsInv, setDetailsInv] = useState<any>(null)

  const [metrics, setMetrics] = useState({
    totalInvested: 0,
    totalPatrimony: 0,
    grossYield: 0,
    estimatedIR: 0,
    netYield: 0,
    yieldPercentage: 0,
    nextAmortizationDate: '',
    topSeries: 'Nenhuma',
    topIndexer: '-',
    chartData: [] as any[],
    walletBalance: 0,
  })

  const fetchDashboardData = useCallback(async () => {
    if (!profile?.document_number || !user) {
      setLoading(false)
      return
    }

    try {
      const [investmentsRes, redemptionsRes, profileRes] = await Promise.all([
        supabase
          .from('investments')
          .select('*, investment_products(*), debenture_subscriptions(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('investment_redemptions')
          .select('*, investments(investment_products(title))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('wallet_balance').eq('id', user.id).single(),
      ])

      setMyInvestments(investmentsRes.data || [])
      setMyRedemptions(redemptionsRes.data || [])

      let totalInvested = 0
      let totalGrossYield = 0
      let totalEstimatedIR = 0
      let totalNetYield = 0
      let maxInvestment = 0
      let topSeries = 'Nenhuma'
      let topIndexer = '-'

      const activeInvs =
        investmentsRes.data?.filter(
          (i) =>
            !['cancelled', 'rejected', 'Excluído'].includes(i.status) && i.status !== 'resgatado',
        ) || []

      activeInvs.forEach((inv) => {
        if (inv.status === 'approved') {
          const m = calculateInvestmentMetrics(inv)
          totalInvested += m.principal
          totalGrossYield += m.yieldAmount
          totalEstimatedIR += m.estimatedIR
          totalNetYield += m.netYield

          if (m.principal > maxInvestment) {
            maxInvestment = m.principal
            topSeries = inv.investment_products?.title || 'Série'
            topIndexer = inv.investment_products?.rate || '-'
          }
        }
      })

      const totalPatrimony = totalInvested + totalNetYield
      const yieldPercentage = totalInvested > 0 ? (totalNetYield / totalInvested) * 100 : 0

      // Chart mock progression
      const chartData = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        let monthYield = 0
        activeInvs.forEach((inv: any) => {
          if (inv.status === 'approved') {
            const subDate = new Date(inv.transfer_date || inv.created_at)
            if (subDate <= d) {
              const days = Math.max(0, (d.getTime() - subDate.getTime()) / (1000 * 3600 * 24))
              const rateMatch = inv.investment_products?.rate?.match(/(\d+[.,]\d+|\d+)/)
              const numRate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) / 100 : 0.1
              const amount = inv.quotas * (inv.unit_price || 1000)
              monthYield += (amount * Math.pow(1 + numRate, days / 365) - amount) * 0.8
            }
          }
        })
        chartData.push({
          name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          rendimento: monthYield,
        })
      }

      setMetrics({
        totalInvested,
        totalPatrimony,
        grossYield: totalGrossYield,
        estimatedIR: totalEstimatedIR,
        netYield: totalNetYield,
        yieldPercentage,
        nextAmortizationDate: '',
        topSeries,
        topIndexer,
        chartData,
        walletBalance: profileRes.data?.wallet_balance || 0,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [profile, user])

  useEffect(() => {
    fetchDashboardData()

    if (!user) return

    const channel1 = supabase
      .channel(`investments-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investments', filter: `user_id=eq.${user.id}` },
        () => {
          fetchDashboardData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel1)
    }
  }, [fetchDashboardData, user])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const openRedemption = (inv: any) => {
    const prod = inv.investment_products
    if (!prod) return

    if (!prod.allow_early_redemption) {
      return toast.info(
        'Este produto não permite resgate antecipado. A liquidação ocorrerá automaticamente no vencimento.',
      )
    }

    setRedemptionType('total')
    setRedemptionInv(inv)
  }

  useEffect(() => {
    if (!redemptionInv) return
    const m = calculateInvestmentMetrics(redemptionInv)

    if (redemptionType === 'total') {
      setRedeemQuotas(m.activeQuotas)
    } else if (redemptionType === 'rendimentos') {
      const quotasForYield = Math.floor(m.netYield / m.unitPrice)
      setRedeemQuotas(quotasForYield)
    } else {
      setRedeemQuotas(1)
    }
  }, [redemptionType, redemptionInv])

  const gracePeriodMet = useMemo(() => {
    if (!redemptionInv) return true
    const m = calculateInvestmentMetrics(redemptionInv)
    const monthsElapsed = m.daysElapsed / 30
    return monthsElapsed >= (redemptionInv.investment_products?.min_grace_period_months || 0)
  }, [redemptionInv])

  const redemptionMath = useMemo(() => {
    if (!redemptionInv) return null
    const prod = redemptionInv.investment_products
    const m = calculateInvestmentMetrics(redemptionInv)

    // Proportional calculation based on quotas to redeem
    const proportion = redeemQuotas / m.activeQuotas
    const principalToRedeem = m.principal * proportion
    const yieldToRedeem = m.yieldAmount * proportion

    let penalty = 0
    let discount = 0

    if (!gracePeriodMet) {
      penalty = principalToRedeem * ((prod.early_redemption_penalty_pct || 0) / 100)
      discount = yieldToRedeem * ((prod.early_redemption_discount_pct || 0) / 100)
    }

    const netValue = principalToRedeem + yieldToRedeem - penalty - discount

    return {
      principal: principalToRedeem,
      yieldAmount: yieldToRedeem,
      penalty,
      discount,
      netValue,
      gross: principalToRedeem + yieldToRedeem,
    }
  }, [redemptionInv, redeemQuotas, gracePeriodMet])

  const handleConfirmRedemption = async () => {
    if (!redemptionInv || !redemptionMath || !user) return
    setSavingRedemption(true)
    try {
      const { error } = await supabase.from('investment_redemptions').insert({
        investment_id: redemptionInv.id,
        user_id: user.id,
        requested_quotas: redeemQuotas,
        gross_value: redemptionMath.gross,
        net_value: redemptionMath.netValue,
        penalty_applied: redemptionMath.penalty,
        discount_applied: redemptionMath.discount,
        status: 'pending',
      })
      if (error) throw error
      toast.success(
        'Solicitação de resgate enviada com sucesso! Aguarde a aprovação da administração.',
      )
      setRedemptionInv(null)
      fetchDashboardData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar o resgate.')
    } finally {
      setSavingRedemption(false)
    }
  }

  const generateMonthExtract = (inv: any) => {
    if (!inv) return []
    const m = calculateInvestmentMetrics(inv)
    const startDate = new Date(inv.transfer_date || inv.created_at)
    const today = new Date()
    const extract = []
    let currentBalance = m.principal
    const monthlyRate = Math.pow(1 + m.annualRate, 1 / 12) - 1

    let d = new Date(startDate)
    d.setMonth(d.getMonth() + 1)

    while (d <= today) {
      const monthYield = currentBalance * monthlyRate
      currentBalance += monthYield
      extract.push({
        month: format(d, 'MMM/yyyy'),
        yield: monthYield,
        balance: currentBalance,
      })
      d.setMonth(d.getMonth() + 1)
    }
    return extract
  }

  const generateReceipt = async (redemptionId: string) => {
    try {
      toast.info('Gerando comprovante...')
      const { data, error } = await supabase.functions.invoke('generate-redemption-receipt', {
        body: { redemptionId },
      })
      if (error) throw error
      if (data?.url) {
        window.open(data.url, '_blank')
      }
    } catch (err: any) {
      toast.error('Erro ao gerar comprovante.')
    }
  }

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  if (!profile?.document_number)
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cadastro Incompleto</AlertTitle>
          <AlertDescription className="mt-2">
            É necessário preencher o seu CPF/CNPJ no menu de Perfil para visualizar seus
            investimentos.
          </AlertDescription>
        </Alert>
      </div>
    )

  const activeInvestments = myInvestments.filter(
    (i) =>
      i.status !== 'resgatado' &&
      i.status !== 'cancelled' &&
      i.status !== 'rejected' &&
      i.status !== 'Excluído',
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      {(profile as any)?.kyc_signature_status === 'enviado' &&
        (profile as any)?.kyc_signature_url && (
          <PendingSignatureBanner
            type="KYC (Compliance)"
            url={(profile as any).kyc_signature_url}
            onSign={() => window.open((profile as any).kyc_signature_url, '_blank')}
          />
        )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard de Rendimentos</h1>
        <p className="text-muted-foreground">
          Acompanhamento consolidado da sua carteira, rentabilidade e posição de liquidez.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">
              Patrimônio Total
            </CardTitle>
            <TrendingUp className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatCurrency(metrics.totalPatrimony)}
            </div>
            <p className="text-xs text-primary-foreground/70 mt-1">
              Aportes + Rendimentos Acumulados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rendimento Acumulado</CardTitle>
            <Receipt className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              +{formatCurrency(metrics.netYield)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              IR Retido Provisório:{' '}
              <span className="text-destructive">-{formatCurrency(metrics.estimatedIR)}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Yield Médio da Carteira</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.yieldPercentage.toFixed(2)}%</div>
            <p className="text-xs text-emerald-500 mt-1">Sobre o principal investido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível (Caixa)</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">
              {formatCurrency(metrics.walletBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Livre para saque ou novo aporte</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução Patrimonial</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          {metrics.chartData.length > 0 && metrics.totalInvested > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <AreaChart
                data={metrics.chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-rendimento)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-rendimento)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" />
                <YAxis
                  width={80}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R${(v / 1000).toFixed(1)}k` : `R${v.toFixed(0)}`
                  }
                />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="rendimento"
                  stroke="var(--color-rendimento)"
                  fillOpacity={1}
                  fill="url(#colorYield)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/10 rounded-md border border-dashed">
              <p>Nenhum investimento processado ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" /> Composição da Carteira (Ativos Granulares)
          </CardTitle>
          <CardDescription>
            Detalhamento por produto de investimento e posição atualizada de resgate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto / Série</TableHead>
                <TableHead>Aportado</TableHead>
                <TableHead>Data Início</TableHead>
                <TableHead>Rend. Bruto</TableHead>
                <TableHead>Rend. Líquido</TableHead>
                <TableHead>Imposto Prov.</TableHead>
                <TableHead className="font-bold">Valor Atual</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeInvestments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    Nenhum aporte ativo no momento.
                  </TableCell>
                </TableRow>
              ) : (
                activeInvestments.map((inv) => {
                  const sub = inv.debenture_subscriptions?.find((s: any) => s.status !== 'Excluído')
                  const displayDate = sub?.subscription_date
                    ? sub.subscription_date
                    : inv.created_at
                  const m = inv.status === 'approved' ? calculateInvestmentMetrics(inv) : null

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">
                        {inv.investment_products?.title}
                      </TableCell>
                      <TableCell className="font-mono text-primary">
                        {formatCurrency(m ? m.principal : inv.total_value)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {displayDate ? format(new Date(displayDate), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-emerald-600 font-mono">
                        {m ? `+${formatCurrency(m.yieldAmount)}` : '-'}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600 font-mono">
                        {m ? `+${formatCurrency(m.netYield)}` : '-'}
                      </TableCell>
                      <TableCell className="text-destructive font-mono text-xs">
                        {m ? `-${formatCurrency(m.estimatedIR)}` : '-'}
                      </TableCell>
                      <TableCell className="font-bold font-mono">
                        {m ? formatCurrency(m.netValue) : '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {inv.status === 'pending_transfer' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/investments/checkout/${inv.id}`)}
                            className="gap-2"
                          >
                            Enviar PIX <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                        {inv.status === 'approved' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => setDetailsInv(inv)}
                              title="Extrato Detalhado"
                            >
                              <List className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="default" onClick={() => openRedemption(inv)}>
                              <ArrowDownToLine className="h-4 w-4 mr-1" /> Resgatar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de Resgates e Tesouraria
          </CardTitle>
          <CardDescription>
            Acompanhe o processamento das suas solicitações de resgate de capital e rendimentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cotas</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Data Solicitação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Comprovante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRedemptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum resgate solicitado.
                  </TableCell>
                </TableRow>
              ) : (
                myRedemptions.map((red) => (
                  <TableRow key={red.id}>
                    <TableCell className="font-medium">
                      {red.investments?.investment_products?.title}
                    </TableCell>
                    <TableCell>{red.requested_quotas}</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-600">
                      {formatCurrency(red.net_value)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {red.created_at ? format(new Date(red.created_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {red.status === 'paid' ? (
                        <Badge className="bg-emerald-500">Liquidado em Caixa</Badge>
                      ) : red.status === 'approved' ? (
                        <Badge className="bg-primary">Aprovado (Processando)</Badge>
                      ) : red.status === 'rejected' ? (
                        <Badge variant="destructive">Rejeitado</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-800 border-amber-200"
                        >
                          Em Análise
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {red.status === 'paid' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generateReceipt(red.id)}
                          title="Baixar Comprovante PDF"
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!redemptionInv} onOpenChange={(v) => !v && setRedemptionInv(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ArrowDownToLine className="h-5 w-5 text-primary" /> Módulo de Resgate e Liquidez
            </DialogTitle>
            <DialogDescription>{redemptionInv?.investment_products?.title}</DialogDescription>
          </DialogHeader>

          {redemptionInv && redemptionMath && (
            <div className="space-y-4 py-2">
              {!gracePeriodMet && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Período de Carência Ativo</AlertTitle>
                  <AlertDescription>
                    O período mínimo de {redemptionInv.investment_products?.min_grace_period_months}{' '}
                    meses não foi atingido. O resgate antecipado sofrerá aplicação de deságio e
                    penalidades.
                  </AlertDescription>
                </Alert>
              )}

              <Tabs
                value={redemptionType}
                onValueChange={(v: any) => setRedemptionType(v)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="total">Resgate Total</TabsTrigger>
                  <TabsTrigger value="capital">Parcial (Cotas)</TabsTrigger>
                  <TabsTrigger value="rendimentos">Apenas Rendimentos</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <Label>Quantidade de Cotas a Resgatar</Label>
                <div className="flex gap-4 items-center">
                  <Input
                    type="number"
                    min={1}
                    max={calculateInvestmentMetrics(redemptionInv).activeQuotas}
                    value={redeemQuotas}
                    disabled={redemptionType !== 'capital'}
                    onChange={(e) => setRedeemQuotas(Number(e.target.value))}
                    className="w-32 text-lg text-center"
                  />
                  <span className="text-sm text-muted-foreground">
                    Máximo disponível: {calculateInvestmentMetrics(redemptionInv).activeQuotas}{' '}
                    cotas
                  </span>
                </div>
                {redemptionType === 'rendimentos' && redeemQuotas === 0 && (
                  <p className="text-sm text-destructive font-medium mt-1">
                    O rendimento líquido acumulado não atinge o valor de 1 cota mínima para resgate
                    avulso.
                  </p>
                )}
              </div>

              <div className="bg-muted/20 border rounded-lg p-4 space-y-3 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Principal (Capital)</span>
                  <span className="font-mono">{formatCurrency(redemptionMath.principal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rendimento Acumulado (Bruto)</span>
                  <span className="font-mono text-emerald-600">
                    +{formatCurrency(redemptionMath.yieldAmount)}
                  </span>
                </div>

                {(redemptionMath.penalty > 0 || redemptionMath.discount > 0) && (
                  <>
                    <div className="border-t my-2 border-dashed"></div>
                    <div className="text-xs text-amber-600 mb-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Resgate Antecipado - Penalidades Aplicadas
                    </div>
                    {redemptionMath.penalty > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>
                          Multa sobre Principal (
                          {redemptionInv.investment_products.early_redemption_penalty_pct}%)
                        </span>
                        <span className="font-mono">-{formatCurrency(redemptionMath.penalty)}</span>
                      </div>
                    )}
                    {redemptionMath.discount > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>
                          Desconto Deságio de Rendimento (
                          {redemptionInv.investment_products.early_redemption_discount_pct}%)
                        </span>
                        <span className="font-mono">
                          -{formatCurrency(redemptionMath.discount)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Valor Líquido a Receber</span>
                    <span className="text-primary font-mono text-xl">
                      {formatCurrency(redemptionMath.netValue)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    O valor será creditado no seu Saldo Disponível (Caixa) na aprovação.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRedemptionInv(null)}
              disabled={savingRedemption}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmRedemption}
              disabled={
                savingRedemption ||
                !redeemQuotas ||
                redeemQuotas === 0 ||
                redeemQuotas > calculateInvestmentMetrics(redemptionInv).activeQuotas
              }
            >
              {savingRedemption ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowDownToLine className="h-4 w-4 mr-2" />
              )}
              Confirmar Solicitação de Resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsInv} onOpenChange={(v) => !v && setDetailsInv(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Extrato Detalhado de Rentabilidade</DialogTitle>
            <DialogDescription>{detailsInv?.investment_products?.title}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto mt-2 pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês / Ano</TableHead>
                  <TableHead className="text-right">Rend. Mês</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailsInv && generateMonthExtract(detailsInv).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      Ainda não completou 1 mês de investimento.
                    </TableCell>
                  </TableRow>
                )}
                {detailsInv &&
                  generateMonthExtract(detailsInv).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{row.month}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-mono text-sm">
                        +{formatCurrency(row.yield)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">
                        {formatCurrency(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
