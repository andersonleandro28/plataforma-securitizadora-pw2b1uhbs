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
      const [opsRes, antRes, recRes] = await Promise.all([
        supabase
          .from('credit_operations')
          .select(`
            id, receivable_type, face_value, issue_date, 
            profiles!credit_operations_borrower_id_fkey ( full_name, pj_company_name ),
            operation_calculations ( net_value, effective_cost_rate )
          `)
          .order('issue_date', { ascending: false }),
        supabase.from('operacoes_antecipacao').select(`
            id, created_at, net_value, installments,
            ccb_solicitacoes (
              requested_value,
              profiles!ccb_solicitacoes_user_id_fkey ( full_name, pj_company_name )
            )
          `),
        supabase.from('recebiveis_ccb').select(`
            id, created_at, acquisition_value, boleto_count, boleto_unit_value, tir_effective,
            profiles!recebiveis_ccb_tomador_id_fkey ( full_name, pj_company_name )
          `),
      ])

      const consolidated = []

      if (opsRes.data) {
        opsRes.data.forEach((op: any) => {
          const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
          consolidated.push({
            type: op.receivable_type,
            id: op.id,
            tomador: prof?.pj_company_name || prof?.full_name || 'N/A',
            faceValue: op.face_value,
            netValue: op.operation_calculations?.net_value || 0,
            rate: op.operation_calculations?.effective_cost_rate || 0,
            date: op.issue_date,
          })
        })
      }

      if (antRes.data) {
        antRes.data.forEach((ant: any) => {
          const ccb = Array.isArray(ant.ccb_solicitacoes)
            ? ant.ccb_solicitacoes[0]
            : ant.ccb_solicitacoes
          const prof = Array.isArray(ccb?.profiles) ? ccb.profiles[0] : ccb?.profiles || {}

          let faceValue = 0
          if (Array.isArray(ant.installments)) {
            faceValue = ant.installments.reduce(
              (acc: number, i: any) => acc + Number(i.value || 0),
              0,
            )
          } else {
            faceValue = Number(ccb?.requested_value || 0)
          }

          consolidated.push({
            type: 'CCB Digital',
            id: ant.id,
            tomador: prof?.pj_company_name || prof?.full_name || 'N/A',
            faceValue: faceValue,
            netValue: ant.net_value || 0,
            rate: 0,
            date: ant.created_at,
          })
        })
      }

      if (recRes.data) {
        recRes.data.forEach((rec: any) => {
          const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles || {}
          const faceValue = Number(rec.boleto_count || 0) * Number(rec.boleto_unit_value || 0)

          consolidated.push({
            type: 'CCB Aquisição',
            id: rec.id,
            tomador: prof?.pj_company_name || prof?.full_name || 'N/A',
            faceValue: faceValue,
            netValue: rec.acquisition_value || 0,
            rate: rec.tir_effective || 0,
            date: rec.created_at,
          })
        })
      }

      consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setData(consolidated)
    }
    loadData()
  }, [])

  const filtered = data.filter(
    (d) =>
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.tomador || '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleExport = () => {
    const csvData = filtered.map((d) => ({
      'Tipo de Operação': d.type,
      'ID da Operação': d.id,
      'Nome do Tomador': d.tomador,
      'Valor de Face': d.faceValue,
      'Valor de Aquisição': d.netValue,
      'Taxa Desconto/Juros': `${d.rate}%`,
      'Data de Registro': d.date ? new Date(d.date).toLocaleDateString('pt-BR') : '',
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
                <TableHead>Taxa (CET/TIR)</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="capitalize">{item.type}</TableCell>
                  <TableCell className="font-mono text-xs">{item.id.substring(0, 8)}</TableCell>
                  <TableCell>{item.tomador}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.faceValue,
                    )}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.netValue,
                    )}
                  </TableCell>
                  <TableCell>{Number(item.rate || 0).toFixed(2)}%</TableCell>
                  <TableCell>
                    {item.date
                      ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
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
