import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Receipt, AlertCircle, Download } from 'lucide-react'

export default function MyCcbInstallments() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchInstallments()

    const channel = supabase
      .channel('recebiveis_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () => {
        fetchInstallments() // Auto refresh on changes
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchInstallments = async () => {
    setLoading(true)
    const { data: ccbs } = await supabase
      .from('ccb_solicitacoes')
      .select('id')
      .eq('user_id', user!.id)
    if (ccbs && ccbs.length > 0) {
      const ccbIds = ccbs.map((c) => c.id)
      const { data: p } = await supabase.from('recebiveis_ccb').select('*').in('ccb_id', ccbIds)
      setPurchases(p || [])
    } else {
      setPurchases([])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minhas Parcelas CCB</h1>
        <p className="text-muted-foreground">
          Acompanhe seus vencimentos e baixe os boletos atualizados em tempo real.
        </p>
      </div>

      {loading && purchases.length === 0 ? (
        <div className="h-40 flex items-center justify-center">Carregando parcelas...</div>
      ) : purchases.length === 0 ? (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-4 opacity-50" />
            <p>Nenhuma parcela ou contrato ativo encontrado no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {purchases.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Contrato CCB #{p.ccb_id.substring(0, 8).toUpperCase()}</span>
                  <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                    Valor Total: R${' '}
                    {(p.boleto_count * p.boleto_unit_value).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </CardTitle>
                <CardDescription>
                  Emitido em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(p.boletos || []).map((b: any, idx: number) => {
                      const isOverdue = new Date(b.due_date) < new Date() && b.status !== 'Pago'
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {idx + 1} de {p.boleto_count}
                          </TableCell>
                          <TableCell className={isOverdue ? 'text-rose-600 font-medium' : ''}>
                            {new Date(b.due_date).toLocaleDateString('pt-BR')}{' '}
                            {isOverdue && ' (Vencido)'}
                          </TableCell>
                          <TableCell>
                            R${' '}
                            {Number(b.unit_value).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${b.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}
                            >
                              {isOverdue ? 'Vencido' : b.status || 'Pendente'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {b.file_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => window.open(b.file_url, '_blank')}
                                >
                                  <Download className="w-4 h-4" /> Boleto
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2"
                                disabled={b.status === 'Pago'}
                              >
                                <Receipt className="w-4 h-4" /> Código PIX
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
