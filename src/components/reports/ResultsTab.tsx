import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { ConsolidatedIndicators } from './ConsolidatedIndicators'

export function ResultsTab() {
  const [data, setData] = useState<any[]>([])

  const loadData = async () => {
    const [calcsRes, recRes] = await Promise.all([
      supabase
        .from('operation_calculations')
        .select(`*, credit_operations!inner ( issue_date, receivable_type, status )`)
        .not('credit_operations.status', 'in', '("cancelado","excluido","reprovado")'),
      supabase
        .from('recebiveis_ccb')
        .select('*')
        .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")'),
    ])

    const grouped: Record<string, any> = {}

    const getPeriod = (dateStr: string) => {
      const date = new Date(dateStr)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    const addGroup = (period: string, bruta: number, taxaEmissao: number, funding: number) => {
      if (!grouped[period]) {
        grouped[period] = { period, bruta: 0, taxaEmissao: 0, funding: 0, liquida: 0 }
      }
      grouped[period].bruta += bruta
      grouped[period].taxaEmissao += taxaEmissao
      grouped[period].funding += funding
      grouped[period].liquida += bruta - taxaEmissao - funding
    }

    if (calcsRes.data) {
      calcsRes.data.forEach((c) => {
        const op = Array.isArray(c.credit_operations) ? c.credit_operations[0] : c.credit_operations
        const dateStr = op?.issue_date || c.calculated_at
        if (!dateStr) return

        const period = getPeriod(dateStr)
        const receitaBruta =
          Number(c.interest_value || 0) +
          Number(c.ad_valorem_value || 0) +
          Number(c.structuring_value || 0) +
          Number(c.discount_value || 0)
        const taxaEmissao = Number(c.analysis_value || 0)
        const funding = receitaBruta * 0.5 // Estimated funding cost

        addGroup(period, receitaBruta, taxaEmissao, funding)
      })
    }

    if (recRes.data) {
      recRes.data.forEach((rec: any) => {
        if (!rec.created_at) return
        const period = getPeriod(rec.created_at)
        const totalFace = Number(rec.boleto_count || 0) * Number(rec.boleto_unit_value || 0)
        const acq = Number(rec.acquisition_value || 0)
        const receitaBruta = Number(rec.gross_profit || Math.max(0, totalFace - acq))
        const taxaEmissao = receitaBruta * 0.1
        const funding = receitaBruta * 0.5

        addGroup(period, receitaBruta, taxaEmissao, funding)
      })
    }

    setData(Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period)))
  }

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('results_tab_table')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operation_calculations' },
        loadData,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, loadData)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleExport = () => {
    const csvData = data.map((d) => ({
      Período: d.period,
      'Receita Bruta': d.bruta,
      'Taxas de Emissão': d.taxaEmissao,
      'Custo de Funding (Est.)': d.funding,
      'Resultado Líquido': d.liquida,
    }))
    exportToCSV(csvData, 'resultado_liquido.csv')
  }

  return (
    <div className="space-y-6">
      <ConsolidatedIndicators />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resultado Líquido e Receita Bruta (Mensal)</CardTitle>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Período</th>
                  <th className="p-3">Receita Bruta</th>
                  <th className="p-3">Taxas de Emissão</th>
                  <th className="p-3">Funding (Est.)</th>
                  <th className="p-3">Resultado Líquido</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 font-medium">{item.period}</td>
                    <td className="p-3">{formatCurrency(item.bruta)}</td>
                    <td className="p-3 text-red-500">-{formatCurrency(item.taxaEmissao)}</td>
                    <td className="p-3 text-red-500">-{formatCurrency(item.funding)}</td>
                    <td className="p-3 font-bold text-green-600">{formatCurrency(item.liquida)}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-center">
                      Nenhum registro encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
