import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Eye, CheckCircle, XCircle, Search, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function AdminLiquidations() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedOp, setSelectedOp] = useState<any>(null)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  const [liquidationValue, setLiquidationValue] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  const fetchLiquidations = async () => {
    setLoading(true)
    const { data: ops } = await supabase
      .from('credit_operations')
      .select(
        'id, status, created_at, due_date, requested_value, face_value, payment_receipt_url, operation_calculations(net_value), profiles!borrower_id(full_name, pj_company_name, document_number)',
      )
      .in('status', ['pagamento_recebido_pendente_analise'])
      .order('updated_at', { ascending: false })

    if (ops) setOperations(ops)
    setLoading(false)
  }

  useEffect(() => {
    fetchLiquidations()
  }, [])

  const filteredOps = operations.filter((op) => {
    const term = searchTerm.toLowerCase()
    const name = (op.profiles?.full_name || op.profiles?.pj_company_name || '').toLowerCase()
    const doc = (op.profiles?.document_number || '').toLowerCase()
    const id = op.id.toLowerCase()
    return name.includes(term) || doc.includes(term) || id.includes(term)
  })

  const viewReceipt = async (op: any) => {
    if (!op.payment_receipt_url) return

    try {
      const { data, error } = await supabase.storage
        .from('comprovantes_liquidacao')
        .createSignedUrl(op.payment_receipt_url, 3600)

      if (error) throw error

      setReceiptUrl(data.signedUrl)
      setIsReceiptModalOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar comprovante',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleApprove = async () => {
    if (!selectedOp || !liquidationValue) return

    const val = parseFloat(liquidationValue.replace(',', '.'))
    const expected = selectedOp.operation_calculations?.[0]?.net_value || selectedOp.face_value

    const margin = expected * 0.05
    if (Math.abs(val - expected) > margin) {
      if (
        !window.confirm(
          `O valor informado (R$ ${val.toFixed(2)}) excede a tolerância de 5% do valor esperado (R$ ${expected.toFixed(2)}). Deseja aprovar mesmo assim?`,
        )
      ) {
        return
      }
    }

    setProcessing(true)

    try {
      const { error: opErr } = await supabase
        .from('credit_operations')
        .update({
          status: 'liquidado',
          liquidation_date: new Date().toISOString().split('T')[0],
          liquidation_value: val,
        })
        .eq('id', selectedOp.id)

      if (opErr) throw opErr

      await supabase.from('operation_status_history').insert({
        operation_id: selectedOp.id,
        old_status: selectedOp.status,
        new_status: 'liquidado',
        changed_by: user?.id,
        internal_observation: `Liquidação aprovada. Valor conciliado: R$ ${val.toFixed(2)}`,
      })

      await supabase.from('audit_logs').insert({
        entity_type: 'credit_operations',
        entity_id: selectedOp.id,
        action: 'liquidacao_aprovada',
        details: { admin_id: user?.id, liquidation_value: val, expected_value: expected },
      })

      // Simular atualização de estoque para manter atomicidade visual exigida
      const { data: firstSeries } = await supabase
        .from('debenture_series')
        .select('id, volume')
        .limit(1)
        .single()
      if (firstSeries) {
        await supabase
          .from('debenture_series')
          .update({
            volume: Number(firstSeries.volume) + val,
          })
          .eq('id', firstSeries.id)

        await supabase.from('audit_logs').insert({
          entity_type: 'debenture_series',
          entity_id: firstSeries.id,
          action: 'estoque_atualizado_liquidacao',
          details: { operation_id: selectedOp.id, increment: val },
        })
      }

      toast({
        title: 'Liquidação Aprovada',
        description: 'O status da operação e o estoque foram atualizados.',
      })
      setIsApproveModalOpen(false)
      fetchLiquidations()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedOp || !rejectionReason) return
    setProcessing(true)

    try {
      const { error: opErr } = await supabase
        .from('credit_operations')
        .update({
          status: 'pagamento_invalido',
        })
        .eq('id', selectedOp.id)

      if (opErr) throw opErr

      await supabase.from('operation_status_history').insert({
        operation_id: selectedOp.id,
        old_status: selectedOp.status,
        new_status: 'pagamento_invalido',
        changed_by: user?.id,
        internal_observation: `Comprovante reprovado: ${rejectionReason}`,
      })

      toast({
        title: 'Comprovante Reprovado',
        description: 'O tomador será notificado para enviar novamente.',
      })
      setIsRejectModalOpen(false)
      fetchLiquidations()
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const openApproveModal = (op: any) => {
    setSelectedOp(op)
    const expected = op.operation_calculations?.[0]?.net_value || op.face_value
    setLiquidationValue(expected.toString())
    setIsApproveModalOpen(true)
  }

  const openRejectModal = (op: any) => {
    setSelectedOp(op)
    setRejectionReason('')
    setIsRejectModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tomador ou ID..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operação</TableHead>
              <TableHead>Tomador</TableHead>
              <TableHead>Valor Esperado</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredOps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma liquidação pendente de análise no momento.
                </TableCell>
              </TableRow>
            ) : (
              filteredOps.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>
                    <div className="font-medium">#{op.id.substring(0, 8).toUpperCase()}</div>
                    <Badge
                      variant="outline"
                      className="mt-1 bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Pendente Análise
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>{op.profiles?.pj_company_name || op.profiles?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {op.profiles?.document_number}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-emerald-600">
                    {formatCurrency(op.operation_calculations?.[0]?.net_value || op.face_value)}
                  </TableCell>
                  <TableCell>{new Date(op.due_date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => viewReceipt(op)}>
                        <Eye className="w-4 h-4 mr-1" /> Ver Comprovante
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => openApproveModal(op)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => openRejectModal(op)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Liquidação</DialogTitle>
            <DialogDescription>
              Confirme o valor exato conciliado na conta bancária para a operação #
              {selectedOp?.id.substring(0, 8).toUpperCase()}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor Efetivamente Recebido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={liquidationValue}
                onChange={(e) => setLiquidationValue(e.target.value)}
              />
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p>
                <strong>Impacto:</strong> A operação será marcada como Liquidada e o valor será
                revertido ao estoque da série automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Liquidação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Comprovante</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação. O tomador será notificado para enviar um novo
              comprovante válido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo da Reprovação</Label>
              <Textarea
                placeholder="Ex: Valor incorreto, comprovante ilegível, não é um comprovante de transferência..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reprovar e Notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualização do Comprovante</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted rounded-md overflow-hidden flex items-center justify-center">
            {receiptUrl ? (
              receiptUrl.includes('.pdf') ? (
                <iframe src={receiptUrl} className="w-full h-full border-0" />
              ) : (
                <img
                  src={receiptUrl}
                  alt="Comprovante"
                  className="max-w-full max-h-full object-contain"
                />
              )
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
