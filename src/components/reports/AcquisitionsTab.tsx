import { useEffect, useState, useMemo, useCallback } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Download, ShoppingCart, Clock, RotateCw } from 'lucide-react'

export function AcquisitionsTab() {
  const [data, setData] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [opsRes, recRes] = await Promise.all([
        supabase
          .from('credit_operations')
          .select(`
            id, receivable_type, face_value, issue_date, status,
            profiles!credit_operations_borrower_id_fkey ( full_name, pj_company_name ),
            operation_calculations ( net_value, effective_cost_rate )
          `)
          .not('status', 'in', '("cancelado","excluido","reprovado")')
          .order('issue_date', { ascending: false }),
        supabase
          .from('recebiveis_ccb')
          .select(`
            id, created_at, acquisition_value, boleto_count, boleto_unit_value, tir_effective, status,
            profiles!recebiveis_ccb_tomador_id_fkey ( full_name, pj_company_name )
          `)
          .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")'),
      ])

      if (opsRes.error) throw opsRes.error
      if (recRes.error) throw recRes.error

      const consolidated: any[] = []

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
            status: op.status,
          })
        })
      }

      if (recRes.data) {
        recRes.data.forEach((rec: any) => {
          const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles || {}
          const faceValue = Number(rec.boleto_count || 0) * Number(rec.boleto_unit_value || 0)

          consolidated.push({
            type: 'CCB',
            id: rec.id,
            tomador: prof?.pj_company_name || prof?.full_name || 'N/A',
            faceValue: faceValue,
            netValue: rec.acquisition_value || 0,
            rate: rec.tir_effective || 0,
            date: rec.created_at,
            status: rec.status,
          })
        })
      }

      consolidated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setData(consolidated)
    } catch (err) {
      console.error('Error loading acquisitions:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('acquisitions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_operations' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  const filtered = useMemo(() => {
    return data.filter(
      (d) =>
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        (d.tomador || '').toLowerCase().includes(search.toLowerCase()),
    )
  }, [data, search])

  const { totalAcquisitions, activeCount, totalToReceive, pendingCount } = useMemo(() => {
    let tAcq = 0
    let cAcq = 0
    let tRec = 0
    let cRec = 0

    filtered.forEach((d) => {
      const s = (d.status || '').toLowerCase()
      const isActive = [
        'ativo',
        'liquidado',
        'pago',
        'formalizado',
        'aguardando_liquidacao',
      ].includes(s)
      if (isActive) {
        tAcq += d.netValue || 0
        cAcq += 1
      }
      const isPending = [
        'ativo',
        'pendente',
        'em_analise',
        'aprovado',
        'aguardando_liquidacao',
        'aguardando_formalizacao',
      ].includes(s)
      if (isPending) {
        tRec += d.faceValue || 0
        cRec += 1
      }
    })

    return { totalAcquisitions: tAcq, activeCount: cAcq, totalToReceive: tRec, pendingCount: cRec }
  }, [filtered])

  const handleExport = () => {
    const csvData = filtered.map((d) => ({
      'Tipo de Operação': d.type,
      'ID da Operação': d.id,
      'Nome do Tomador': d.tomador,
      'Valor de Face': d.faceValue,
      'Valor de Aquisição': d.netValue,
      'Taxa Desconto/Juros': `${d.rate}%`,
      Status: d.status || 'N/A',
      'Data de Registro': d.date ? new Date(d.date).toLocaleDateString('pt-BR') : '',
    }))
    exportToCSV(csvData, 'aquisicoes.csv')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {error ? (
          <>
            <Card className="flex flex-col items-center justify-center p-6 min-h-[120px]">
              <p className="text-sm text-muted-foreground mb-2">Erro ao carregar aquisições</p>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RotateCw className="h-4 w-4 mr-2" /> Tentar Novamente
              </Button>
            </Card>
            <Card className="flex flex-col items-center justify-center p-6 min-h-[120px]">
              <p className="text-sm text-muted-foreground mb-2">Erro ao carregar pendências</p>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RotateCw className="h-4 w-4 mr-2" /> Tentar Novamente
              </Button>
            </Card>
          </>
        ) : loading ? (
          <>
            <Card className="p-6">
              <Skeleton className="h-4 w-1/3 mb-4" />
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/4" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-4 w-1/3 mb-4" />
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/4" />
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Aquisições</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalAcquisitions,
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeCount} aquisições ativas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    totalToReceive,
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingCount} aquisições com saldo pendente
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

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
                  <TableHead>Status</TableHead>
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
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(item.faceValue)}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(item.netValue)}
                    </TableCell>
                    <TableCell>{Number(item.rate || 0).toFixed(2)}%</TableCell>
                    <TableCell className="capitalize">
                      {item.status?.replace(/_/g, ' ') || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {item.date
                        ? new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && !loading && (
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
    </div>
  )
}
