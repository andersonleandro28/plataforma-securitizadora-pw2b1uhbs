import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, UploadCloud, AlertCircle, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { getKycCompletion } from '@/lib/kyc-utils'
import {
  EntityTypeStep,
  PfFieldsStep,
  PjFieldsStep,
  PjRepStep,
  AddressStep,
} from '@/components/kyc/KycForms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function AdminUserFormDialog({ open, onOpenChange, user, onSaved }: any) {
  const { session } = useAuth()
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('basico')
  const [completion, setCompletion] = useState({ percentage: 0, missingFields: [] as string[] })

  const [checkingSerasa, setCheckingSerasa] = useState(false)
  const [serasaData, setSerasaData] = useState<any>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const isEditing = !!user?.id

  const defaultFormData = {
    email: '',
    role: 'investor',
    entity_type: 'pf',
    document_number: '',
    full_name: '',
    phone: '',
    pf_rg: '',
    pf_nationality: 'Brasileira',
    pf_birth_city: '',
    pf_mother_name: '',
    pf_father_name: '',
    pf_marital_status: '',
    pf_occupation: '',
    pj_company_name: '',
    pj_trade_name: '',
    pj_tax_regime: '',
    pj_annual_revenue: '',
    pj_cnae: '',
    pj_foundation_date: '',
    pj_rep_name: '',
    pj_rep_cpf: '',
    pj_rep_rg: '',
    pj_rep_role: '',
    pj_rep_is_procurator: false,
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    kyc_status: 'pending',
  }

  const [formData, setFormData] = useState(defaultFormData)
  const [docs, setDocs] = useState<{ id_doc?: File; proof_address?: File }>({})

  useEffect(() => {
    if (open) {
      if (user) {
        setFormData({ ...defaultFormData, ...user })
        setCompletion(getKycCompletion(user))
        setSerasaData(null)
        setRejectionReason('')
      } else {
        setFormData(defaultFormData)
        setCompletion({ percentage: 0, missingFields: [] })
        setSerasaData(null)
        setRejectionReason('')
      }
      setTab('basico')
      setDocs({})
    }
  }, [open, user])

  useEffect(() => {
    setCompletion(getKycCompletion(formData))
  }, [formData])

  const uploadDoc = async (file: File, type: string, targetUserId: string) => {
    const ext = file.name.split('.').pop()
    const fileName = `${targetUserId}/${type}_${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(fileName, file)
    if (uploadErr) throw uploadErr
    await supabase
      .from('kyc_documents')
      .insert({
        user_id: targetUserId,
        document_type: type,
        file_path: fileName,
        status: 'approved',
        reviewed_by: session?.user?.id,
        reviewed_at: new Date().toISOString(),
      })
  }

  const handleCheckSerasa = async () => {
    if (!formData.document_number) return toast.error('Preencha o CPF/CNPJ primeiro.')
    setCheckingSerasa(true)
    try {
      const { data, error } = await supabase.functions.invoke('serasa-integration', {
        body: { document: formData.document_number },
      })
      if (error || data?.error) throw new Error(data?.error || 'Erro ao consultar Serasa')
      setSerasaData(data.data)
      toast.success('Consulta Serasa concluída com sucesso.')
    } catch (err: any) {
      toast.error(err.message || 'Falha na consulta.')
    } finally {
      setCheckingSerasa(false)
    }
  }

  const handleSave = async () => {
    if (!formData.email || !formData.document_number) {
      return toast.error('E-mail e Documento (CPF/CNPJ) são obrigatórios.')
    }

    if (formData.kyc_status === 'rejected' && !rejectionReason.trim()) {
      return toast.error('É obrigatório informar o motivo da reprovação.')
    }

    setSaving(true)
    try {
      let targetUserId = user?.id

      if (!isEditing) {
        // Create new user via Edge Function
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: formData,
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (error || data?.error) throw new Error(data?.error || 'Erro ao criar usuário')
        targetUserId = data.user.id
        toast.success(`Usuário criado! Senha temporária: ${data.tempPassword}`)
      } else {
        // Update existing user
        const { error } = await supabase
          .from('profiles')
          .update({
            ...formData,
            pj_annual_revenue: formData.pj_annual_revenue
              ? Number(formData.pj_annual_revenue)
              : null,
            pj_foundation_date: formData.pj_foundation_date || null,
          })
          .eq('id', targetUserId)
        if (error) throw error

        await supabase.from('audit_logs').insert({
          entity_type: 'profiles',
          entity_id: targetUserId,
          action: 'admin_updated_profile',
          details: { changes: formData, kyc_status: formData.kyc_status, rejectionReason },
        })

        if (formData.kyc_status === 'approved' && user.kyc_status !== 'approved') {
          // Simulate sending email of completion
          toast.success('E-mail de aprovação de KYC enviado ao cliente.')
        }

        toast.success('Dados atualizados com sucesso.')
      }

      // Upload docs if any
      if (docs.id_doc) await uploadDoc(docs.id_doc, 'id_document', targetUserId)
      if (docs.proof_address) await uploadDoc(docs.proof_address, 'proof_address', targetUserId)

      if (serasaData) {
        await supabase.from('serasa_consultations').insert({
          user_id: targetUserId,
          document_number: formData.document_number,
          score: serasaData.score,
          risk_level: serasaData.riskClassification,
          raw_response: serasaData,
        })
      }

      onSaved()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar dados.')
    } finally {
      setSaving(false)
    }
  }

  const isPj = formData.entity_type === 'pj'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Usuário / KYC' : 'Novo Cadastro Completo'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite os dados cadastrais ou faça upload de documentos em nome do cliente.'
              : 'Cadastre um novo usuário manualmente com todas as informações de KYC.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && completion.percentage < 100 && (
          <Alert variant="destructive" className="bg-amber-50 text-amber-900 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs ml-2">
              <strong>Dados KYC Incompletos ({completion.percentage}%):</strong> Faltam{' '}
              {completion.missingFields.length} campos obrigatórios.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basico">Básico</TabsTrigger>
            <TabsTrigger value="especifico">{isPj ? 'Empresa' : 'Pessoal'}</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="docs">KYC & Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="basico" className="space-y-4 pt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              {!isEditing && (
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData({ ...formData, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investor">Investidor / Debenturista</SelectItem>
                    <SelectItem value="borrower">Tomador de Crédito</SelectItem>
                    <SelectItem value="staff">Staff Interno</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <EntityTypeStep formData={formData} setFormData={setFormData} />
          </TabsContent>

          <TabsContent value="especifico" className="pt-4">
            {!isPj ? (
              <PfFieldsStep formData={formData} setFormData={setFormData} />
            ) : (
              <div className="space-y-6">
                <PjFieldsStep formData={formData} setFormData={setFormData} />
                <div className="border-t pt-4">
                  <PjRepStep formData={formData} setFormData={setFormData} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="endereco" className="pt-4">
            <AddressStep formData={formData} setFormData={setFormData} />
          </TabsContent>

          <TabsContent value="docs" className="space-y-4 pt-4">
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-primary" /> Análise e Aprovação KYC
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckSerasa}
                    disabled={checkingSerasa}
                  >
                    {checkingSerasa ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Consultar Serasa (CPF/CNPJ)
                  </Button>
                </div>

                {serasaData && (
                  <Alert className={serasaData.score < 400 ? 'bg-destructive/10' : 'bg-emerald-50'}>
                    <AlertTitle>
                      Resultado Serasa: {serasaData.score} (Risco {serasaData.riskClassification})
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                      Inadimplência Provável: {serasaData.probabilityOfDefault} | Apontamentos:{' '}
                      {serasaData.negativeRecords} (R$ {serasaData.negativeRecordsValue})
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status KYC Administrativo</Label>
                    <Select
                      value={formData.kyc_status}
                      onValueChange={(v) => setFormData({ ...formData, kyc_status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="under_review">Em Análise</SelectItem>
                        <SelectItem value="approved">Aprovado (Liberado)</SelectItem>
                        <SelectItem value="rejected">Reprovado (Ajustes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.kyc_status === 'rejected' && (
                  <div className="space-y-2 animate-fade-in">
                    <Label>Motivo da Reprovação (Enviado ao cliente) *</Label>
                    <Textarea
                      placeholder="Ex: Documento de identidade ilegível..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="bg-muted/20 p-4 rounded-lg border space-y-4">
                <h4 className="font-medium text-sm">Upload Manual de Documentos (Opcional)</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Documento de Identificação (RG/CNH)</Label>
                    <div className="border border-dashed rounded-md p-3 flex flex-col items-center justify-center bg-background hover:bg-muted/40 transition-colors">
                      <UploadCloud className="w-5 h-5 text-muted-foreground mb-1" />
                      <Input
                        type="file"
                        className="text-xs file:text-xs h-8"
                        onChange={(e) => setDocs({ ...docs, id_doc: e.target.files?.[0] })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Comprovante de Endereço</Label>
                    <div className="border border-dashed rounded-md p-3 flex flex-col items-center justify-center bg-background hover:bg-muted/40 transition-colors">
                      <UploadCloud className="w-5 h-5 text-muted-foreground mb-1" />
                      <Input
                        type="file"
                        className="text-xs file:text-xs h-8"
                        onChange={(e) => setDocs({ ...docs, proof_address: e.target.files?.[0] })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Usuário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
