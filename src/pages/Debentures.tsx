import { useState, useEffect } from 'react'
import {
  Calculator,
  AlertTriangle,
  FileUp,
  Download,
  History,
  BarChart3,
  TrendingUp,
  Layers,
  FileText,
  Loader2,
  ListFilter,
  FileSignature,
  DollarSign,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeedUploadDialog } from '@/components/debentures/DeedUploadDialog'
import { ManualDeedDialog } from '@/components/debentures/ManualDeedDialog'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import { supabase } from '@/lib/supabase/client'
import { format, isBefore, addDays } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { SeriesListTab } from '@/components/debentures/SeriesListTab'
import { HistoryTab } from '@/components/debentures/HistoryTab'

const formatDateStr = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export default function Debentures() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [debentures, setDebentures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('')

  const fetchDebentures = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('debentures')
        .select(
          `id, issuer_name, total_volume, issue_date, created_at, 
           debenture_series (
             id, series_number, volume, indexer, rate, maturity_date,
             debenture_subscriptions (id, investor_name, document_number, quantity, unit_price, total_amount, subscription_date)
           )`,
        )
        .order('created_at', { ascending: false })
      if (!error && data) {
        setDebentures(data.map((d: any) => ({ ...d, series: d.debenture_series || [] })))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebentures()
  }, [])

  const totalVolume = debentures.reduce((sum, deb) => sum + Number(deb.total_volume), 0)
  const totalDocuments = debentures.length

  const allSeries = debentures.flatMap((d) =>
    (d.series || []).map((s: any) => ({ ...s, issuer_name: d.issuer_name })),
  )
  const totalSeries = allSeries.length

  const totalSubscribed = allSeries.reduce((sum, s) => {
    const subsSum = (s.debenture_subscriptions || []).reduce(
      (acc: number, sub: any) => acc + Number(sub.total_amount),
      0,
    )
    return sum + subsSum
  }, 0)

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const volumeByIndexer = debentures.reduce(
    (acc, deb) => {
      deb.series.forEach((s: any) => {
        acc[s.indexer] = (acc[s.indexer] || 0) + Number(s.volume)
      })
      return acc
    },
    {} as Record<string, number>,
  )

  const indexerChartData = Object.keys(volumeByIndexer).map((indexer) => ({
    name: indexer,
    volume: volumeByIndexer[indexer],
  }))

  const indexerChartConfig = { volume: { label: 'Volume (R$)', color: 'hsl(var(--primary))' } }

  // Chart data for Subscriptions over time
  const subsOverTime = allSeries
    .flatMap((s) => s.debenture_subscriptions || [])
    .filter((sub) => sub.subscription_date)
  const groupedSubs = subsOverTime.reduce(
    (acc, sub) => {
      const month = sub.subscription_date.substring(0, 7) // YYYY-MM
      acc[month] = (acc[month] || 0) + Number(sub.total_amount)
      return acc
    },
    {} as Record<string, number>,
  )

  const subChartData = Object.keys(groupedSubs)
    .sort()
    .map((month) => ({
      name: month.split('-').reverse().join('/'), // MM/YYYY
      volume: groupedSubs[month],
    }))

  const subChartConfig = { volume: { label: 'Subscrições (R$)', color: 'hsl(var(--chart-2))' } }

  const exportToCSV = () => {
    const headers = [
      'Emissor',
      'Data Emissão',
      'Volume Total',
      'Série',
      'Indexador',
      'Taxa (%)',
      'Volume da Série',
      'Vencimento',
      'Total Subscrito',
      'Processado Em',
    ]
    const rows = debentures.flatMap((deb) =>
      deb.series.map((s: any) => {
        const subscrito = (s.debenture_subscriptions || []).reduce(
          (acc: number, sub: any) => acc + Number(sub.total_amount),
          0,
        )
        return [
          `"${deb.issuer_name}"`,
          deb.issue_date ? formatDateStr(deb.issue_date) : '',
          deb.total_volume,
          `"${s.series_number}"`,
          `"${s.indexer}"`,
          s.rate,
          s.volume,
          s.maturity_date ? formatDateStr(s.maturity_date) : '',
          subscrito,
          format(new Date(deb.created_at), 'dd/MM/yyyy HH:mm:ss'),
        ]
      }),
    )
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `emissoes_debentures_${format(new Date(), 'yyyyMMdd')}.csv`
    link.click()
  }

  const selectedSeries = allSeries.find((s) => s.id === selectedSeriesId)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Debêntures</h1>
          <p className="text-muted-foreground">
            Extração de escrituras, cadastros manuais, controle de subscrições e análise de
            portfólio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2"
            disabled={debentures.length === 0}
          >
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button
            onClick={() => setManualOpen(true)}
            className="gap-2 shadow-sm"
            variant="secondary"
          >
            <FileSignature className="h-4 w-4" /> Cadastro Manual
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="gap-2 shadow-sm">
            <FileUp className="h-4 w-4" /> Processar Escritura (IA)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto justify-start">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-2">
            <ListFilter className="h-4 w-4" /> Visão de Séries e Subscrições
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico de Emissões
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" /> Calculadora e Simulação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Volume Total Emitido</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Valor de face consolidado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Volume Subscrito</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(totalSubscribed)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalVolume > 0 ? ((totalSubscribed / totalVolume) * 100).toFixed(1) : 0}% do
                      total emitido
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Séries Cadastradas</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSeries}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em {totalDocuments} escrituras
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Médio (Emissão)</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {totalSeries > 0 ? formatCurrency(totalVolume / totalSeries) : 'R$ 0,00'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Por série emitida</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Histórico de Subscrições</CardTitle>
                    <CardDescription>Volume financeiro subscrito por período.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {subChartData.length > 0 ? (
                      <ChartContainer config={subChartConfig} className="h-full w-full">
                        <LineChart
                          data={subChartData}
                          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis
                            tickFormatter={(val) => `R$${(val / 1000000).toFixed(1)}M`}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="volume"
                            stroke="var(--color-volume)"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm bg-muted/20 rounded-md">
                        Nenhuma subscrição com data registrada para gerar o gráfico.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Composição por Indexador</CardTitle>
                    <CardDescription>Distribuição do volume total emitido.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {indexerChartData.length > 0 ? (
                      <ChartContainer config={indexerChartConfig} className="h-full w-full">
                        <BarChart
                          data={indexerChartData}
                          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis
                            tickFormatter={(val) => `R$${(val / 1000000).toFixed(0)}M`}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                          />
                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                          <Bar dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm bg-muted/20 rounded-md">
                        Nenhum dado financeiro para visualizar.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Alertas Automáticos de Vencimento</CardTitle>
                  <CardDescription>Monitoramento das séries ativas e seus prazos.</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)

                    const nearMaturity = allSeries
                      .filter((s) => {
                        if (!s.maturity_date) return false
                        const matDate = new Date(s.maturity_date.split('T')[0] + 'T12:00:00')
                        return isBefore(matDate, addDays(today, 60)) && matDate > today
                      })
                      .sort(
                        (a, b) =>
                          new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime(),
                      )

                    const expired = allSeries.filter((s) => {
                      if (!s.maturity_date) return false
                      const matDate = new Date(s.maturity_date.split('T')[0] + 'T12:00:00')
                      return isBefore(matDate, today)
                    })

                    return (
                      <div className="space-y-4">
                        {expired.length > 0 && (
                          <Alert
                            variant="destructive"
                            className="bg-destructive/10 text-destructive border-destructive/20"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="font-bold">Séries Vencidas</AlertTitle>
                            <AlertDescription className="mt-2 text-sm">
                              Existem <strong>{expired.length}</strong> série(s) que já
                              ultrapassaram a data de vencimento.
                              <ul className="mt-2 list-disc list-inside pl-4 text-xs opacity-90">
                                {expired.map((s, i) => (
                                  <li key={i}>
                                    {s.issuer_name} - Série {s.series_number} (Venceu em{' '}
                                    {formatDateStr(s.maturity_date)})
                                  </li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {nearMaturity.length > 0 && (
                          <Alert className="bg-warning/10 text-warning-foreground border-warning/50">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <AlertTitle className="text-warning font-bold">
                              Vencimentos Próximos (60 dias)
                            </AlertTitle>
                            <AlertDescription className="mt-2 text-sm">
                              Existem <strong>{nearMaturity.length}</strong> série(s) com vencimento
                              se aproximando. Verifique o cronograma de resgate e juros.
                              <ul className="mt-2 list-disc list-inside pl-4 text-xs opacity-90">
                                {nearMaturity.map((s, i) => (
                                  <li key={i}>
                                    {s.issuer_name} - Série {s.series_number} (Vence em{' '}
                                    {formatDateStr(s.maturity_date)})
                                  </li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}

                        {nearMaturity.length === 0 && expired.length === 0 && (
                          <Alert className="bg-primary/10 border-primary/20 text-primary">
                            <AlertTitle className="text-sm font-semibold">
                              Cronograma Saudável
                            </AlertTitle>
                            <AlertDescription className="text-xs mt-1">
                              Nenhuma série com vencimento vencido ou crítico nos próximos 60 dias.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="series">
          <SeriesListTab
            debentures={debentures}
            loading={loading}
            formatCurrency={formatCurrency}
            onRefresh={fetchDebentures}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab
            debentures={debentures}
            loading={loading}
            formatCurrency={formatCurrency}
            onRefresh={fetchDebentures}
          />
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calculadora de PU Baseada na Base</CardTitle>
              <CardDescription>
                Selecione uma série registrada na base para simulação de marcação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allSeries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-md border border-dashed">
                  Aguardando dados. Nenhuma série disponível.
                </div>
              ) : (
                <div className="space-y-6 max-w-3xl">
                  <Select onValueChange={setSelectedSeriesId} value={selectedSeriesId}>
                    <SelectTrigger className="h-12 bg-muted/30">
                      <SelectValue placeholder="Selecione uma Série da Base..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allSeries.map((s, idx) => (
                        <SelectItem key={s.id || idx} value={s.id}>
                          {s.issuer_name} - Série {s.series_number} ({s.indexer}) -{' '}
                          {formatCurrency(s.volume)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSeries && (
                    <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4">
                      <Card className="border-t-4 border-t-primary shadow-sm bg-muted/10">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg">
                            Série {selectedSeries.series_number}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {selectedSeries.issuer_name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-sm text-muted-foreground">Indexador Base</span>
                            <span className="font-medium text-sm">
                              {selectedSeries.indexer} + {selectedSeries.rate}% a.a.
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-sm text-muted-foreground">Volume Registrado</span>
                            <span className="font-mono font-medium">
                              {formatCurrency(selectedSeries.volume)}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-sm text-muted-foreground">Volume Subscrito</span>
                            <span className="font-mono font-medium text-primary">
                              {formatCurrency(
                                (selectedSeries.debenture_subscriptions || []).reduce(
                                  (sum: number, sub: any) => sum + Number(sub.total_amount),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Vencimento</span>
                            <span className="text-sm font-medium">
                              {selectedSeries.maturity_date
                                ? formatDateStr(selectedSeries.maturity_date)
                                : '-'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Calculator className="h-4 w-4" />
                            Simulação de Marcação
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Data Base para Atualização
                            </Label>
                            <Input
                              type="date"
                              defaultValue={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <Button className="w-full">Gerar Projeção de PU</Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <DeedUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={fetchDebentures}
      />
      <ManualDeedDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSuccess={fetchDebentures}
      />
    </div>
  )
}
