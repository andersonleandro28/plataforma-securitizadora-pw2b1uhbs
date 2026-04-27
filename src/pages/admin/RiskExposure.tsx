import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldAlert, TrendingUp, AlertTriangle, Clock, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export default function RiskExposure() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<{
    totalCapital: number
    borrowers: any[]
    alerts: any[]
  }>({
    totalCapital: 0,
    borrowers: [],
    alerts: [],
  })

  useEffect(() => {
    fetchRiskData()
  }, [])

  const fetchRiskData = async () => {
    setLoading(true)
    try {
      // Fetch all active operations to calculate total capital and outstanding balances
      const { data: ops } = await supabase
        .from('credit_operations')
        .select('borrower_id, requested_value, status, due_date')
        .not('status', 'in', '("liquidado","reprovado","cancelado","excluido")')

      const { data: ccbs } = await supabase
        .from('ccb_solicitacoes')
        .select('user_id, requested_value, status, created_at')
        .not('status', 'in', '("liquidado","reprovado","cancelado","excluido")')

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, pj_company_name, document_number, credit_limit, created_at')
        .eq('is_borrower', true)

      let totalCap = 0
      const borrowerMap = new Map()

      profiles?.forEach((p) => {
        borrowerMap.set(p.id, {
          id: p.id,
          name: p.pj_company_name || p.full_name || 'Desconhecido',
          document: p.document_number,
          limit: Number(p.credit_limit || 0),
          used: 0,
          created_at: p.created_at,
          status: 'Saudável',
        })
      })

      ops?.forEach((op) => {
        const val = Number(op.requested_value || 0)
        totalCap += val
        if (borrowerMap.has(op.borrower_id)) {
          borrowerMap.get(op.borrower_id).used += val

          if (op.due_date) {
            const due = new Date(op.due_date)
            const now = new Date()
            due.setHours(0, 0, 0, 0)
            now.setHours(0, 0, 0, 0)
            if (due < now) {
              borrowerMap.get(op.borrower_id).status = 'Inadimplente'
            } else if (
              (due.getTime() - now.getTime()) / (1000 * 3600 * 24) <= 5 &&
              borrowerMap.get(op.borrower_id).status !== 'Inadimplente'
            ) {
              borrowerMap.get(op.borrower_id).status = 'Atenção'
            }
          }
        }
      })

      ccbs?.forEach((ccb) => {
        const val = Number(ccb.requested_value || 0)
        totalCap += val
        if (borrowerMap.has(ccb.user_id)) {
          borrowerMap.get(ccb.user_id).used += val
        }
      })

      const borrowersList = Array.from(borrowerMap.values())
        .map((b) => ({
          ...b,
          concentration: totalCap > 0 ? (b.used / totalCap) * 100 : 0,
        }))
        .sort((a, b) => b.used - a.used)

      // Generate alerts for Semester Review (> 180 days since creation or last review)
      const alertsList: any[] = []
      borrowersList.forEach((b) => {
        if (b.used > 0) {
          const created = new Date(b.created_at)
          const now = new Date()
          const daysSince = (now.getTime() - created.getTime()) / (1000 * 3600 * 24)
          if (daysSince >= 180) {
            alertsList.push({
              type: 'review',
              title: `Revisão Semestral Recomendada`,
              desc: `Tomador: ${b.name} (${b.document}). Cadastro ativo há mais de 180 dias.`,
              borrowerId: b.id,
            })
          }
          if (b.concentration > 15) {
            alertsList.push({
              type: 'concentration',
              title: `Atenção: Concentração de risco acima do limite de 15% para este CNPJ`,
              desc: `Tomador: ${b.name} (${b.document}) concentra ${b.concentration.toFixed(1)}% do capital total alocado.`,
              borrowerId: b.id,
            })
          }
        }
      })

      setData({
        totalCapital: totalCap,
        borrowers: borrowersList,
        alerts: alertsList,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredBorrowers = data.borrowers
    .filter(
      (b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.document?.includes(search),
    )
    .slice(0, 10) // Top 10

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exposição Global & Risco</h1>
          <p className="text-muted-foreground">
            Monitoramento de concentração de carteira e revisão periódica de compliance.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Capital Total Alocado</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{formatCurrency(data.totalCapital)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Tomadores Ativos</p>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold">
              {data.borrowers.filter((b) => b.used > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Alertas de Risco</p>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <div className="text-3xl font-bold text-destructive">{data.alerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {data.alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Alertas Ativos
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.alerts.map((a, i) => (
              <Alert
                key={i}
                variant={a.type === 'concentration' ? 'destructive' : 'default'}
                className={a.type === 'review' ? 'border-amber-500 bg-amber-50' : ''}
              >
                {a.type === 'concentration' ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-600" />
                )}
                <AlertTitle className={a.type === 'review' ? 'text-amber-800' : ''}>
                  {a.title}
                </AlertTitle>
                <AlertDescription className={a.type === 'review' ? 'text-amber-700' : ''}>
                  {a.desc}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4">
          <div>
            <CardTitle>Top 10 Tomadores por Exposição</CardTitle>
            <CardDescription>
              Acompanhe a concentração de risco e o consumo de limite.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tomador..."
              className="w-full sm:w-[250px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Saldo Devedor</TableHead>
                  <TableHead>Concentração</TableHead>
                  <TableHead>Limite Personalizado</TableHead>
                  <TableHead>Status Global</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Calculando exposição...
                    </TableCell>
                  </TableRow>
                ) : filteredBorrowers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhum tomador com saldo devedor encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBorrowers.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <div>{b.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{b.document}</div>
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatCurrency(b.used)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-[60px] bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${b.concentration > 15 ? 'bg-destructive' : 'bg-primary'}`}
                              style={{ width: `${Math.min(100, b.concentration)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-bold ${b.concentration > 15 ? 'text-destructive' : 'text-muted-foreground'}`}
                          >
                            {b.concentration.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatCurrency(b.limit)}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.limit > 0
                            ? `${((b.used / b.limit) * 100).toFixed(1)}% utilizado`
                            : 'Sem limite definido'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.status === 'Saudável' && (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">Saudável</Badge>
                        )}
                        {b.status === 'Atenção' && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500 text-white hover:bg-amber-600"
                          >
                            Atenção
                          </Badge>
                        )}
                        {b.status === 'Inadimplente' && (
                          <Badge variant="destructive">Inadimplente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
