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
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, FileText, Forward, Settings, Download } from 'lucide-react'
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

export default function AdminCcbRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [manageId, setManageId] = useState<string | null>(null)
  const [docsModal, setDocsModal] = useState<any>(null)
  const [statusVal, setStatusVal] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ccb_solicitacoes')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    if (data) setRequests(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const downloadFile = async (path: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('ccb-docs').download(path)
      if (error) throw error
      if (data) {
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (e) {
      console.error('Error downloading file', e)
      toast.error(`Falha ao baixar ${fileName}`)
    }
  }

  const renderDocs = (req: any) => {
    const paths = req.docs_paths || {}
    const items = []
    if (req.pdf_file_path) items.push({ label: 'PDF Espelho CCB', path: req.pdf_file_path })
    if (paths.identity) items.push({ label: 'Documento de Identidade', path: paths.identity })
    if (paths.address) items.push({ label: 'Comprovante de Residência', path: paths.address })
    if (paths.bank_extract) items.push({ label: 'Extrato Bancário', path: paths.bank_extract })
    if (paths.ir_document) items.push({ label: 'Declaração IR', path: paths.ir_document })
    if (paths.borderos && Array.isArray(paths.borderos)) {
      paths.borderos.forEach((b: string, i: number) => {
        items.push({ label: `Borderô / NF ${i + 1}`, path: b })
      })
    }
    return items
  }

  const handleEncaminhar = async (req: any) => {
    setSaving(true)
    try {
      const docs = renderDocs(req)
      toast.info(`Preparando download de ${docs.length} arquivos...`)

      for (const doc of docs) {
        const ext = doc.path.split('.').pop() || 'pdf'
        const safeName = doc.label.replace(/[^a-z0-9]/gi, '_')
        const fileName = `${safeName}_${req.id.substring(0, 5)}.${ext}`
        await downloadFile(doc.path, fileName)
        await new Promise((r) => setTimeout(r, 500))
      }

      if (req.status === 'pendente') {
        const { error } = await supabase
          .from('ccb_solicitacoes')
          .update({ status: 'em_analise' })
          .eq('id', req.id)
        if (error) throw error
        toast.success('Arquivos baixados e status atualizado para "Enviado BDIGITAL".')
        fetchRequests()
      } else {
        toast.success('Arquivos baixados com sucesso.')
      }
    } catch (err: any) {
      toast.error('Erro ao encaminhar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!manageId) return
    setSaving(true)
    try {
      let bDigitalPath = null
      if (file) {
        const path = `bdigital_responses/${manageId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        await supabase.storage.from('ccb-docs').upload(path, file)
        bDigitalPath = path
      }

      const updateData: any = {
        status: statusVal,
        admin_notes: notes,
        updated_at: new Date().toISOString(),
      }
      if (bDigitalPath) updateData.bdigital_response_file = bDigitalPath

      const { error } = await supabase
        .from('ccb_solicitacoes')
        .update(updateData)
        .eq('id', manageId)
      if (error) throw error

      toast.success('Solicitação atualizada com sucesso.')
      setManageId(null)
      fetchRequests()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const openManage = (req: any) => {
    setManageId(req.id)
    setStatusVal(req.status)
    setNotes(req.admin_notes || '')
    setFile(null)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de CCB (BDIGITAL)</h1>
        <p className="text-muted-foreground">
          Analise as emissões solicitadas e encaminhe os documentos para a BDIGITAL.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações de CCB</CardTitle>
          <CardDescription>
            Fluxo de análise e encaminhamento de Cédula de Crédito Bancário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tomador</TableHead>
                <TableHead>Valor Solicitado</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Nenhuma solicitação.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.borrower_data?.name || req.profiles?.full_name}
                      <p className="text-xs text-muted-foreground">{req.borrower_data?.document}</p>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>{req.term_months} m</TableCell>
                    <TableCell className="text-sm">
                      {new Date(req.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === 'aprovada'
                            ? 'default'
                            : req.status === 'rejeitada'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className={
                          req.status === 'aprovada'
                            ? 'bg-emerald-500'
                            : req.status === 'em_analise'
                              ? 'bg-amber-500 hover:bg-amber-600'
                              : ''
                        }
                      >
                        {req.status === 'em_analise' ? 'Enviado BDIG' : req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setDocsModal(req)}>
                        <FileText className="h-4 w-4 mr-1" /> Docs ({renderDocs(req).length})
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEncaminhar(req)}
                        disabled={saving}
                        className={
                          req.status === 'pendente'
                            ? 'bg-[#00C2E0] hover:bg-[#00a9c4] text-white'
                            : ''
                        }
                      >
                        <Forward className="h-4 w-4 mr-1" />{' '}
                        {req.status === 'pendente' ? 'Encaminhar' : 'Baixar Docs'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openManage(req)}>
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

      <Dialog open={!!docsModal} onOpenChange={(v) => !v && setDocsModal(null)}>
        <DialogContent aria-describedby="docs-dialog-description">
          <DialogHeader>
            <DialogTitle>Documentos da Solicitação</DialogTitle>
            <DialogDescription id="docs-dialog-description">
              Visualize e baixe os documentos enviados pelo tomador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {docsModal &&
              renderDocs(docsModal).map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{doc.label}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ext = doc.path.split('.').pop() || 'pdf'
                      downloadFile(doc.path, `${doc.label.replace(/[^a-z0-9]/gi, '_')}.${ext}`)
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            {docsModal && renderDocs(docsModal).length === 0 && (
              <div className="text-center text-muted-foreground p-4">
                Nenhum documento encontrado.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocsModal(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manageId} onOpenChange={(v) => !v && setManageId(null)}>
        <DialogContent aria-describedby="manage-dialog-description">
          <DialogHeader>
            <DialogTitle>Gerenciar Solicitação BDIGITAL</DialogTitle>
            <DialogDescription id="manage-dialog-description">
              Atualize o status da solicitação e anexe os retornos ou comprovantes do parceiro
              emissor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Atualizar Status</Label>
              <Select value={statusVal} onValueChange={setStatusVal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Enviado BDIGITAL</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Upload Retorno BDIGITAL (Contrato/Comprovante)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Notas Internas</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo da recusa ou detalhes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar e Notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
