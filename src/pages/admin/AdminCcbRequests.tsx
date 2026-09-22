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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2,
  FileText,
  Settings,
  Download,
  CheckCircle2,
  Trash2,
  Calculator,
  Edit,
  Info,
  PlusCircle,
  Search,
  Filter,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { AdminNewCcbDialog } from '@/components/admin/AdminNewCcbDialog'

export default function AdminCcbRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [activeOps, setActiveOps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ccbConfig, setCcbConfig] = useState<any>(null)
  const [manageId, setManageId] = useState<string | null>(null)
  const [docsModal, setDocsModal] = useState<any>(null)
  const [statusVal, setStatusVal] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [manageOp, setManageOp] = useState<any>(null)
  const [uploadingBoleto, setUploadingBoleto] = useState<string | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [revertingInstallmentId, setRevertingInstallmentId] = useState<string | null>(null)

  const [adjustModal, setAdjustModal] = useState<any>(null)
  const [adjRate, setAdjRate] = useState('')
  const [adjAnnualRate, setAdjAnnualRate] = useState('')
  const [adjFee, setAdjFee] = useState('')
  const [adjPmt, setAdjPmt] = useState('')
  const [adjFirstDue, setAdjFirstDue] = useState('')
  const [adjCet, setAdjCet] = useState(0)
  const [adjCetAnnual, setAdjCetAnnual] = useState(0)
  const [annualLocked, setAnnualLocked] = useState(true)
  const [lastEdited, setLastEdited] = useState<'rate' | 'pmt' | null>(null)

  // Modal de Nova Solicitação Interna de CCB
  const [newCcbOpen, setNewCcbOpen] = useState(false)

  // Filtros de busca e status na listagem
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const calculateRate = (nper: number, pmt: number, pv: number) => {
    if (pmt * nper <= pv) return 0
    let low = 0
    let high = 1
    let guess = 0.05
    for (let i = 0; i < 50; i++) {
      guess = (low + high) / 2
      const calcPmt = (pv * guess) / (1 - Math.pow(1 + guess, -nper))
      if (calcPmt > pmt) high = guess
      else low = guess
    }
    return guess * 100
  }

  const calculatePMT = (pv: number, ratePct: number, nper: number) => {
    const rate = ratePct / 100
    if (rate === 0) return pv / nper
    return (pv * rate) / (1 - Math.pow(1 + rate, -nper))
  }

  useEffect(() => {
    if (!adjustModal) return
    const pv = Number(adjustModal.requested_value || 0)
    const nper = Number(adjustModal.term_months || 1)
    const fee = Number(adjFee || 0)

    const timer = setTimeout(() => {
      let currentPmt = Number(adjPmt)
      if (lastEdited === 'rate') {
        const rate = Number(adjRate)
        currentPmt = calculatePMT(pv, rate, nper)
        setAdjPmt(currentPmt.toFixed(2))
      } else if (lastEdited === 'pmt') {
        const rate = calculateRate(nper, currentPmt, pv)
        setAdjRate(rate.toFixed(2))
      }

      const cet = calculateRate(nper, currentPmt, pv - fee)
      setAdjCet(cet)
      setAdjCetAnnual((Math.pow(1 + cet / 100, 12) - 1) * 100)
    }, 600)

    return () => clearTimeout(timer)
  }, [adjRate, adjPmt, adjFee, adjustModal, lastEdited])

  // Sync annual rate via compound interest
  useEffect(() => {
    if (annualLocked && adjRate) {
      const iMensal = Number(adjRate) / 100
      if (!isNaN(iMensal)) {
        setAdjAnnualRate(((Math.pow(1 + iMensal, 12) - 1) * 100).toFixed(4))
      }
    }
  }, [adjRate, annualLocked])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: reqs }, { data: ops }, { data: cfg }, { data: recs }] = await Promise.all([
      supabase
        .from('ccb_solicitacoes')
        .select('*, profiles(full_name, email)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('operacoes_antecipacao')
        .select('*, ccb_solicitacoes(*, profiles(full_name, document_number))')
        .order('created_at', { ascending: false }),
      supabase.from('config_ccb').select('*').single(),
      supabase.from('recebiveis_ccb').select('*'),
    ])
    if (reqs) setRequests(reqs)
    if (ops) {
      // Priorizar a verdade de recebiveis_ccb (boletos) sobre installments de operacoes_antecipacao
      const recMap = new Map<string, any>()
      ;(recs || []).forEach((r: any) => {
        if (r.ccb_id) recMap.set(r.ccb_id, r)
      })

      const synchronizedOps = ops.map((op: any) => {
        const matchingRec = recMap.get(op.ccb_id)
        if (
          !matchingRec ||
          !Array.isArray(matchingRec.boletos) ||
          matchingRec.boletos.length === 0
        ) {
          return op
        }

        // Casar parcela N da cópia com boleto N (pela ordem/índice), priorizando data real e status do boleto
        const boletos = matchingRec.boletos
        const baseInsts = Array.isArray(op.installments) ? op.installments : []

        const unifiedInstallments = boletos.map((b: any, idx: number) => {
          const oldInst = baseInsts[idx] || {}
          const isPaid =
            String(b.status || '').toLowerCase() === 'pago' ||
            String(b.status || '').toLowerCase() === 'liquidado'
          const isExtended = String(b.status || '')
            .toLowerCase()
            .includes('prorrog')
          const isOverdue = String(b.status || '')
            .toLowerCase()
            .includes('vencid')

          let status = 'aberta'
          if (isPaid) status = 'paga'
          else if (isExtended) status = 'prorrogada'
          else if (isOverdue) status = 'vencida'

          return {
            ...oldInst,
            id: oldInst.id || `inst-${matchingRec.id}-${idx}`,
            number: idx + 1,
            due_date: b.due_date || oldInst.due_date,
            value: Number(b.unit_value ?? oldInst.value ?? 0),
            status,
            payment_date: isPaid
              ? b.payment_date || b.data_pagamento || oldInst.payment_date
              : undefined,
            data_pagamento: isPaid
              ? b.data_pagamento || b.payment_date || oldInst.data_pagamento
              : undefined,
            interest_applied: Number(b.interest_applied ?? oldInst.interest_applied ?? 0),
            penalty_applied: Number(b.penalty_applied ?? oldInst.penalty_applied ?? 0),
            file_url: b.file_url || oldInst.file_url,
            receipt_url: oldInst.receipt_url,
            _recebivel_id: matchingRec.id,
            _boleto_idx: idx,
          }
        })

        return {
          ...op,
          _recebivel_id: matchingRec.id,
          installments: unifiedInstallments,
        }
      })

      setActiveOps(synchronizedOps)
    }
    if (cfg) setCcbConfig(cfg)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Subscrição em tempo real para solicitações, operacoes e recebíveis
    const channel = supabase
      .channel('ccb_solicitacoes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ccb_solicitacoes' }, () => {
        fetchData()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operacoes_antecipacao' },
        () => {
          fetchData()
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtragem de solicitações por busca (nome, documento, email, ID) e status
  const filteredRequests = requests.filter((req) => {
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus
    if (!matchesStatus) return false

    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    const name = (req.borrower_data?.name || req.profiles?.full_name || '').toLowerCase()
    const doc = (req.borrower_data?.document || '').toLowerCase()
    const email = (req.profiles?.email || req.borrower_data?.email || '').toLowerCase()
    const id = (req.id || '').toLowerCase()

    return name.includes(term) || doc.includes(term) || email.includes(term) || id.includes(term)
  })

  const downloadFile = async (
    path: string,
    fileName: string = 'documento.pdf',
    bucket: string = 'ccb-docs',
  ) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
      if (error) throw error
      if (data) window.open(data.signedUrl, '_blank')
    } catch (e) {
      toast.error(`Falha ao visualizar documento`)
    }
  }

  const renderDocs = (req: any) => {
    if (!req) return []
    const p = req.docs_paths || {}
    const items = []
    if (req.pdf_file_path)
      items.push({ label: 'PDF Espelho CCB', path: req.pdf_file_path, bucket: 'ccb-docs' })
    if (p.id_front)
      items.push({ label: 'Identidade (Frente)', path: p.id_front, bucket: 'ccb-docs' })
    if (p.id_back) items.push({ label: 'Identidade (Verso)', path: p.id_back, bucket: 'ccb-docs' })
    if (p.selfie) items.push({ label: 'Selfie', path: p.selfie, bucket: 'ccb-docs' })
    if (p.proof_address)
      items.push({ label: 'Comprovante Residência', path: p.proof_address, bucket: 'ccb-docs' })
    if (p.social_contract)
      items.push({ label: 'Contrato Social/Estatuto', path: p.social_contract, bucket: 'ccb-docs' })
    if (p.cnpj_card) items.push({ label: 'Cartão CNPJ', path: p.cnpj_card, bucket: 'ccb-docs' })
    if (p.revenue_proof)
      items.push({ label: 'Comprovante Faturamento', path: p.revenue_proof, bucket: 'ccb-docs' })
    if (p.partner_id_front)
      items.push({
        label: 'Identidade Sócio (Frente)',
        path: p.partner_id_front,
        bucket: 'ccb-docs',
      })
    if (p.partner_selfie)
      items.push({ label: 'Selfie Sócio', path: p.partner_selfie, bucket: 'ccb-docs' })
    if (p.marriage_cert)
      items.push({
        label: 'Certidão Casamento',
        path: p.marriage_cert,
        bucket: 'ccb_conjuges_docs',
      })
    return items
  }

  const handleSaveAdjust = async () => {
    if (!adjustModal) return
    setSaving(true)
    try {
      const opData = { ...adjustModal.operation_data }
      if (!opData.original_simulation) {
        opData.original_simulation = { ...opData.simulation }
      }
      const newSimulation = {
        ...opData.simulation,
        interest_rate_monthly: Number(adjRate),
        interest_rate_annual: Number(adjAnnualRate),
        installment_value: Number(adjPmt),
        fixed_cost: Number(adjFee),
        cet: Number(adjCet),
        cet_annual: Number(adjCetAnnual),
      }
      opData.simulation = newSimulation

      const { error } = await supabase
        .from('ccb_solicitacoes')
        .update({
          status: 'proposta_ajustada',
          operation_data: opData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', adjustModal.id)

      if (error) throw error

      await supabase.functions.invoke('notify-ccb-adjustment', {
        body: { ccb_id: adjustModal.id, user_id: adjustModal.user_id, newSimulation },
      })

      toast.success('Proposta ajustada e enviada ao cliente.')
      setAdjustModal(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erro ao ajustar proposta: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePayInstallment = async (opId: string, installment: any) => {
    setPayLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      const opToUpdate = activeOps.find((o) => o.id === opId)
      if (!opToUpdate) throw new Error('Operação não encontrada')

      const todayStr = new Date().toISOString().split('T')[0]

      // Se houver recebivel vinculado, atualiza a fonte da verdade em recebiveis_ccb (o trigger espelhará e gerará tesouraria)
      if (installment._recebivel_id && installment._boleto_idx !== undefined) {
        const { data: recData, error: recFetchErr } = await supabase
          .from('recebiveis_ccb')
          .select('boletos')
          .eq('id', installment._recebivel_id)
          .single()

        if (recFetchErr) throw recFetchErr

        const boletos: any[] = Array.isArray(recData?.boletos) ? [...recData.boletos] : []
        const targetBoleto = (boletos[installment._boleto_idx] || {}) as any
        targetBoleto.status = 'Pago'
        targetBoleto.payment_date = todayStr
        targetBoleto.data_pagamento = todayStr
        boletos[installment._boleto_idx] = targetBoleto

        const { error: updRecErr } = await supabase
          .from('recebiveis_ccb')
          .update({ boletos })
          .eq('id', installment._recebivel_id)

        if (updRecErr) throw updRecErr
      } else {
        // Fallback: CCB puramente em operacoes_antecipacao sem recebivel
        const updatedInstallments = opToUpdate.installments.map((i: any) => {
          if (i.id === installment.id) {
            return { ...i, status: 'paga', payment_date: todayStr, data_pagamento: todayStr }
          }
          return i
        })

        const { error: updErr } = await supabase
          .from('operacoes_antecipacao')
          .update({ installments: updatedInstallments })
          .eq('id', opId)

        if (updErr) throw updErr
      }

      toast.success('Pagamento de parcela registrado com sucesso!')
      await fetchData()
      if (manageOp && manageOp.id === opId) {
        const refreshed = activeOps.find((o) => o.id === opId)
        if (refreshed) setManageOp(refreshed)
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    } finally {
      setPayLoading(false)
    }
  }

  const handleRevertAnticipationInstallment = async (opId: string, installment: any) => {
    if (
      !confirm(
        `Deseja realmente reverter a baixa da Parcela ${installment.number}? O lançamento correspondente será estornado do caixa e DRE.`,
      )
    ) {
      return
    }

    setRevertingInstallmentId(installment.id)
    try {
      const opToUpdate = activeOps.find((o) => o.id === opId)
      if (!opToUpdate) throw new Error('Operação não encontrada')

      // Se houver recebivel vinculado, utiliza a RPC oficial de reversão atômica de CCB
      if (installment._recebivel_id && installment._boleto_idx !== undefined) {
        const { error: rpcErr } = await supabase.rpc('revert_ccb_installment_liquidation', {
          p_recebivel_id: installment._recebivel_id,
          p_installment_idx: installment._boleto_idx,
        })

        if (rpcErr) throw rpcErr
      } else {
        // Fallback: CCB puramente em operacoes_antecipacao
        const updatedInstallments = opToUpdate.installments.map((i: any) => {
          if (i.id === installment.id) {
            const { payment_date, data_pagamento, ...rest } = i
            return { ...rest, status: 'aberta' }
          }
          return i
        })

        const { error: updErr } = await supabase
          .from('operacoes_antecipacao')
          .update({ installments: updatedInstallments })
          .eq('id', opId)

        if (updErr) throw updErr
      }

      // Remover mapeamentos e movimentações de caixa se existirem
      await supabase
        .from('mapeamento_movimentacoes')
        .delete()
        .eq('origem_tabela', 'ccb')
        .eq('origem_id', installment.id)

      await supabase
        .from('movimentacoes_caixa')
        .delete()
        .eq('referencia_id', opToUpdate.ccb_id)
        .eq('referencia_tipo', 'ccb')
        .ilike('descricao', `%Parcela ${installment.number}%`)

      toast.success(`Baixa da Parcela ${installment.number} revertida com sucesso!`)

      await fetchData()
      if (manageOp && manageOp.id === opId) {
        const refreshed = activeOps.find((o) => o.id === opId)
        if (refreshed) setManageOp(refreshed)
      }
    } catch (err: any) {
      toast.error('Erro ao reverter baixa: ' + err.message)
    } finally {
      setRevertingInstallmentId(null)
    }
  }

  const handleUpdate = async () => {
    if (!manageId) return
    setSaving(true)
    try {
      await supabase
        .from('ccb_solicitacoes')
        .update({ status: statusVal, admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', manageId)
      if (statusVal === 'aprovada') {
        const req = requests.find((r) => r.id === manageId)
        if (req && !activeOps.find((o) => o.ccb_id === manageId)) {
          const t = req.term_months || 12
          const v = req.operation_data?.simulation?.installment_value || req.requested_value / t
          const inst = Array.from({ length: t }, (_, i) => {
            const d = new Date()
            d.setMonth(d.getMonth() + i + 1)
            return {
              id: crypto.randomUUID(),
              number: i + 1,
              due_date: d.toISOString().split('T')[0],
              value: v,
              status: 'aberta',
            }
          })
          await supabase.from('operacoes_antecipacao').insert({
            ccb_id: manageId,
            user_id: req.user_id,
            net_value: req.requested_value,
            installments: inst,
            partner_bank: 'BDIGITAL',
            status: 'ativa',
          })
        }
      }
      toast.success('Solicitação atualizada.')
      setManageId(null)
      fetchData()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestão de CCB</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe solicitações, ajuste propostas e lance novas CCBs internamente pela mesa.
          </p>
        </div>
        <Button
          onClick={() => setNewCcbOpen(true)}
          className="bg-[#00C2E0] hover:bg-[#00a9c4] text-white gap-2 h-11 px-5 shadow-sm font-semibold"
        >
          <PlusCircle className="h-5 w-5" /> Nova Solicitação de CCB
        </Button>
      </div>

      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações ({requests.length})</TabsTrigger>
          <TabsTrigger value="ativas">Ativas ({activeOps.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitacoes" className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por tomador, CPF/CNPJ ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="w-full sm:w-56">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="simulacao">Simulação</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="proposta_ajustada">Proposta Ajustada</SelectItem>
                  <SelectItem value="aceite_tomador">Aceite Tomador</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {searchTerm || filterStatus !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setFilterStatus('all')
                }}
                className="h-10"
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        {loading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando solicitações...
                          </div>
                        ) : (
                          'Nenhuma solicitação encontrada.'
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          {req.borrower_data?.name || req.profiles?.full_name}
                          <p className="text-xs text-muted-foreground">
                            {req.borrower_data?.document}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {req.borrower_data?.entityType === 'pj' ? 'PJ' : 'PF'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge>{req.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setDocsModal(req)}>
                            <FileText className="h-4 w-4 mr-1" /> Detalhes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 border-blue-600/30 hover:bg-blue-50"
                            onClick={() => {
                              setAdjustModal(req)
                              const sim = req.operation_data?.simulation || {}
                              setAdjRate(
                                sim.interest_rate_monthly || ccbConfig?.interest_rate_monthly || '',
                              )
                              setAdjFee(sim.fixed_cost || ccbConfig?.fixed_emission_cost || 0)
                              setAdjPmt(
                                sim.installment_value || req.requested_value / req.term_months,
                              )
                              setAdjCet(sim.cet || 0)
                              setLastEdited(null)
                              setAnnualLocked(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Ajustar
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setManageId(req.id)
                              setStatusVal(req.status)
                              setNotes(req.admin_notes || '')
                            }}
                          >
                            <Settings className="h-4 w-4 mr-1" /> Gerir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ativas">
          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOps.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>#{op.ccb_id?.split('-')[0].toUpperCase()}</TableCell>
                      <TableCell>{op.ccb_solicitacoes?.profiles?.full_name}</TableCell>
                      <TableCell>R$ {Number(op.net_value).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            setManageOp(op)
                          }}
                        >
                          Parcelas ({op.installments?.length || 0})
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!docsModal} onOpenChange={(v) => !v && setDocsModal(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Espelhamento de Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 border rounded">
              <div>
                <span className="text-xs text-muted-foreground block">Tomador</span>
                <span className="font-bold">{docsModal?.borrower_data?.name}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Tipo</span>
                <span className="font-bold">
                  {docsModal?.borrower_data?.entityType === 'pj'
                    ? 'Pessoa Jurídica'
                    : 'Pessoa Física'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Valor</span>
                <span className="font-bold">
                  R$ {Number(docsModal?.requested_value || 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Prazo</span>
                <span className="font-bold">{docsModal?.term_months}x</span>
              </div>
            </div>
            {docsModal?.borrower_data?.entityType === 'pj' && docsModal?.partner_data && (
              <div className="text-sm bg-muted/10 p-3 rounded border">
                <span className="font-semibold block mb-1">Sócio Administrador</span>
                {docsModal.partner_data.name} ({docsModal.partner_data.document}) - Part:{' '}
                {docsModal.partner_data.participation}%
              </div>
            )}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Arquivos</h4>
              {renderDocs(docsModal).map((d, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-2 border rounded bg-muted/10"
                >
                  <span className="text-sm">{d.label}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(d.path, d.label, d.bucket)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageId} onOpenChange={(v) => !v && setManageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Simulação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusVal} onValueChange={setStatusVal} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um novo status" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="simulacao">Simulação</SelectItem>
                  <SelectItem value="em_analise">Em Análise</SelectItem>
                  <SelectItem value="proposta_ajustada">Proposta Ajustada</SelectItem>
                  <SelectItem value="aceite_tomador">Aceite Tomador</SelectItem>
                  <SelectItem value="aprovada">Aprovada (Gerar Operação)</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageId(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustModal} onOpenChange={(v) => !v && setAdjustModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar Proposta de Crédito</DialogTitle>
            <DialogDescription>
              Ajuste a taxa de juros ou o valor da parcela. O sistema calculará o outro
              automaticamente através da fórmula de equivalência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-blue-50/50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                Taxas calculadas via Juros Compostos (Equivalência Bancária). O bloqueio de edição
                anual garante a paridade perfeita para o Custo Efetivo.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg border">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Valor Solicitado
                </Label>
                <div className="font-semibold text-lg">
                  R$ {Number(adjustModal?.requested_value || 0).toLocaleString('pt-BR')}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Prazo
                </Label>
                <div className="font-semibold text-lg">{adjustModal?.term_months} meses</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor da Parcela (R$)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground">R$</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjPmt}
                    className="pl-10"
                    onChange={(e) => {
                      setAdjPmt(e.target.value)
                      setLastEdited('pmt')
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Taxa de Juros (% a.m.)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.0001"
                    value={adjRate}
                    className="pr-8"
                    onChange={(e) => {
                      setAdjRate(e.target.value)
                      setLastEdited('rate')
                    }}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <Label>Taxa Anual (% a.a.)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[10px]"
                    onClick={() => setAnnualLocked(!annualLocked)}
                  >
                    {annualLocked ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.0001"
                    value={adjAnnualRate}
                    disabled={annualLocked}
                    className={annualLocked ? 'bg-muted pr-8' : 'pr-8'}
                    onChange={(e) => setAdjAnnualRate(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tarifa de Emissão (R$)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground">R$</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjFee}
                    className="pl-10"
                    onChange={(e) => setAdjFee(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="mb-1 block">CET (% a.m. / % a.a.)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      readOnly
                      value={Number(adjCet).toFixed(4)}
                      className="bg-muted pr-6 font-semibold text-rose-600 text-sm"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      readOnly
                      value={Number(adjCetAnnual).toFixed(4)}
                      className="bg-muted pr-6 font-semibold text-rose-600 text-sm"
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                      <span className="text-muted-foreground text-xs">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAdjust}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Salvar e Enviar Proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageOp} onOpenChange={(v) => !v && setManageOp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Parcelas da CCB</DialogTitle>
            <DialogDescription>
              Operação #{manageOp?.ccb_id?.split('-')[0]?.toUpperCase()} -{' '}
              {manageOp?.ccb_solicitacoes?.profiles?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
                {manageOp?.installments?.map((inst: any, idx: number) => (
                  <TableRow key={inst.id || idx}>
                    <TableCell>{inst.number}</TableCell>
                    <TableCell>{new Date(inst.due_date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>R$ {Number(inst.value).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inst.status === 'paga'
                            ? 'default'
                            : inst.status === 'prorrogada'
                              ? 'secondary'
                              : inst.status === 'vencida'
                                ? 'destructive'
                                : 'outline'
                        }
                        className={
                          inst.status === 'paga'
                            ? 'bg-emerald-600 text-white'
                            : inst.status === 'prorrogada'
                              ? 'bg-blue-600 text-white'
                              : ''
                        }
                      >
                        {inst.status === 'paga'
                          ? 'Pago'
                          : inst.status === 'prorrogada'
                            ? 'Prorrogada'
                            : inst.status === 'vencida'
                              ? 'Vencida'
                              : 'Em Aberto'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inst.status === 'paga' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => handleRevertAnticipationInstallment(manageOp.id, inst)}
                          disabled={revertingInstallmentId === inst.id}
                        >
                          {revertingInstallmentId === inst.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Reverter Baixa'
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handlePayInstallment(manageOp.id, inst)}
                          disabled={payLoading}
                        >
                          {payLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Marcar como Paga'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Nova Solicitação Interna de CCB */}
      <AdminNewCcbDialog
        open={newCcbOpen}
        onOpenChange={setNewCcbOpen}
        onSuccess={() => {
          fetchData()
        }}
      />
    </div>
  )
}
