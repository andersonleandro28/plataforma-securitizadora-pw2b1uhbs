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
import { useAuth } from '@/hooks/use-auth'

export function ExtractTab() {
  const [data, setData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const { user, activeRole } = useAuth()

  useEffect(() => {
    async function loadData() {
      let opsQuery = supabase.from('credit_operations').select(`
          id, face_value, due_date, status, borrower_id, receivable_type,
          profiles!credit_operations_borrower_id_fkey ( full_name, pj_company_name ),
          operation_calculations ( interest_value )
        `)

      let antQuery = supabase.from('operacoes_antecipacao').select(`
          id, user_id, status, installments,
          ccb_solicitacoes (
            profiles!ccb_solicitacoes_user_id_fkey ( full_name, pj_company_name )
          )
        `)

      let recQuery = supabase.from('recebiveis_ccb').select(`
          id, tomador_id, status, boletos,
          profiles!recebiveis_ccb_tomador_id_fkey ( full_name, pj_company_name )
        `)

      if (activeRole === 'borrower') {
        opsQuery = opsQuery.eq('borrower_id', user?.id)
        antQuery = antQuery.eq('user_id', user?.id)
        recQuery = recQuery.eq('tomador_id', user?.id)
      } else if (activeRole === 'investor') {
        opsQuery = opsQuery.limit(0)
        antQuery = antQuery.limit(0)
        recQuery = recQuery.limit(0)
      }

      const [opsRes, antRes, recRes] = await Promise.all([opsQuery, antQuery, recQuery])

      const consolidated = []

      if (opsRes.data) {
        opsRes.data.forEach((op: any) => {
          const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
          const principal =
            Number(op.face_value || 0) - Number(op.operation_calculations?.interest_value || 0)
          const interest = Number(op.operation_calculations?.interest_value || 0)
          const now = new Date()
          const due = new Date(op.due_date)

          let itemStatus = op.status
          if (op.status !== 'liquidado' && due < now) itemStatus = 'atrasado'
          else if (op.status !== 'liquidado') itemStatus = 'pendente'

          consolidated.push({
            id: op.id,
            tomador: prof?.pj_company_name || prof?.full_name || 'N/A',
            due_date: op.due_date,
            principal: Math.max(0, principal),
            interest: interest,
            total: op.face_value,
            status: itemStatus,
            type: op.receivable_type,
          })
        })
      }

      if (antRes.data) {
        antRes.data.forEach((ant: any) => {
          const ccb = Array.isArray(ant.ccb_solicitacoes)
            ? ant.ccb_solicitacoes[0]
            : ant.ccb_solicitacoes
          const prof = Array.isArray(ccb?.profiles) ? ccb.profiles[0] : ccb?.profiles || {}
          const tomador = prof?.pj_company_name || prof?.full_name || 'N/A'

          if (Array.isArray(ant.installments)) {
            ant.installments.forEach((inst: any) => {
              const val = Number(inst.value || 0)
              const due = new Date(inst.due_date || inst.dueDate)
              const now = new Date()

              let itemStatus = inst.status?.toLowerCase() || 'pendente'
              if (itemStatus !== 'paga' && itemStatus !== 'pago' && due < now) {
                itemStatus = 'atrasado'
              }

              consolidated.push({
                id: `${ant.id}-${inst.number}`,
                tomador: tomador,
                due_date: inst.due_date || inst.dueDate,
                principal: val * 0.8,
                interest: val * 0.2,
                total: val,
                status: itemStatus,
                type: 'CCB Digital',
              })
            })
          }
        })
      }

      if (recRes.data) {
        recRes.data.forEach((rec: any) => {
          const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles || {}
          const tomador = prof?.pj_company_name || prof?.full_name || 'N/A'

          if (Array.isArray(rec.boletos)) {
            rec.boletos.forEach((bol: any) => {
              const val = Number(bol.unit_value || bol.value || 0)
              const due = new Date(bol.due_date || bol.dueDate)
              const now = new Date()

              let itemStatus = bol.status?.toLowerCase() || 'pendente'
              if (itemStatus !== 'paga' && itemStatus !== 'pago' && due < now) {
                itemStatus = 'atrasado'
              }

              consolidated.push({
                id: `${rec.id}-${bol.number || bol.id}`,
                tomador: tomador,
                due_date: bol.due_date || bol.dueDate,
                principal: val * 0.8,
                interest: val * 0.2,
                total: val,
                status: itemStatus,
                type: 'CCB Aquisição',
              })
            })
          }
        })
      }

      consolidated.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      setData(consolidated)
    }
    if (user) loadData()
  }, [user, activeRole])

  const filtered = data.filter(
    (d) =>
      d.tomador.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()),
  )

  const handleExport = () => {
    const csvData = filtered.map((d) => ({
      'ID Operação': d.id,
      Tipo: d.type,
      Tomador: d.tomador,
      Vencimento: d.due_date ? new Date(d.due_date).toLocaleDateString('pt-BR') : '',
      Principal: d.principal,
      Juros: d.interest,
      'Total da Parcela': d.total,
      Status: d.status,
    }))
    exportToCSV(csvData, 'extrato_parcelas.csv')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Extrato Detalhado de Parcelas</CardTitle>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por tomador ou ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Juros</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.id.substring(0, 8)}</TableCell>
                  <TableCell className="capitalize text-xs">{item.type}</TableCell>
                  <TableCell>{item.tomador}</TableCell>
                  <TableCell>
                    {item.due_date
                      ? new Date(item.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.principal,
                    )}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.interest,
                    )}
                  </TableCell>
                  <TableCell className="font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.total,
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'liquidado' || item.status === 'pago' || item.status === 'paga' ? 'bg-green-100 text-green-800' : item.status === 'atrasado' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
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
