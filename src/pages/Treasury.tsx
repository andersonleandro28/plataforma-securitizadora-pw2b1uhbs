import { useState, useEffect } from 'react'
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Plus,
  FileSpreadsheet,
  Pencil,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { NewTransactionDialog } from '@/components/Treasury/NewTransactionDialog'
import { EditTransactionDialog } from '@/components/Treasury/EditTransactionDialog'

export default function Treasury() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [filteredTx, setFilteredTx] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [bals, setBalances] = useState({ total: 0, escrow: 0, own: 0, inToday: 0, outToday: 0 })
  const [filterType, setFilterType] = useState('all')
  const [filterEscrow, setFilterEscrow] = useState(false)
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<any>(null)

  useEffect(() => {
    fetchTransactions()
    const channel = supabase
      .channel('treasury_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_transactions' },
        () => fetchTransactions(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_operations' }, () =>
        fetchTransactions(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () =>
        fetchTransactions(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () =>
        fetchTransactions(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const [{ data: invs }, { data: ops }, { data: manuals }, { data: reds }] = await Promise.all([
        supabase.from('investments').select('id, total_value, transfer_date, created_at, status'),
        supabase
          .from('credit_operations')
          .select(
            'id, requested_value, liquidation_value, issue_date, liquidation_date, status, sacado',
          ),
        supabase.from('treasury_transactions').select('*'),
        supabase
          .from('investment_redemptions')
          .select('id, net_value, updated_at, status')
          .eq('status', 'paid'),
      ])

      const allTx: any[] = []

      invs
        ?.filter((i) => ['approved', 'resgatado'].includes(i.status))
        .forEach((i) =>
          allTx.push({
            id: `inv-${i.id}`,
            date: i.transfer_date || i.created_at.split('T')[0],
            description: 'Aporte de Investidor',
            category: 'Investimento',
            type: 'in',
            amount: Number(i.total_value),
            is_escrow: true,
          }),
        )
      reds?.forEach((r) =>
        allTx.push({
          id: `red-${r.id}`,
          date: r.updated_at?.split('T')[0],
          description: 'Resgate de Investimento',
          category: 'Resgate',
          type: 'out',
          amount: Number(r.net_value),
          is_escrow: true,
        }),
      )
      ops?.forEach((o) => {
        if (['pago', 'liquidado'].includes(o.status))
          allTx.push({
            id: `buy-${o.id}`,
            date: o.issue_date || o.created_at?.split('T')[0],
            description: `Compra CCB - ${o.sacado}`,
            category: 'Compra CCB',
            type: 'out',
            amount: Number(o.requested_value),
            is_escrow: true,
          })
        if (o.status === 'liquidado' && o.liquidation_date)
          allTx.push({
            id: `liq-${o.id}`,
            date: o.liquidation_date,
            description: `Liquidação CCB - ${o.sacado}`,
            category: 'Liquidação CCB',
            type: 'in',
            amount: Number(o.liquidation_value || o.requested_value),
            is_escrow: true,
          })
      })
      manuals?.forEach((m) =>
        allTx.push({
          id: `man-${m.id}`,
          rawId: m.id,
          date: m.date,
          description: m.description,
          category: m.category,
          categoryId: m.category_id,
          type: m.type,
          amount: Number(m.amount),
          is_escrow: m.is_escrow,
        }),
      )

      allTx.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      let bal = 0,
        escrowBal = 0,
        ownBal = 0,
        inToday = 0,
        outToday = 0
      const today = new Date().toISOString().split('T')[0]

      allTx.forEach((tx) => {
        const val = tx.type === 'in' ? tx.amount : -tx.amount
        bal += val
        if (tx.is_escrow) escrowBal += val
        else ownBal += val
        tx.progressiveBalance = bal

        if (tx.date.startsWith(today)) {
          if (tx.type === 'in') inToday += tx.amount
          else outToday += tx.amount
        }
      })
      allTx.reverse()
      setTransactions(allTx)
      setBalances({ total: bal, escrow: escrowBal, own: ownBal, inToday, outToday })
    } catch (err) {
      toast.error('Erro ao carregar tesouraria.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let res = transactions
    if (filterType !== 'all') res = res.filter((t) => t.type === filterType)
    if (filterEscrow) res = res.filter((t) => t.is_escrow)
    setFilteredTx(res)
  }, [transactions, filterType, filterEscrow])

  const formatC = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tesouraria & Escrow</h1>
          <p className="text-muted-foreground">
            Extrato bancário consolidado e Livro-Razão em tempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const csv =
                'Data,Descricao,Categoria,Tipo,Valor,Saldo\n' +
                filteredTx
                  .map(
                    (t) =>
                      `${t.date},"${t.description}",${t.category},${t.type},${t.amount},${t.progressiveBalance}`,
                  )
                  .join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'extrato.csv'
              a.click()
            }}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
          <Button className="bg-primary" onClick={() => setIsNewEntryOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
          </Button>
          <NewTransactionDialog
            open={isNewEntryOpen}
            onOpenChange={setIsNewEntryOpen}
            onSuccess={fetchTransactions}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">
              Saldo Conta Principal (Próprio)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{formatC(bals.own)}</div>
            <div className="mt-4 space-y-1">
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> Entradas Hoje: {formatC(bals.inToday)}
              </p>
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Saídas Hoje: {formatC(bals.outToday)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-accent/30 bg-accent/5 md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-accent" /> Conta Escrow (Terceiros)
              </CardTitle>
              <CardDescription>Fundo de reserva de aportes e liquidações.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-accent mt-2">
              {formatC(bals.escrow)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo total histórico contabilizado na plataforma.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Extrato Conciliado (Livro-Razão)
          </CardTitle>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in">Entradas</SelectItem>
                <SelectItem value="out">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2 border rounded-md px-3">
              <Checkbox
                id="filter-escrow"
                checked={filterEscrow}
                onCheckedChange={(c) => setFilterEscrow(!!c)}
              />
              <Label htmlFor="filter-escrow" className="text-sm cursor-pointer">
                Apenas Escrow
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo Progressivo</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTx.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhuma movimentação encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTx.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </TableCell>
                      <TableCell
                        className="font-medium max-w-[200px] truncate"
                        title={tx.description}
                      >
                        {tx.description}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {tx.category}
                        </span>{' '}
                        {tx.is_escrow && (
                          <span className="ml-1 text-[10px] text-accent font-medium uppercase">
                            Escrow
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${tx.type === 'in' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}
                        >
                          {tx.type === 'in' ? 'Entrada' : 'Saída'}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {tx.type === 'in' ? '+' : '-'} {formatC(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatC(tx.progressiveBalance)}
                      </TableCell>
                      <TableCell>
                        {tx.id.startsWith('man-') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTx(tx)}
                            title="Editar Lançamento"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
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

      <EditTransactionDialog
        open={!!editingTx}
        onOpenChange={(op: boolean) => !op && setEditingTx(null)}
        transaction={editingTx}
        onSuccess={() => {
          setEditingTx(null)
          fetchTransactions()
        }}
      />
    </div>
  )
}
