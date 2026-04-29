import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { DollarSign, Percent, Clock, AlertTriangle } from 'lucide-react'

export function DashboardTab() {
  const [metrics, setMetrics] = useState({
    aum: 0,
    duration: 0,
    avgRate: 0,
    pdd: 0,
  })

  useEffect(() => {
    async function loadData() {
      const { data: ops } = await supabase
        .from('credit_operations')
        .select('*, operation_calculations(effective_cost_rate)')
        .not('status', 'in', '("cancelado","excluido")')

      if (!ops) return

      let totalAum = 0
      let totalDays = 0
      let weightedRate = 0
      let overdueAmount = 0
      const now = new Date().getTime()

      ops.forEach((op) => {
        const value = Number(op.face_value || 0)
        totalAum += value

        const issue = new Date(op.issue_date || op.created_at).getTime()
        const due = new Date(op.due_date).getTime()
        const duration = Math.max(0, (due - issue) / (1000 * 60 * 60 * 24))
        totalDays += duration * value

        const rate = Number(op.operation_calculations?.effective_cost_rate || 0)
        weightedRate += rate * value

        if (due < now && op.status !== 'liquidado') {
          overdueAmount += value
        }
      })

      setMetrics({
        aum: totalAum,
        duration: totalAum > 0 ? totalDays / totalAum : 0,
        avgRate: totalAum > 0 ? weightedRate / totalAum : 0,
        pdd: totalAum > 0 ? (overdueAmount / totalAum) * 100 : 0,
      })
    }
    loadData()
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total em Aberto (AUM)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              metrics.aum,
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Prazo Médio (Duration)</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(metrics.duration)} dias</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa Média da Carteira</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.avgRate.toFixed(2)}% a.m.</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Índice de Inadimplência (PDD)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.pdd.toFixed(2)}%</div>
        </CardContent>
      </Card>
    </div>
  )
}
