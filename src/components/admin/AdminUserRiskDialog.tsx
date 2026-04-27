import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity, AlertTriangle, CheckCircle, Send, Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function AdminUserRiskDialog({ user, open, onOpenChange, onSaved }: any) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [limit, setLimit] = useState(0)
  const [used, setUsed] = useState(0)
  const [liquidated, setLiquidated] = useState(0)
  const [newLimit, setNewLimit] = useState('')
  const [reason, setReason] = useState('')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [globalStatus, setGlobalStatus] = useState('Saudável')

  useEffect(() => {
    if (open && user) {
      loadRiskData()
    }
  }, [open, user])

  const loadRiskData = async () => {
    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_limit')
        .eq('id', user.id)
        .single()

      setLimit(Number(profile?.credit_limit || 0))
      setNewLimit(String(profile?.credit_limit || 0))

      const { data: ops } = await supabase
        .from('credit_operations')
        .select('id, requested_value, status, due_date, document_number')
        .eq('borrower_id', user.id)

      const { data: ccbs } = await supabase
        .from('ccb_solicitacoes')
        .select('id, requested_value, status')
        .eq('user_id', user.id)

      const activeOps =
        ops?.filter(
          (o) => !['liquidado', 'reprovado', 'cancelado', 'excluido'].includes(o.status),
        ) || []
      const activeCcbs =
        ccbs?.filter(
          (c) => !['liquidado', 'reprovado', 'cancelado', 'excluido'].includes(c.status),
        ) || []

      const currentUsed =
        activeOps.reduce((acc, o) => acc + Number(o.requested_value), 0) +
        activeCcbs.reduce((acc, c) => acc + Number(c.requested_value), 0)

      setUsed(currentUsed)

      const liqOps = ops?.filter((o) => o.status === 'liquidado') || []
      setLiquidated(liqOps.reduce((acc, o) => acc + Number(o.requested_value), 0))

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const fiveDays = new Date(today)
      fiveDays.setDate(today.getDate() + 5)

      const upcoming = activeOps
        .filter((o) => {
          if (!o.due_date) return false
          const [y, m, d] = o.due_date.split('-').map(Number)
          const due = new Date(y, m - 1, d)
          return due <= fiveDays
        })
        .map((o) => {
          const [y, m, d] = o.due_date.split('-').map(Number)
          const due = new Date(y, m - 1, d)
          const isOverdue = due < today
          return { ...o, isOverdue, dueDateObj: due }
        })
        .sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime())

      setAlerts(upcoming)

      if (upcoming.some((o) => o.isOverdue)) setGlobalStatus('Inadimplente')
      else if (upcoming.length > 0) setGlobalStatus('Atenção')
      else setGlobalStatus('Saudável')

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', user.id)
        .in('action', ['limit_change', 'collection_notice'])
        .order('created_at', { ascending: false })

      setAuditLogs(logs || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLimit = async () => {
    if (!reason.trim()) return toast.error('A justificativa é obrigatória.')
    const numLimit = Number(newLimit)
    if (isNaN(numLimit) || numLimit < 0) return toast.error('Valor de limite inválido.')

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ credit_limit: numLimit })
        .eq('id', user.id)

      if (error) throw error

      await supabase.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: user.id,
        action: 'limit_change',
        user_id: session?.user?.id,
        details: {
          old_limit: limit,
          new_limit: numLimit,
          reason,
          admin_name: session?.user?.user_metadata?.name || 'Administrador',
        },
      })

      toast.success('Limite atualizado com sucesso.')
      setLimit(numLimit)
      setReason('')
      loadRiskData()
      if (onSaved) onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar limite.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendReminder = async (opId: string) => {
    try {
      await supabase.from('audit_logs').insert({
        entity_type: 'profiles',
        entity_id: user.id,
        action: 'collection_notice',
        user_id: session?.user?.id,
        details: {
          type: 'Cobrança Manual',
          message: `Lembrete manual enviado para a operação ${opId.split('-')[0]}`,
          admin_name: session?.user?.user_metadata?.name || 'Administrador',
        },
      })
      toast.success('Lembrete de cobrança enviado com sucesso via e-mail/WhatsApp.')
      loadRiskData()
    } catch (e) {
      toast.error('Erro ao registrar envio de lembrete.')
    }
  }

  const available = Math.max(0, limit - used)
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestão de Risco e Limites</DialogTitle>
          <DialogDescription>
            Tomador: {user?.full_name || user?.pj_company_name} ({user?.document_number})
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Status Global</div>
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {globalStatus === 'Saudável' && (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    )}
                    {globalStatus === 'Atenção' && (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    {globalStatus === 'Inadimplente' && (
                      <Activity className="w-5 h-5 text-destructive" />
                    )}
                    {globalStatus}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Limite Total (R$)</div>
                  <div className="font-semibold text-lg">{formatCurrency(limit)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Saldo Devedor (R$)</div>
                  <div className="font-semibold text-lg text-amber-600">{formatCurrency(used)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Liquidado (R$)</div>
                  <div className="font-semibold text-lg text-emerald-600">
                    {formatCurrency(liquidated)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Uso do Limite ({pct.toFixed(1)}%)</span>
                <span>Disponível: {formatCurrency(available)}</span>
              </div>
              <Progress value={pct} className={pct > 90 ? 'text-destructive' : 'text-primary'} />
            </div>

            <Tabs defaultValue="limite">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="limite">Alterar Limite</TabsTrigger>
                <TabsTrigger value="alertas">Alertas & Cobrança</TabsTrigger>
                <TabsTrigger value="historico">Histórico (Logs)</TabsTrigger>
                <TabsTrigger value="regua">Régua Automática</TabsTrigger>
              </TabsList>

              <TabsContent value="limite" className="pt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Novo Limite de Crédito (R$)</Label>
                    <Input
                      type="number"
                      value={newLimit}
                      onChange={(e) => setNewLimit(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Justificativa da Alteração *</Label>
                    <Textarea
                      placeholder="Ex: Aumento de faturamento comprovado pelo balanço..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleUpdateLimit} disabled={saving} className="w-full md:w-auto">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" /> Salvar Novo Limite
                </Button>
              </TabsContent>

              <TabsContent value="alertas" className="pt-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    Nenhuma parcela a vencer nos próximos 5 dias.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operação</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">
                            {a.document_number || a.id.split('-')[0]}
                          </TableCell>
                          <TableCell>
                            {new Date(a.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                          </TableCell>
                          <TableCell>{formatCurrency(a.requested_value)}</TableCell>
                          <TableCell>
                            {a.isOverdue ? (
                              <Badge variant="destructive">Vencido</Badge>
                            ) : (
                              <Badge className="bg-amber-500 hover:bg-amber-600">A Vencer</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(a.id)}
                            >
                              <Send className="w-3 h-3 mr-2" /> Lembrete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="historico" className="pt-4">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    Nenhum registro encontrado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-primary pl-4 py-1">
                        <div className="text-sm font-medium">
                          {log.action === 'limit_change'
                            ? `Limite alterado de ${formatCurrency(log.details?.old_limit)} para ${formatCurrency(log.details?.new_limit)}`
                            : log.action === 'collection_notice'
                              ? `Notificação de Cobrança: ${log.details?.type}`
                              : log.action}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Por {log.details?.admin_name || 'Sistema'} em{' '}
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </div>
                        {log.details?.reason && (
                          <div className="text-sm mt-2 bg-muted/30 p-2 rounded">
                            <span className="font-medium">Motivo:</span> {log.details?.reason}
                          </div>
                        )}
                        {log.details?.message && (
                          <div className="text-sm mt-2 bg-muted/30 p-2 rounded">
                            <span className="font-medium">Detalhe:</span> {log.details?.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="regua" className="pt-4 space-y-4">
                <Card className="bg-muted/10 border-dashed">
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" /> Régua de Cobrança (Multi-Mensagem)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      O sistema monitora diariamente as parcelas e dispara notificações automáticas
                      (E-mail/WhatsApp) nos seguintes gatilhos:
                    </p>
                    <div className="space-y-3 mt-4">
                      <div className="flex gap-3 items-start border p-3 rounded-md bg-background">
                        <Badge className="bg-amber-500 hover:bg-amber-600 mt-0.5 shrink-0">
                          D-5
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">5 Dias Antes do Vencimento</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            "Lembrete de Vencimento: Sua parcela vence em 5 dias. Programe seu
                            pagamento."
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start border p-3 rounded-md bg-background">
                        <Badge className="bg-blue-500 hover:bg-blue-600 mt-0.5 shrink-0">D-0</Badge>
                        <div>
                          <p className="text-sm font-medium">No Dia do Vencimento</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            "Vencimento Hoje: Identificamos uma parcela com vencimento para hoje.
                            Acesse sua plataforma."
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start border p-3 rounded-md bg-background">
                        <Badge variant="destructive" className="mt-0.5 shrink-0">
                          D+1
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">1 Dia Após o Vencimento</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            "Alerta de Atraso: Sua parcela venceu ontem. Evite multas e juros
                            realizando o pagamento agora."
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
