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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeedUploadDialog } from '@/components/debentures/DeedUploadDialog'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { SeriesListTab } from '@/components/debentures/SeriesListTab'
import { HistoryTab } from '@/components/debentures/HistoryTab'

export default function Debentures() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [debentures, setDebentures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('')

  const fetchDebentures = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('debentures')
        .select(
          `id, issuer_name, total_volume, issue_date, created_at, debenture_series (id, series_number, volume, indexer, rate, maturity_date)`,
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

  const chartData = Object.keys(volumeByIndexer).map((indexer) => ({
    name: indexer,
    volume: volumeByIndexer[indexer],
  }))

  const chartConfig = { volume: { label: 'Volume (R$)', color: 'hsl(var(--primary))' } }

  const exportToCSV = () => {
    const headers = [
      'Emissor',
      'Data Emissão',
      'Volume Total',
      'Número da Série',
      'Indexador',
      'Taxa (%)',
      'Volume da Série',
      'Vencimento',
      'Processado Em',
    ]
    const rows = debentures.flatMap((deb) =>
      deb.series.map((s: any) => [
        `"${deb.issuer_name}"`,
        deb.issue_date ? format(new Date(deb.issue_date), 'dd/MM/yyyy') : '',
        deb.total_volume,
        `"${s.series_number}"`,
        `"${s.indexer}"`,
        s.rate,
        s.volume,
        s.maturity_date ? format(new Date(s.maturity_date), 'dd/MM/yyyy') : '',
        format(new Date(deb.created_at), 'dd/MM/yyyy HH:mm:ss'),
      ]),
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
            Extração real de escrituras e análise de portfólio via IA.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="gap-2"
            disabled={debentures.length === 0}
          >
            <Download className="h-4 w-4" /> Exportar Lote
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="gap-2 shadow-sm">
            <FileUp className="h-4 w-4" /> Processar Escritura
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto justify-start">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico de Uploads
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-2">
            <ListFilter className="h-4 w-4" /> Visão de Séries
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
              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Volume Total Extraído</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Monitoramento consolidado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Séries Identificadas</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSeries}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em {totalDocuments} escritura(s) real(is) processada(s)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Médio por Série</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {totalSeries > 0 ? formatCurrency(totalVolume / totalSeries) : 'R$ 0,00'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Indicador de pulverização real
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Volume por Indexador</CardTitle>
                    <CardDescription>Distribuição real extraída do portfólio.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {chartData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart
                          data={chartData}
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
                        Faça o upload da primeira escritura para visualizar o gráfico.
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Alertas Automáticos</CardTitle>
                    <CardDescription>Análise viva com base nas séries ativas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {debentures.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-10 bg-muted/20 rounded-md">
                        Nenhum dado processado ainda.
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const nearMaturity = allSeries.filter((s) => {
                            if (!s.maturity_date) return false
                            const days =
                              (new Date(s.maturity_date).getTime() - new Date().getTime()) /
                              (1000 * 3600 * 24)
                            return days > 0 && days <= 60
                          })

                          if (nearMaturity.length > 0) {
                            return (
                              <Alert
                                variant="destructive"
                                className="bg-warning/10 text-warning-foreground border-warning/50"
                              >
                                <AlertTriangle className="h-4 w-4 text-warning" />
                                <AlertTitle className="text-warning font-bold">
                                  Vencimentos Próximos
                                </AlertTitle>
                                <AlertDescription className="text-foreground/80 mt-1 text-xs">
                                  Existem {nearMaturity.length} série(s) real(is) com vencimento em
                                  menos de 60 dias. Verifique o cronograma.
                                </AlertDescription>
                              </Alert>
                            )
                          }
                          return (
                            <Alert className="bg-primary/10 border-primary/20 text-primary">
                              <AlertTitle className="text-sm font-semibold">
                                Portfólio Saudável
                              </AlertTitle>
                              <AlertDescription className="text-xs mt-1">
                                Nenhuma série com vencimento crítico no curto prazo.
                              </AlertDescription>
                            </Alert>
                          )
                        })()}
                        <div className="rounded-md border p-4 bg-muted/30">
                          <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                            <Download className="h-3.5 w-3.5" /> Integração e Dados
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            As {totalSeries} séries lidas da base estão prontas para exportação CSV.
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab debentures={debentures} loading={loading} formatCurrency={formatCurrency} />
        </TabsContent>

        <TabsContent value="series">
          <SeriesListTab
            debentures={debentures}
            loading={loading}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calculadora de PU Baseada em Extração</CardTitle>
              <CardDescription>
                Selecione uma série real processada da base para simulação de marcação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allSeries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-md border border-dashed">
                  Aguardando processamento. Nenhuma série extraída disponível.
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
                            <span className="text-sm text-muted-foreground">Indexador Real</span>
                            <span className="font-medium text-sm">
                              {selectedSeries.indexer} + {selectedSeries.rate}% a.a.
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-2">
                            <span className="text-sm text-muted-foreground">Volume Extraído</span>
                            <span className="font-mono font-medium">
                              {formatCurrency(selectedSeries.volume)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Vencimento Lido</span>
                            <span className="text-sm font-medium">
                              {selectedSeries.maturity_date
                                ? format(new Date(selectedSeries.maturity_date), 'dd/MM/yyyy')
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
    </div>
  )
}
