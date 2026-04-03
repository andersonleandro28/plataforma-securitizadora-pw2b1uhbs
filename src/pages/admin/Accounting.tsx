import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'
import { Loader2, Download, TrendingUp, Landmark, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

export default function Accounting() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalReceitas: 0,
    totalDespesas: 0,
    impostosEstimados: 0,
    lucroLiquido: 0,
    dre: [] as any[],
    darfs: [] as any[],
  })

  useEffect(() => {
    fetchAccountingData()
  }, [])

  const fetchAccountingData = async () => {
    try {
      setLoading(true)

      const { data: operations } = await supabase
        .from('credit_operations')
        .select(
          'id, face_value, requested_value, status, operation_calculations(iof_fixed_value, iof_daily_value, total_discounts)',
        )
        .in('status', ['liquidado', 'pago', 'aprovado'])

      const { data: expenses } = await supabase.from('expenses').select('*').eq('status', 'paid')

      let receitas = 0
      let impostosIOF = 0

      operations?.forEach((op) => {
        const calc = Array.isArray(op.operation_calculations)
          ? op.operation_calculations[0]
          : op.operation_calculations
        if (calc) {
          const iof = (calc.iof_fixed_value || 0) + (calc.iof_daily_value || 0)
          receitas += (calc.total_discounts || 0) - iof
          impostosIOF += iof
        } else {
          receitas += Number(op.face_value) - Number(op.requested_value)
        }
      })

      let despesas = 0
      const despesasPorCategoria: Record<string, number> = {}
      expenses?.forEach((exp) => {
        const val = Number(exp.amount)
        despesas += val
        despesasPorCategoria[exp.category] = (despesasPorCategoria[exp.category] || 0) + val
      })

      const lucroLiquido = receitas - despesas

      const dre = [
        {
          label: 'Receita Bruta (Deságio + Taxas)',
          value: receitas + impostosIOF,
          type: 'receita',
        },
        { label: '(-) Impostos Diretos (IOF Retido)', value: -impostosIOF, type: 'imposto' },
        { label: '= Receita Líquida Operacional', value: receitas, type: 'subtotal' },
        ...Object.entries(despesasPorCategoria).map(([cat, val]) => ({
          label: `(-) Despesa: ${cat}`,
          value: -val,
          type: 'despesa',
        })),
        { label: '= Lucro Líquido do Exercício', value: lucroLiquido, type: 'total' },
      ]

      const darfs = [
        {
          codigo: '3642',
          descricao: 'IOF - Operações de Crédito (Retido)',
          periodo: 'Mensal',
          valor: impostosIOF,
          status: 'Pendente',
        },
        {
          codigo: '0473',
          descricao: 'IRRF - Rendimentos',
          periodo: 'Mensal',
          valor: receitas * 0.015,
          status: 'Pendente',
        },
      ]

      setMetrics({
        totalReceitas: receitas,
        totalDespesas: despesas,
        impostosEstimados: impostosIOF,
        lucroLiquido,
        dre,
        darfs,
      })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar dados contábeis.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportDRE = () => {
    let csv = 'Rubrica,Valor\n'
    metrics.dre.forEach((item) => {
      csv += `"${item.label}",${item.value}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DRE_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidade Full-Cycle</h1>
          <p className="text-muted-foreground">
            Painel Contador: Consolidação de Receitas, Despesas, DRE e Geração de DARFs.
          </p>
        </div>
        <Button onClick={handleExportDRE} className="bg-emerald-600 hover:bg-emerald-700">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar SPED/DRE
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Operacional Líquida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(metrics.totalReceitas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas Totais (Pagas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              -{formatCurrency(metrics.totalDespesas)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tributos Retidos (IOF)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(metrics.impostosEstimados)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Lucro Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.lucroLiquido)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dre" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dre" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Demonstração (DRE)
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Fiscal & DARFs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dre">
          <Card>
            <CardHeader>
              <CardTitle>DRE Gerencial Consolidado</CardTitle>
              <CardDescription>
                Visão sintética de receitas de securitização e despesas de fornecedores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubrica Contábil</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.dre.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className={
                        item.type === 'total' || item.type === 'subtotal'
                          ? 'bg-muted/30 font-bold'
                          : ''
                      }
                    >
                      <TableCell
                        className={
                          item.type === 'despesa' || item.type === 'imposto'
                            ? 'pl-8 text-muted-foreground'
                            : ''
                        }
                      >
                        {item.label}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${item.value < 0 ? 'text-rose-600' : 'text-emerald-600'}`}
                      >
                        {formatCurrency(item.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal">
          <Card>
            <CardHeader>
              <CardTitle>Apuração de Tributos e Guias DARF</CardTitle>
              <CardDescription>
                Geração automática baseada na liquidação de operações (Lei 9.532/97 e retenções na
                fonte).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Receita</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Período de Apuração</TableHead>
                    <TableHead className="text-right">Valor Apurado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.darfs.map((darf, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-bold font-mono">{darf.codigo}</TableCell>
                      <TableCell>{darf.descricao}</TableCell>
                      <TableCell>{darf.periodo}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(darf.valor)}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">
                          {darf.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="w-4 h-4" /> Guia PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
