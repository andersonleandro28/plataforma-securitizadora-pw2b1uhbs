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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckSquare,
  Loader2,
  Eye,
  XCircle,
  Search,
  DollarSign,
  ArrowDownRight,
  History,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function InvestmentsReview() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState<any[]>([])
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchRedemptions, setSearchRedemptions] = useState('')

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [viewRedemption, setViewRedemption] = useState<any>(null)
  const [rejectRedemptionId, setRejectRedemptionId] = useState<string | null>(null)
  const [redemptionRejectReason, setRedemptionRejectReason] = useState('')
  const [processingAction, setProcessingAction] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [invRes, redRes] = await Promise.all([
      supabase
        .from('investments')
        .select('*, profiles(full_name, email), investment_products(title)')
        .order('created_at', { ascending: false }),
      supabase
        .from('investment_redemptions')
        .select('*, profiles(full_name, email), investments(quotas, investment_products(title))')
        .order('created_at', { ascending: false }),
    ])

    if (invRes.data) setInvestments(invRes.data)
    if (redRes.data) setRedemptions(redRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  // --- INVESTMENTS LOGIC ---
  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase.rpc('approve_investment', { p_investment_id: id })
      if (error) throw error
      toast.success('Investimento aprovado e cotas atualizadas.')
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao aprovar: ' + err.message)
    }
  }

  const handleReject = async () => {
    if (!rejectReason) return toast.error('Motivo obrigatório')
    try {
      await supabase
        .from('investments')
        .update({ status: 'rejected', rejection_reason: rejectReason })
        .eq('id', rejectId)
      toast.success('Investimento reprovado.')
      setRejectId(null)
      setRejectReason('')
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao reprovar: ' + err.message)
    }
  }

  const handleViewProof = async (invId: string) => {
    const { data: proofs } = await supabase
      .from('investment_proofs')
      .select('*')
      .eq('investment_id', invId)
      .order('uploaded_at', { ascending: false })
      .limit(1)
    if (proofs && proofs.length > 0) {
      const { data } = await supabase.storage
        .from('investment-proofs')
        .createSignedUrl(proofs[0].file_path, 300)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } else {
      toast.error('Nenhum comprovante enviado.')
    }
  }

  // --- REDEMPTIONS LOGIC ---
  const handleApproveRedemption = async (id: string) => {
    if (!confirm('Deseja aprovar esta solicitação de resgate?')) return
    setProcessingAction(true)
    try {
      const { error } = await supabase
        .from('investment_redemptions')
        .update({ status: 'approved', updated_by: user?.id })
        .eq('id', id)
      if (error) throw error
      toast.success('Resgate aprovado! A liberação do pagamento pode ser feita a seguir.')
      fetchData()
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  const handleRejectRedemption = async () => {
    if (!redemptionRejectReason) return toast.error('Motivo obrigatório')
    setProcessingAction(true)
    try {
      const { error } = await supabase
        .from('investment_redemptions')
        .update({
          status: 'rejected',
          rejection_reason: redemptionRejectReason,
          updated_by: user?.id,
        })
        .eq('id', rejectRedemptionId)
      if (error) throw error
      toast.success('Solicitação de resgate rejeitada.')
      setRejectRedemptionId(null)
      setRedemptionRejectReason('')
      fetchData()
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  const handlePayRedemption = async (r: any) => {
    if (
      !confirm(
        'Confirmar o pagamento do resgate? O status será atualizado e o estoque de cotas devolvido de forma atômica.',
      )
    )
      return
    setProcessingAction(true)
    try {
      const { error } = await supabase.rpc('process_redemption_payment', {
        p_redemption_id: r.id,
        p_admin_id: user?.id,
      })
      if (error) throw error
      toast.success(
        `Resgate concluído: Estoque +${r.requested_quotas} cotas, Saldo investidor atualizado.`,
      )
      fetchData()
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    } finally {
      setProcessingAction(false)
    }
  }

  const filteredInv = investments.filter(
    (i) =>
      i.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.investment_products?.title?.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredRed = redemptions.filter(
    (r) =>
      r.profiles?.full_name?.toLowerCase().includes(searchRedemptions.toLowerCase()) ||
      r.investments?.investment_products?.title
        ?.toLowerCase()
        .includes(searchRedemptions.toLowerCase()),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Investimentos</h1>
        <p className="text-muted-foreground">
          Aprove novos aportes e gerencie solicitações de resgates.
        </p>
      </div>

      <Tabs defaultValue="aportes" className="w-full">
        <TabsList className="mb-6 h-auto p-1 bg-muted/50 border">
          <TabsTrigger value="aportes" className="py-2.5 px-6">
            Aprovações de Aportes
          </TabsTrigger>
          <TabsTrigger value="resgates" className="py-2.5 px-6">
            Solicitações de Resgate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aportes">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center pb-4">
              <CardTitle>Fila de Análise de Comprovantes</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar investidor ou produto..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investidor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor Declarado</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredInv.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma solicitação de aporte.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInv.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.profiles?.full_name || inv.profiles?.email}
                        </TableCell>
                        <TableCell>
                          {inv.investment_products?.title} <br />
                          <span className="text-xs text-muted-foreground">{inv.quotas} cotas</span>
                        </TableCell>
                        <TableCell className="font-mono text-primary font-medium">
                          {formatCurrency(inv.transfer_value || inv.total_value)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {inv.created_at
                            ? format(new Date(inv.created_at), 'dd/MM/yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {inv.status === 'approved' ? (
                            <Badge className="bg-emerald-500">Aprovado</Badge>
                          ) : inv.status === 'awaiting_review' ? (
                            <Badge className="bg-amber-500">Em Conferência</Badge>
                          ) : inv.status === 'rejected' ? (
                            <Badge variant="destructive">Reprovado</Badge>
                          ) : (
                            <Badge variant="outline">Aguardando Pagamento</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProof(inv.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> Ver Comprovante
                          </Button>
                          {inv.status === 'awaiting_review' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApprove(inv.id)}
                              >
                                <CheckSquare className="h-4 w-4 mr-1" /> Aprovar
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setRejectId(inv.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resgates">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" /> Resgates Pendentes
                </CardTitle>
                <CardDescription className="mt-1">
                  Aprovação de retiradas antecipadas e liquidações atômicas.
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar investidor ou produto..."
                  className="pl-9"
                  value={searchRedemptions}
                  onChange={(e) => setSearchRedemptions(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investidor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd. Cotas</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Status Estoque</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredRed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum resgate solicitado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRed.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.profiles?.full_name || r.profiles?.email}
                        </TableCell>
                        <TableCell>{r.investments?.investment_products?.title}</TableCell>
                        <TableCell>{r.requested_quotas}</TableCell>
                        <TableCell className="font-mono text-emerald-600 font-medium">
                          {formatCurrency(r.net_value)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.created_at ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          {r.status === 'paid' ? (
                            <Badge className="bg-emerald-500">Liquidado</Badge>
                          ) : r.status === 'approved' ? (
                            <Badge className="bg-primary">Aprovado (Pagar)</Badge>
                          ) : r.status === 'rejected' ? (
                            <Badge variant="destructive">Rejeitado</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-100 text-amber-800 border-amber-200"
                            >
                              Em Análise
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.status === 'paid' ? (
                            <span className="text-muted-foreground text-xs font-medium">
                              Baixado
                            </span>
                          ) : r.status === 'approved' ? (
                            <span className="text-amber-600 font-bold text-xs">Baixa pendente</span>
                          ) : r.status === 'rejected' ? (
                            <span className="text-muted-foreground text-xs">Cancelado</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Aguardando</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver Detalhes do Cálculo"
                            onClick={() => setViewRedemption(r)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>

                          {r.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Aprovar Resgate"
                                disabled={processingAction}
                                onClick={() => handleApproveRedemption(r.id)}
                              >
                                <CheckSquare className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reprovar Solicitação"
                                disabled={processingAction}
                                onClick={() => setRejectRedemptionId(r.id)}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}

                          {r.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-primary/10 text-primary border-primary/30"
                              disabled={processingAction}
                              onClick={() => handlePayRedemption(r)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" /> Confirmar Pagamento
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Aporte Modal */}
      <Dialog open={!!rejectId} onOpenChange={(v) => !v && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Comprovante de Aporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Motivo da Reprovação</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Valor incorreto, comprovante ilegível..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Resgate Modal */}
      <Dialog open={!!rejectRedemptionId} onOpenChange={(v) => !v && setRejectRedemptionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação de Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Motivo da Rejeição (Será enviado ao investidor)</Label>
            <Input
              value={redemptionRejectReason}
              onChange={(e) => setRedemptionRejectReason(e.target.value)}
              placeholder="Ex: Carência mínima não atingida, dados inválidos..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectRedemptionId(null)}
              disabled={processingAction}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectRedemption}
              disabled={processingAction}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Resgate Details Modal */}
      <Dialog open={!!viewRedemption} onOpenChange={(v) => !v && setViewRedemption(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5 text-primary" /> Detalhes do Resgate
            </DialogTitle>
          </DialogHeader>
          {viewRedemption && (
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-1 bg-muted/20 p-3 rounded-md border">
                <p>
                  <strong>Investidor:</strong> {viewRedemption.profiles?.full_name}
                </p>
                <p>
                  <strong>Produto:</strong> {viewRedemption.investments?.investment_products?.title}
                </p>
                <p>
                  <strong>Cotas Solicitadas:</strong> {viewRedemption.requested_quotas}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Valor Bruto Calculado</span>
                  <span className="font-mono">{formatCurrency(viewRedemption.gross_value)}</span>
                </div>
                {Number(viewRedemption.penalty_applied) > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Multa de Resgate Antecipado</span>
                    <span className="font-mono">
                      -{formatCurrency(viewRedemption.penalty_applied)}
                    </span>
                  </div>
                )}
                {Number(viewRedemption.discount_applied) > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto sobre Rendimentos</span>
                    <span className="font-mono">
                      -{formatCurrency(viewRedemption.discount_applied)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Total Líquido a Pagar</span>
                  <span className="text-primary font-mono">
                    {formatCurrency(viewRedemption.net_value)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewRedemption(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
