import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchManualYieldEntries,
  createManualYieldEntry,
  updateManualYieldEntry,
  deleteManualYieldEntry,
  type ManualYieldEntry,
} from '@/services/manual-yield'
import { supabase } from '@/lib/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const formatPct = (val: number) => `${Number(val).toFixed(2)}%`

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default function ManualYieldEntries() {
  const { productId } = useParams<{ productId: string }>()
  const [product, setProduct] = useState<any>(null)
  const [entries, setEntries] = useState<ManualYieldEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const [form, setForm] = useState({
    period: '',
    gross_percentage: '',
  })

  const loadProduct = useCallback(async () => {
    if (!productId) return
    const { data, error } = await supabase
      .from('investment_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) {
      toast.error('Produto não encontrado')
      return
    }

    setProduct(data)
    if (data.type !== 'Rendimento Variável (Forex Manual)') {
      toast.error('Este produto não é do tipo Rendimento Variável (Forex Manual)')
    }
  }, [productId])

  const loadEntries = useCallback(async () => {
    if (!productId) return
    try {
      const data = await fetchManualYieldEntries(productId)
      setEntries(data)
    } catch (err: any) {
      toast.error('Erro ao carregar rendimentos')
    }
  }, [productId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadProduct(), loadEntries()])
      setLoading(false)
    }
    load()
  }, [loadProduct, loadEntries])

  const yieldSplit = Number(product?.yield_split_pct ?? 50)

  const clientPct = form.gross_percentage ? (Number(form.gross_percentage) * yieldSplit) / 100 : 0
  const securitizadoraPct = form.gross_percentage
    ? (Number(form.gross_percentage) * (100 - yieldSplit)) / 100
    : 0

  const handleSave = async () => {
    if (!productId || !form.period || !form.gross_percentage) {
      toast.error('Preencha o período e o percentual bruto')
      return
    }

    const gross = Number(form.gross_percentage)
    if (isNaN(gross) || gross < 0) {
      toast.error('Percentual bruto inválido')
      return
    }

    const periodDate = new Date(form.period + 'T12:00:00Z')
    periodDate.setUTCDate(1)

    setSaving(true)
    try {
      const payload = {
        product_id: productId,
        period: periodDate.toISOString().split('T')[0],
        gross_percentage: gross,
        client_percentage: (gross * yieldSplit) / 100,
        securitizadora_percentage: (gross * (100 - yieldSplit)) / 100,
      }

      if (editId) {
        await updateManualYieldEntry(editId, payload)
        toast.success('Rendimento atualizado com sucesso')
        setEditId(null)
      } else {
        await createManualYieldEntry(payload)
        toast.success('Rendimento registrado com sucesso')
      }

      setForm({ period: '', gross_percentage: '' })
      await loadEntries()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar rendimento')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (entry: ManualYieldEntry) => {
    setEditId(entry.id)
    const periodDate = new Date(entry.period + 'T12:00:00Z')
    const year = periodDate.getUTCFullYear()
    const month = String(periodDate.getUTCMonth() + 1).padStart(2, '0')
    setForm({
      period: `${year}-${month}`,
      gross_percentage: String(entry.gross_percentage),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setSaving(true)
    try {
      await deleteManualYieldEntry(deletingId)
      toast.success('Rendimento excluído')
      setDeletingId(null)
      setDeleteConfirmOpen(false)
      await loadEntries()
    } catch (err: any) {
      toast.error('Erro ao excluir rendimento')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (product?.type !== 'Rendimento Variável (Forex Manual)') {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <Button variant="ghost" asChild>
          <Link to="/admin/products">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Este produto não suporta rendimentos manuais.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8 max-w-5xl mx-auto animate-fade-in-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/products">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rendimentos Manuais</h2>
          <p className="text-sm text-muted-foreground">
            {product?.title} — Divisão: {yieldSplit}% cliente / {100 - yieldSplit}% securitizadora
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            {editId ? 'Editar Rendimento' : 'Novo Rendimento'}
          </CardTitle>
          <CardDescription>
            Registre o percentual de rendimento bruto para um período. As parcelas são calculadas
            automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Período (Mês/Ano)</Label>
              <Input
                type="month"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rendimento Bruto (%)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 10.00"
                value={form.gross_percentage}
                onChange={(e) => setForm({ ...form, gross_percentage: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente ({yieldSplit}%)</Label>
              <Input type="text" value={formatPct(clientPct)} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Securitizadora ({100 - yieldSplit}%)</Label>
              <Input
                type="text"
                value={formatPct(securitizadoraPct)}
                disabled
                className="bg-muted/50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : editId ? (
                <Pencil className="mr-2 h-4 w-4" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editId ? 'Atualizar' : 'Salvar'}
            </Button>
            {editId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditId(null)
                  setForm({ period: '', gross_percentage: '' })
                }}
              >
                Cancelar Edição
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Rendimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum rendimento registrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Cliente</TableHead>
                  <TableHead className="text-right">Securitizadora</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{formatDateBR(entry.period)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPct(entry.gross_percentage)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">
                      {formatPct(entry.client_percentage)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-blue-600">
                      {formatPct(entry.securitizadora_percentage)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          disabled={saving}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingId(entry.id)
                            setDeleteConfirmOpen(true)
                          }}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de rendimento? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
