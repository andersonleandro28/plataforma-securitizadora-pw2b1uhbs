import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Loader2,
  UploadCloud,
  CheckCircle2,
  ShieldCheck,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function KycOnboarding() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    entity_type: profile?.entity_type || 'pf',
    document_number: profile?.document_number || '',
    phone: profile?.phone || '',
    address_zip: profile?.address_zip || '',
    address_street: profile?.address_street || '',
    address_number: profile?.address_number || '',
    address_city: profile?.address_city || '',
    address_state: profile?.address_state || '',
    is_pep: profile?.is_pep || false,
    lgpd_accepted: profile?.lgpd_accepted || false,
  })

  const [docs, setDocs] = useState<{ id_doc?: File; proof_address?: File }>({})

  const isReview = profile?.kyc_status === 'under_review' || profile?.kyc_status === 'approved'

  if (isReview) {
    return (
      <div className="max-w-2xl mx-auto mt-10 animate-fade-in-up">
        <Card className="text-center py-10">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {profile?.kyc_status === 'approved' ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              ) : (
                <ShieldCheck className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {profile?.kyc_status === 'approved' ? 'Cadastro Aprovado' : 'Documentação em Análise'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {profile?.kyc_status === 'approved'
                ? 'Seu cadastro está completo e verificado em nossa plataforma.'
                : 'Nossa equipe de compliance está validando suas informações e documentos. Isso pode levar até 1 dia útil.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleNext = () => setStep((s) => s + 1)
  const handlePrev = () => setStep((s) => s - 1)

  const uploadDoc = async (file: File, type: string) => {
    if (!user) return null
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${type}_${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(fileName, file)
    if (uploadErr) throw uploadErr

    const { error: dbErr } = await supabase.from('kyc_documents').insert({
      user_id: user.id,
      document_type: type,
      file_path: fileName,
    })
    if (dbErr) throw dbErr
  }

  const handleSubmit = async () => {
    if (!user) return
    if (!formData.lgpd_accepted) return toast.error('É necessário aceitar os termos da LGPD.')
    if (!docs.id_doc) return toast.error('O Documento de Identificação é obrigatório.')

    setLoading(true)
    try {
      if (docs.id_doc) await uploadDoc(docs.id_doc, 'id_document')
      if (docs.proof_address) await uploadDoc(docs.proof_address, 'proof_address')

      const { error } = await supabase
        .from('profiles')
        .update({
          ...formData,
          lgpd_accepted_at: new Date().toISOString(),
          kyc_status: 'under_review',
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Dossiê de cadastro enviado com sucesso!')
      window.dispatchEvent(new Event('profile-updated'))
      setTimeout(() => navigate('/'), 1000)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao enviar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Completar Cadastro (KYC)</h1>
        <p className="text-muted-foreground">
          Siga as etapas obrigatórias para liberar seu acesso às operações da plataforma.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 text-sm font-medium text-muted-foreground">
        <span className={step >= 1 ? 'text-primary' : ''}>1. Dados Cadastrais</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step >= 2 ? 'text-primary' : ''}>2. Endereço</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step >= 3 ? 'text-primary' : ''}>3. Documentos e Termos</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Entidade</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(v: any) => setFormData({ ...formData, entity_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ *</Label>
                  <Input
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    placeholder={
                      formData.entity_type === 'pf' ? '000.000.000-00' : '00.000.000/0001-00'
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1">
                  <Label>CEP</Label>
                  <Input
                    value={formData.address_zip}
                    onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Rua / Logradouro</Label>
                  <Input
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={formData.address_number}
                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={formData.address_city}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Input
                    value={formData.address_state}
                    onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <Label>Documento de Identificação (RG/CNH ou Contrato Social) *</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors">
                  <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                  <Input
                    type="file"
                    className="max-w-xs"
                    onChange={(e) => setDocs({ ...docs, id_doc: e.target.files?.[0] })}
                    accept=".pdf,image/*"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Formatos aceitos: PDF, JPG, PNG.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Comprovante de Endereço (Últimos 90 dias)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors">
                  <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                  <Input
                    type="file"
                    className="max-w-xs"
                    onChange={(e) => setDocs({ ...docs, proof_address: e.target.files?.[0] })}
                    accept=".pdf,image/*"
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-5 rounded-lg space-y-4 mt-6 border">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="pep"
                    checked={formData.is_pep}
                    onCheckedChange={(c: boolean) => setFormData({ ...formData, is_pep: c })}
                  />
                  <Label htmlFor="pep" className="text-sm font-normal leading-snug">
                    Declaro, sob as penas da lei, que me enquadro como Pessoa Exposta Politicamente
                    (PEP), nos termos da regulamentação do COAF.
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="lgpd"
                    checked={formData.lgpd_accepted}
                    onCheckedChange={(c: boolean) => setFormData({ ...formData, lgpd_accepted: c })}
                  />
                  <Label htmlFor="lgpd" className="text-sm font-normal leading-snug">
                    Li e concordo com os Termos de Uso e Política de Privacidade. Autorizo o
                    tratamento dos meus dados pessoais em conformidade com a LGPD. *
                  </Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-5 bg-card">
          <Button variant="outline" onClick={handlePrev} disabled={step === 1 || loading}>
            Voltar
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext}>Próxima Etapa</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="min-w-[140px]">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enviar para Análise
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
