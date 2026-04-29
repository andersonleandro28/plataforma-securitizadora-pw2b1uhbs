import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Download } from 'lucide-react'

export function AcquisitionsTab() {
  const [data, setData] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: ops } = await supabase
        .from('credit_operations')
        .select(`
          id, receivable_type, face_value, issue_date, 
          profiles ( full_name, pj_company_name ),
          operation_calculations ( net_value, effective_cost_rate )
        `)
        .order('issue_date', { ascending: false })
      if (ops) setData(ops)
    }
    loadData()
  }, [])

  const filtered = data.filter(
    (d) =>
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.profiles?.pj_company_name || '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleExport = () => {
    const csvData = filtered.map((d) => ({
      'Tipo de Operação': d.receivable_type,
      'ID da Operação': d.id,
      'Nome do Tomador': d.profiles?.pj_company_name || d.profiles?.full_name || 'N/A',
      'Valor de Face': d.face_value,
      'Valor de Aquisição': d.operation_calculations?.net_value || 0,
      'Taxa Desconto/Juros': `${d.operation_calculations?.effective_cost_rate || 0}%`,
      'Data de Registro': d.issue_date ? new Date(d.issue_date).toLocaleDateString('pt-BR') : '',
    }))
    exportToCSV(csvData, 'aquisicoes.csv')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Relatório Unificado de Aquisições</CardTitle>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por ID ou Tomador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Valor Face</TableHead>
                <TableHead>Aquisição (Líquido)</TableHead>
                <TableHead>Taxa (CET)</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="capitalize">{item.receivable_type}</TableCell>
                  <TableCell className="font-mono text-xs">{item.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    {item.profiles?.pj_company_name || item.profiles?.full_name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.face_value,
                    )}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.operation_calculations?.net_value || 0,
                    )}
                  </TableCell>
                  <TableCell>
                    {Number(item.operation_calculations?.effective_cost_rate || 0).toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    {item.issue_date
                      ? new Date(item.issue_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
