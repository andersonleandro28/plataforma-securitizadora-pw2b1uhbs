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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export default function CcbPurchases() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [ccbs, setCcbs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const [form, setForm] = useState({
    ccb_id: '',
    acquisition_value: '',
    boleto_count: '',
    boleto_unit_value: '',
  })
  const [boletos, setBoletos] = useState<any[]>([])

  const fetchPurchases = async () => {
    setLoading(true)
    const { data: p } = await supabase
      .from('recebiveis_ccb')
      .select('*, ccb_solicitacoes(*, profiles(*))')
      .order('created_at', { ascending: false })
    const { data: c } = await supabase
      .from('ccb_solicitacoes')
      .select('*, profiles(*)')
      .in('status', ['aprovado', 'aprovada_bdigital', 'pendente'])

    setPurchases(p || [])
    setCcbs(c || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPurchases()
  }, [])

  useEffect(() => {
    const count = Number(form.boleto_count) || 0
    const val = Number(form.boleto_unit_value) || 0
    if (count > 0 && val > 0) {
      const newBoletos = Array.from({ length: count }).map((_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() + i + 1)
        return {
          due_date: d.toISOString().split('T')[0],
          unit_value: val,
          status: 'Pendente',
        }
      })
      setBoletos(newBoletos)
    } else {
      setBoletos([])
    }
  }, [form.boleto_count, form.boleto_unit_value])

  const calculateMetrics = () => {
    const acq = Number(form.acquisition_value) || 0
    const count = Number(form.boleto_count) || 0
    const val = Number(form.boleto_unit_value) || 0
    const total = count * val
    const profit = total - acq
    const tir = acq > 0 ? (profit / acq) * 100 : 0
    const prov = total * 0.03 // 3% provision
    return { acq, total, profit, tir, prov }
  }

  const handleSubmit = async () => {
    if (!form.ccb_id || !form.acquisition_value || !form.boleto_count || !form.boleto_unit_value) {
      return toast.error('Preencha todos os campos')
    }

    const { acq, profit, tir, prov } = calculateMetrics()

    const payload = {
      ccb_id: form.ccb_id,
      acquisition_value: acq,
      boleto_count: Number(form.boleto_count),
      boleto_unit_value: Number(form.boleto_unit_value),
      gross_profit: profit,
      tir_effective: tir,
      provision_amount: prov,
      boletos: boletos,
      status: 'Ativo',
    }

    const { error } = await supabase.from('recebiveis_ccb').insert(payload)
    if (error) {
      return toast.error('Erro ao registrar compra: ' + error.message)
    }

    // Vincula a operação - sem afetar finanças da CCB original
    await supabase
      .from('ccb_solicitacoes')
      .update({ status: 'comprada_bdigital' })
      .eq('id', form.ccb_id)

    toast.success('Compra registrada com sucesso! Lançamentos contábeis gerados de forma autônoma.')
    setOpen(false)
    fetchPurchases()
  }

  const metrics = calculateMetrics()

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in-up pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras CCB BDIGITAL</h1>
          <p className="text-muted-foreground">
            Gestão de aquisição de recebíveis pós-pagamento, com isolamento contábil e geração de
            boletos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar Compra
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Compras (Recebíveis)</CardTitle>
          <CardDescription>
            Lançamentos contábeis autônomos com provisão de lucro integrada ao DRE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Compra</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Boletos</TableHead>
                <TableHead>Valor Aquisição</TableHead>
                <TableHead>Valor Boletos</TableHead>
                <TableHead>Lucro Bruto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => {
                const totalBoletos = p.boleto_count * p.boleto_unit_value
                return (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-medium">
                      {p.ccb_solicitacoes?.profiles?.full_name || 'Desconhecido'}
                    </TableCell>
                    <TableCell>
                      {p.boleto_count}x de R$ {p.boleto_unit_value}
                    </TableCell>
                    <TableCell>R$ {Number(p.acquisition_value).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>R$ {totalBoletos.toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">
                      + R$ {Number(p.gross_profit).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-medium">
                        {p.status}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
              {purchases.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma compra registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Compra de Recebíveis (CCB BDIGITAL)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label>Simulação CCB (Lookup)</Label>
              <Select value={form.ccb_id} onValueChange={(v) => setForm({ ...form, ccb_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação pré-aprovada..." />
                </SelectTrigger>
                <SelectContent>
                  {ccbs.length === 0 && (
                    <SelectItem value="none" disabled>
                      Nenhuma CCB pendente.
                    </SelectItem>
                  )}
                  {ccbs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.profiles?.full_name} - Solicitado: R$ {c.requested_value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor de Aquisição (R$)</Label>
                <Input
                  type="number"
                  value={form.acquisition_value}
                  onChange={(e) => setForm({ ...form, acquisition_value: e.target.value })}
                  placeholder="Ex: 90000"
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Boletos</Label>
                <Input
                  type="number"
                  value={form.boleto_count}
                  onChange={(e) => setForm({ ...form, boleto_count: e.target.value })}
                  placeholder="Ex: 12"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Unit. Boleto (R$)</Label>
                <Input
                  type="number"
                  value={form.boleto_unit_value}
                  onChange={(e) => setForm({ ...form, boleto_unit_value: e.target.value })}
                  placeholder="Ex: 8500"
                />
              </div>
            </div>

            {boletos.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-md border mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor Total dos Boletos</p>
                  <p className="font-semibold text-lg">
                    R$ {metrics.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lucro Bruto Projetado</p>
                  <p className="font-semibold text-lg text-emerald-600">
                    + R$ {metrics.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">TIR Efetiva (Aprox.)</p>
                  <p className="font-semibold">{metrics.tir.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Provisão Inadimplência (3%)</p>
                  <p className="font-semibold text-rose-600">
                    - R$ {metrics.prov.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <Label>Comprovante Pgto. BDIGITAL</Label>
                <Input type="file" />
              </div>
              <div className="space-y-2">
                <Label>Planilha/PDF de Boletos</Label>
                <Input type="file" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Confirmar e Contabilizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
