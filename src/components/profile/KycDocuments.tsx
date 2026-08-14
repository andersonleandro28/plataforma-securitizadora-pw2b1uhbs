import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, UploadCloud, Loader2, Eye, Trash2, FileCheck2 } from 'lucide-react'

interface KycDocument {
  id: string
  document_type: string
  file_path: string
  status: string | null
  uploaded_at: string | null
  rejection_reason?: string | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  id_document: 'Documento de Identificação (RG/CNH)',
  id_front: 'Identificação (Frente)',
  id_back: 'Identificação (Verso)',
  selfie: 'Selfie com Documento',
  proof_address: 'Comprovante de Endereço',
  social_contract: 'Contrato Social / Estatuto',
  power_of_attorney: 'Procuração',
  marriage_cert: 'Certidão de Casamento',
  other: 'Outro Documento',
}

const labelForType = (type: string) => DOC_TYPE_LABELS[type] || type

const statusBadge = (status: string | null) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">Aprovado</Badge>
    case 'rejected':
      return <Badge variant="destructive">Reprovado</Badge>
    case 'under_review':
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200">
          Em Análise
        </Badge>
      )
    default:
      return <Badge variant="outline">Enviado</Badge>
  }
}

export function KycDocuments() {
  const [docs, setDocs] = useState<KycDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState<string>('id_document')
  const [file, setFile] = useState<File | null>(null)
  const [openingPath, setOpeningPath] = useState<string | null>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error) {
      toast.error('Erro ao carregar documentos.')
    } else {
      setDocs(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const handleUpload = async () => {
    if (!file) return toast.error('Selecione um arquivo para enviar.')
    setUploading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const filePath = `${user.id}/${docType}_${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file)
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase.from('kyc_documents').insert({
        user_id: user.id,
        document_type: docType,
        file_path: filePath,
        status: 'uploaded',
      })
      if (insertErr) throw insertErr

      toast.success('Documento enviado com sucesso.')
      setFile(null)
      // limpa o input resetando o valor
      const input = document.getElementById('kyc-doc-input') as HTMLInputElement | null
      if (input) input.value = ''
      await loadDocs()
      window.dispatchEvent(new Event('profile-updated'))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar documento.')
    } finally {
      setUploading(false)
    }
  }

  const handleView = async (filePath: string) => {
    setOpeningPath(filePath)
    try {
      const { data, error } = await supabase.storage
        .from('kyc-documents')
        .createSignedUrl(filePath, 300)
      if (error) throw error
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } catch {
      toast.error('Erro ao gerar link do documento.')
    } finally {
      setOpeningPath(null)
    }
  }

  const handleDelete = async (doc: KycDocument) => {
    if (!confirm('Tem certeza que deseja remover este documento?')) return
    try {
      // remove do storage (ignora erro se já não existir)
      await supabase.storage.from('kyc-documents').remove([doc.file_path])
      const { error } = await supabase.from('kyc_documents').delete().eq('id', doc.id)
      if (error) throw error
      toast.success('Documento removido.')
      await loadDocs()
      window.dispatchEvent(new Event('profile-updated'))
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover documento.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" /> Documentos KYC
        </CardTitle>
        <CardDescription>
          Envie e gerencie seus documentos de verificação (PDF, JPG ou PNG).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Documento</label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo</label>
            <Input
              id="kyc-doc-input"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/jpg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4 mr-2" />
            )}
            Enviar Documento
          </Button>
        </div>

        {/* Lista */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : docs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhum documento enviado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {labelForType(doc.document_type)}
                      </div>
                      {doc.status === 'rejected' && doc.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">{doc.rejection_reason}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.uploaded_at
                        ? new Date(doc.uploaded_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>{statusBadge(doc.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleView(doc.file_path)}
                          disabled={openingPath === doc.file_path}
                          title="Visualizar"
                        >
                          {openingPath === doc.file_path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
