import { useState, useEffect } from 'react'
import { RefreshCw, DollarSign, TrendingUp, Calendar, FileText, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const riskData = [
  { name: 'AAA', value: 40, fill: '#22c55e' },
  { name: 'AA', value: 30, fill: '#84cc16' },
  { name: 'A', value: 15, fill: '#eab308' },
  { name: 'BBB', value: 10, fill: '#f97316' },
  { name: 'BB', value: 5, fill: '#ef4444' },
]

const riskConfig = {
  value: { label: 'Participação' },
}

const issuerData = [
  { name: 'Emissor A', exposure: 15000000 },
  { name: 'Emissor B', exposure: 10000000 },
  { name: 'Emissor C', exposure: 8000000 },
]

const issuerConfig = {
  exposure: { label: 'Exposição', color: 'hsl(var(--primary))' },
}

const tableData = [
  { id: 1, date: '15/06/2026', issuer: 'Construtora Alpha', amount: 500000, status: 'A Vencer' },
  { id: 2, date: '20/06/2026', issuer: 'Tech Solutions SA', amount: 300000, status: 'A Vencer' },
  { id: 3, date: '25/06/2026', issuer: 'Agro Investimentos', amount: 150000, status: 'A Vencer' },
  { id: 4, date: '05/07/2026', issuer: 'Logística Brasil', amount: 800000, status: 'A Vencer' },
  { id: 5, date: '10/07/2026', issuer: 'Varejo Center', amount: 250000, status: 'A Vencer' },
]

const cards = [
  {
    title: 'Total AUM',
    icon: DollarSign,
    value: 'R$ 0,00',
    sub: 'Soma de todas as emissões',
    delay: '0ms',
  },
  {
    title: 'Receita Estimada (Fees)',
    icon: TrendingUp,
    value: 'R$ 0,00/mês',
    sub: 'Projeção mensal',
    delay: '50ms',
  },
  {
    title: 'PDL Médio',
    icon: Calendar,
    value: '0 meses',
    sub: 'Prazo médio ponderado',
    delay: '100ms',
  },
  { title: 'Escrituras Base', icon: FileText, value: '0', sub: 'Emissões ativas', delay: '150ms' },
]

type Status = 'loading' | 'success' | 'error' | 'empty'

export default function Index() {
  const [status, setStatus] = useState<Status>('loading')

  const fetchData = () => {
    setStatus('loading')
    setTimeout(() => setStatus('success'), 1500)
  }

  useEffect(() => fetchData(), [])

  return (
    <div className="flex flex-col gap-6 p-6 w-full animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Visão geral do fundo e saúde financeira</p>
        </div>
        <Button onClick={fetchData} disabled={status === 'loading'}>
          <RefreshCw className={cn('w-4 h-4 mr-2', status === 'loading' && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>Falha ao carregar os dados do dashboard.</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="w-fit">
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {status === 'empty' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sem Dados</AlertTitle>
          <AlertDescription>Nenhum dado disponível no momento.</AlertDescription>
        </Alert>
      )}

      {(status === 'loading' || status === 'success') && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {status === 'loading' ? (
                    <div className="space-y-2 mt-1">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <div className="animate-fade-in-up" style={{ animationDelay: card.delay }}>
                      <div className="text-2xl font-bold">{card.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Risco da Carteira</CardTitle>
                <CardDescription>Distribuição por rating</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {status === 'loading' ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <Skeleton className="h-48 w-48 rounded-full" />
                  </div>
                ) : (
                  <div
                    className="h-[300px] w-full animate-fade-in-up"
                    style={{ animationDelay: '200ms' }}
                  >
                    <ChartContainer config={riskConfig} className="h-full w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          data={riskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {riskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                      </PieChart>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Top 3 Emissores</CardTitle>
                <CardDescription>Maiores exposições (R$)</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {status === 'loading' ? (
                  <div className="space-y-4 pt-4 h-[300px]">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-[90%]" />
                    <Skeleton className="h-12 w-[80%]" />
                  </div>
                ) : (
                  <div
                    className="h-[300px] w-full animate-fade-in-up"
                    style={{ animationDelay: '250ms' }}
                  >
                    <ChartContainer config={issuerConfig} className="h-full w-full">
                      <BarChart data={issuerData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(0)}M`}
                        />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                            />
                          }
                        />
                        <Bar
                          dataKey="exposure"
                          fill="var(--color-exposure)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volume Vencendo (Próximos 30 dias)</CardTitle>
              <CardDescription>Próximas parcelas e amortizações a vencer</CardDescription>
            </CardHeader>
            <CardContent>
              {status === 'loading' ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Emissor</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.issuer}</TableCell>
                          <TableCell className="text-right">
                            R$ {row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-end space-x-2 py-4">
                    <Button variant="outline" size="sm" disabled>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
