import { useState, useEffect } from 'react'
import {
  Calculator,
  AlertTriangle,
  CalendarDays,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeedUploadDialog } from '@/components/debentures/DeedUploadDialog'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'

import { SeriesListTab } from '@/components/debentures/SeriesListTab'
import { HistoryTab } from '@/components/debentures/HistoryTab'

export default function Debentures() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [debentures, setDebentures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
  const totalSeries = debentures.reduce((sum, deb) => sum + deb.series.length, 0)

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Debêntures</h1>
          <p className="text-muted-foreground">
            Controle de emissões, extração inteligente de escrituras e análise de portfólio.
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
            <FileUp className="h-4 w-4" /> Upload de Escritura
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto justify-start">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Dashboard de Emissões
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico e Documentos
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-2">
            <ListFilter className="h-4 w-4" /> Visão de Séries
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" /> Calculadora PU
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
                    <CardTitle className="text-sm font-medium">Volume Total Emitido</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Acompanhamento consolidado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Séries Ativas</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalSeries}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Em {totalDocuments} escrituras processadas
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
                    <p className="text-xs text-muted-foreground mt-1">Indicador de pulverização</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Volume por Indexador</CardTitle>
                    <CardDescription>Distribuição de risco do portfólio.</CardDescription>
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
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                        Sem dados suficientes
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Alertas e Insights</CardTitle>
                    <CardDescription>Análise preditiva e sugestões.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert
                      variant="destructive"
                      className="bg-warning/10 text-warning-foreground border-warning/50"
                    >
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <AlertTitle className="text-warning font-bold">
                        Alerta ALM de Curto Prazo
                      </AlertTitle>
                      <AlertDescription className="text-foreground/80 mt-1 text-xs">
                        O vencimento médio do lastro (45 dias) está inferior à próxima amortização
                        programada. Provisione caixa na tesouraria.
                      </AlertDescription>
                    </Alert>
                    <div className="rounded-md border p-4 bg-muted/30">
                      <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" /> Dica de Exportação
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Utilize o botão "Exportar Lote" no topo da tela para gerar um relatório CSV
                        consolidado de todas as emissões, ideal para reports gerenciais.
                      </p>
                    </div>
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
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-t-4 border-t-accent">
              <CardHeader>
                <CardTitle>Série 1 - Sênior</CardTitle>
                <CardDescription>Indexador: CDI + 2.5% a.a.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume Emitido</span>
                  <span className="font-mono font-medium">R$ 50.000.000,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">PU Atual Atualizado</span>
                  <span className="font-mono font-bold text-accent">1.045,32190</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Próxima Amortização</span>
                  <span className="text-sm">15/Out/2024</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle>Série 2 - Subordinada</CardTitle>
                <CardDescription>Indexador: IPCA + 6.0% a.a.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Volume Emitido</span>
                  <span className="font-mono font-medium">R$ 15.000.000,00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">PU Atual Atualizado</span>
                  <span className="font-mono font-bold text-primary">1.102,88410</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Próxima Amortização</span>
                  <span className="text-sm">No Vencimento (Bullet)</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Calculadora de PU
                </CardTitle>
                <CardDescription>Simulação de marcação a mercado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Data Base</Label>
                  <Input type="date" defaultValue="2024-10-01" />
                </div>
                <div className="space-y-2">
                  <Label>Taxa CDI Projetada (%)</Label>
                  <Input type="number" defaultValue="10.5" step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label>Spread Contratual (%)</Label>
                  <Input type="number" defaultValue="2.5" disabled />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Simular PU</Button>
              </CardFooter>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Cronograma de Amortização (Série 1)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Data Prevista</TableHead>
                      <TableHead>Juros (Estimado)</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="opacity-50">
                      <TableCell>Pagamento #01</TableCell>
                      <TableCell>15/Jul/2024</TableCell>
                      <TableCell className="font-mono text-xs">R$ 450.000</TableCell>
                      <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                      <TableCell>Liquidado</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-medium">Pagamento #02</TableCell>
                      <TableCell>15/Out/2024</TableCell>
                      <TableCell className="font-mono text-xs">R$ 445.000</TableCell>
                      <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                      <TableCell className="text-warning font-medium">A Vencer</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Pagamento #03</TableCell>
                      <TableCell>15/Jan/2025</TableCell>
                      <TableCell className="font-mono text-xs">R$ 430.000</TableCell>
                      <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                      <TableCell>Projetado</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
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
