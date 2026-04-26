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
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

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

  const [adjustModal, setAdjustModal] = useState<any>(null)
  const [adjRate, setAdjRate] = useState('')
  const [adjFee, setAdjFee] = useState('')
  const [adjPmt, setAdjPmt] = useState('')
  const [adjFirstDue, setAdjFirstDue] = useState('')
  const [adjCet, setAdjCet] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: reqs }, { data: ops }, { data: cfg }] = await Promise.all([
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
    ])
    if (reqs) setRequests(reqs)
    if (ops) setActiveOps(ops)
    if (cfg) setCcbConfig(cfg)
    setLoading(false)
  }
  useEffect(() => {
    fetchData()
  }, [])

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
          await supabase
            .from('operacoes_antecipacao')
            .insert({
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
      <div>
        <h1 className="text-3xl font-bold">Gestão de CCB</h1>
      </div>
      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="ativas">Ativas</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitacoes">
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
                  {requests.map((req) => (
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
                  ))}
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
                        <Button size="sm" onClick={() => setManageOp(op)}>
                          Parcelas
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
                  R$ {Number(docsModal?.requested_value).toLocaleString('pt-BR')}
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
              <Select value={statusVal} onValueChange={setStatusVal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovada">Aprovada (Gerar Operação)</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
