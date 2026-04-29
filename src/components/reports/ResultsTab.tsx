import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export function ResultsTab() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data: calcs } = await supabase.from('operation_calculations').select(`
          *,
          credit_operations ( issue_date, receivable_type )
        `)

      if (calcs) {
        const grouped: Record<string, any> = {}
        calcs.forEach((c) => {
          const dateStr = c.credit_operations?.issue_date || c.calculated_at
          if (!dateStr) return

          const date = new Date(dateStr)
          const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

          if (!grouped[period]) {
            grouped[period] = { period, bruta: 0, taxaEmissao: 0, funding: 0, liquida: 0 }
          }

          const receitaBruta =
            Number(c.interest_value || 0) +
            Number(c.ad_valorem_value || 0) +
            Number(c.structuring_value || 0) +
            Number(c.discount_value || 0)
          const taxaEmissao = Number(c.analysis_value || 0)
          const funding = receitaBruta * 0.5

          grouped[period].bruta += receitaBruta
          grouped[period].taxaEmissao += taxaEmissao
          grouped[period].funding += funding
          grouped[period].liquida += receitaBruta - taxaEmissao - funding
        })

        setData(Object.values(grouped).sort((a, b) => b.period.localeCompare(a.period)))
      }
    }
    loadData()
  }, [])

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
                  <td className="p-3">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.bruta,
                    )}
                  </td>
                  <td className="p-3 text-red-500">
                    -
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.taxaEmissao,
                    )}
                  </td>
                  <td className="p-3 text-red-500">
                    -
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.funding,
                    )}
                  </td>
                  <td className="p-3 font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.liquida,
                    )}
                  </td>
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
  )
}
