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
import { Loader2, FileText, UploadCloud, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminCcbRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [manageId, setManageId] = useState<string | null>(null)
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

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage.from('ccb-docs').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
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
          Analise as emissões solicitadas e envie as respostas do banco.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações Pendentes</CardTitle>
          <CardDescription>
            Fluxo de análise e aprovação de Cédula de Crédito Bancário.
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
                        className={req.status === 'aprovada' ? 'bg-emerald-500' : ''}
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {req.pdf_file_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(req.pdf_file_path)}
                          title="Espelho"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => openManage(req)}>
                        <Eye className="h-4 w-4 mr-1" /> Gerir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!manageId} onOpenChange={(v) => !v && setManageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Solicitação BDIGITAL</DialogTitle>
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
                  <SelectItem value="em_analise">Em Análise BDIGITAL</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Retorno BDIGITAL (Contrato/Comprovante)</Label>
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
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
