import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { Activity, Users } from 'lucide-react'
import type { SerasaConsultationRecord } from '@/services/serasa'

export function RiskDashboard({ history }: { history: SerasaConsultationRecord[] }) {
  const stats = useMemo(() => {
    if (!history.length) return { total: 0, avgScore: 0, data: [] }

    const now = new Date()
    const thisMonth = history.filter((h) => {
      const d = new Date(h.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    const total = thisMonth.length
    const avgScore =
      history.length > 0
        ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / history.length)
        : 0

    const riskCount = history.reduce(
      (acc, curr) => {
        acc[curr.risk_level] = (acc[curr.risk_level] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const data = [
      { name: 'Baixo', value: riskCount['Baixo'] || 0, fill: '#22c55e' },
      { name: 'Médio', value: riskCount['Médio'] || 0, fill: '#eab308' },
      { name: 'Alto', value: riskCount['Alto'] || 0, fill: '#ef4444' },
    ].filter((d) => d.value > 0)

    return { total, avgScore, data }
  }, [history])

  const chartConfig = {
    Baixo: { label: 'Baixo', color: '#22c55e' },
    Médio: { label: 'Médio', color: '#eab308' },
    Alto: { label: 'Alto', color: '#ef4444' },
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-fade-in-up">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Distribuição de Risco</CardTitle>
          <CardDescription>Perfil histórico geral de todas as consultas realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.data.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <PieChart>
                <Pie
                  data={stats.data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                >
                  {stats.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
              Sem dados suficientes para gerar o gráfico
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Consultas neste Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Score Médio Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgScore}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
