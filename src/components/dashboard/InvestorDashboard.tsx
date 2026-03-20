import { Wallet, TrendingUp, Landmark, PieChart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

const yieldData = [
  { name: 'Jul', rendimento: 1.12 },
  { name: 'Ago', rendimento: 1.15 },
  { name: 'Set', rendimento: 1.08 },
  { name: 'Out', rendimento: 1.21 },
  { name: 'Nov', rendimento: 1.19 },
  { name: 'Dez', rendimento: 1.25 },
]

const chartConfig = {
  rendimento: { label: 'Rendimento (%)', color: 'hsl(var(--primary))' },
}

export default function InvestorDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel do Investidor</h1>
        <p className="text-muted-foreground">Acompanhamento do seu portfólio e rendimentos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Patrimônio Investido</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 1.250.000,00</div>
            <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12.5% em 12 meses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próxima Amortização</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 45.000,00</div>
            <p className="text-xs text-muted-foreground mt-1">Previsto para 15/Out/2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Série Alocada</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Série Sênior</div>
            <p className="text-xs text-muted-foreground mt-1">Indexador: CDI + 2.5% a.a.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Rentabilidade</CardTitle>
          <CardDescription>
            Evolução mensal dos juros líquidos creditados na sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <AreaChart data={yieldData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-rendimento)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-rendimento)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${value}%`} />
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
        </CardContent>
      </Card>
    </div>
  )
}
