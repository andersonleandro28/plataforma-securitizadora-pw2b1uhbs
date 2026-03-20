import { AlertCircle, CalendarDays, CreditCard, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Progress } from '@/components/ui/progress'

const debtData = [
  { name: 'Jul', divida: 150000 },
  { name: 'Ago', divida: 140000 },
  { name: 'Set', divida: 130000 },
  { name: 'Out', divida: 120000 },
  { name: 'Nov', divida: 110000 },
  { name: 'Dez', divida: 100000 },
]

const chartConfig = {
  divida: { label: 'Saldo Devedor (R$)', color: 'hsl(var(--destructive))' },
}

export default function BorrowerDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Portal do Tomador</h1>
        <p className="text-muted-foreground">
          Acompanhamento das suas obrigações e limite de crédito atual.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Limite de Crédito</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 500.000,00</div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Utilizado: R$ 120.000 (24%)</span>
                <span>Disponível: R$ 380.000</span>
              </div>
              <Progress value={24} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Próximo Vencimento</CardTitle>
            <CalendarDays className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">R$ 10.000,00</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Vence em 05/Nov/2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Borderôs em Análise</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 Lotes</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Aguardando validação Sefaz
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução do Saldo Devedor</CardTitle>
          <CardDescription>Acompanhamento das liquidações nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <BarChart data={debtData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `R$${value / 1000}k`} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="divida" fill="var(--color-divida)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
