import { ArrowUpRight, TrendingUp, AlertOctagon, Scale, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

const cashFlowData = [
  { name: 'Jan', in: 4000, out: 2400 },
  { name: 'Fev', in: 3000, out: 1398 },
  { name: 'Mar', in: 2000, out: 9800 },
  { name: 'Abr', in: 2780, out: 3908 },
  { name: 'Mai', in: 1890, out: 4800 },
  { name: 'Jun', in: 2390, out: 3800 },
]

const chartConfig = {
  in: { label: 'Recebimentos (Lastro)', color: 'hsl(var(--secondary))' },
  out: { label: 'Pagamentos (Obrigações)', color: 'hsl(var(--accent))' },
}

export default function Index() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do fundo e saúde financeira.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">R$ 145.2M</div>
            <p className="text-xs text-secondary mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> +2.5% este mês
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status ALM</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">Positivo</div>
            <p className="text-xs text-muted-foreground mt-1">Cobertura de 115% no Curto Prazo</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PDL Médio (Atrasos)</CardTitle>
            <AlertOctagon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">2.4%</div>
            <p className="text-xs text-muted-foreground mt-1">Meta tolerável: &lt; 5.0%</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liq. Pendente Hoje</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">R$ 840k</div>
            <p className="text-xs text-muted-foreground mt-1">12 títulos aguardando baixa</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Projeção de Fluxo de Caixa (ALM)</CardTitle>
            <CardDescription>Recebimentos vs Amortizações (Próximos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-in)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-in)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-out)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-out)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `R$${value / 1000}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="var(--color-in)"
                  fillOpacity={1}
                  fill="url(#colorIn)"
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="var(--color-out)"
                  fillOpacity={1}
                  fill="url(#colorOut)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>AI Insights & Concentração</CardTitle>
            <CardDescription>Análises automatizadas do portfólio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Risco Jurídico Elevado</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Padrão de litígio trabalhista detectado em <strong>Cedente X</strong>. Sugerida
                suspensão de novas aquisições.
              </AlertDescription>
            </Alert>

            <div>
              <h4 className="text-sm font-medium mb-2">Concentração por Setor (Top 3)</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  <span className="text-xs w-20 text-right">Agro (45%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full" style={{ width: '30%' }}></div>
                  </div>
                  <span className="text-xs w-20 text-right">Indústria (30%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-warning h-2 rounded-full" style={{ width: '15%' }}></div>
                  </div>
                  <span className="text-xs w-20 text-right">Varejo (15%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
