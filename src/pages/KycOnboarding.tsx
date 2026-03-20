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
import {
  EntityTypeStep,
  PfFieldsStep,
  PjFieldsStep,
  PjRepStep,
  AddressStep,
} from '@/components/kyc/KycForms'

export default function KycOnboarding() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    entity_type: profile?.entity_type || 'pf',
    document_number: profile?.document_number || '',
    phone: profile?.phone || '',
    pf_rg: profile?.pf_rg || '',
    pf_nationality: profile?.pf_nationality || 'Brasileira',
    pf_birth_city: profile?.pf_birth_city || '',
    pf_mother_name: profile?.pf_mother_name || '',
    pf_father_name: profile?.pf_father_name || '',
    pf_marital_status: profile?.pf_marital_status || '',
    pf_occupation: profile?.pf_occupation || '',
    pj_company_name: profile?.pj_company_name || '',
    pj_trade_name: profile?.pj_trade_name || '',
    pj_tax_regime: profile?.pj_tax_regime || '',
    pj_annual_revenue: profile?.pj_annual_revenue || '',
    pj_cnae: profile?.pj_cnae || '',
    pj_foundation_date: profile?.pj_foundation_date || '',
    pj_rep_name: profile?.pj_rep_name || '',
    pj_rep_cpf: profile?.pj_rep_cpf || '',
    pj_rep_rg: profile?.pj_rep_rg || '',
    pj_rep_role: profile?.pj_rep_role || '',
    address_zip: profile?.address_zip || '',
    address_street: profile?.address_street || '',
    address_number: profile?.address_number || '',
    address_complement: profile?.address_complement || '',
    address_neighborhood: profile?.address_neighborhood || '',
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
                : 'Nossa equipe de compliance está validando suas informações e documentos.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPj = formData.entity_type === 'pj'
  const maxSteps = isPj ? 5 : 4
  const handleNext = () => setStep((s) => Math.min(s + 1, maxSteps))
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1))

  const uploadDoc = async (file: File, type: string) => {
    if (!user) return null
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${type}_${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('kyc-documents').upload(fileName, file)
    if (uploadErr) throw uploadErr
    await supabase
      .from('kyc_documents')
      .insert({ user_id: user.id, document_type: type, file_path: fileName })
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
          pj_annual_revenue: formData.pj_annual_revenue ? Number(formData.pj_annual_revenue) : null,
          lgpd_accepted_at: new Date().toISOString(),
          kyc_status: 'under_review',
        })
        .eq('id', user.id)

      if (error) throw error
      toast.success('Dossiê enviado com sucesso!')
      window.dispatchEvent(new Event('profile-updated'))
      setTimeout(() => navigate('/'), 1000)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Completar Cadastro (KYC)</h1>
        <p className="text-muted-foreground">
          Forneça os dados necessários para liberar seu acesso às operações.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 text-sm font-medium text-muted-foreground">
        <span className={step >= 1 ? 'text-primary' : ''}>1. Básico</span>
        <ChevronRight className="w-3 h-3" />
        <span className={step >= 2 ? 'text-primary' : ''}>2. {isPj ? 'Empresa' : 'Pessoal'}</span>
        <ChevronRight className="w-3 h-3" />
        {isPj && (
          <>
            <span className={step >= 3 ? 'text-primary' : ''}>3. Representante</span>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className={step >= (isPj ? 4 : 3) ? 'text-primary' : ''}>
          {isPj ? '4' : '3'}. Endereço
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className={step >= maxSteps ? 'text-primary' : ''}>{maxSteps}. Docs/Termos</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {step === 1 && <EntityTypeStep formData={formData} setFormData={setFormData} />}
          {step === 2 && !isPj && <PfFieldsStep formData={formData} setFormData={setFormData} />}
          {step === 2 && isPj && <PjFieldsStep formData={formData} setFormData={setFormData} />}
          {step === 3 && isPj && <PjRepStep formData={formData} setFormData={setFormData} />}
          {((step === 3 && !isPj) || (step === 4 && isPj)) && (
            <AddressStep formData={formData} setFormData={setFormData} />
          )}

          {step === maxSteps && (
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
              <div className="bg-muted/50 p-5 rounded-lg space-y-4 border">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="pep"
                    checked={formData.is_pep}
                    onCheckedChange={(c: boolean) => setFormData({ ...formData, is_pep: c })}
                  />
                  <Label htmlFor="pep" className="text-sm font-normal leading-snug">
                    Declaro que me enquadro como Pessoa Exposta Politicamente (PEP).
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="lgpd"
                    checked={formData.lgpd_accepted}
                    onCheckedChange={(c: boolean) => setFormData({ ...formData, lgpd_accepted: c })}
                  />
                  <Label htmlFor="lgpd" className="text-sm font-normal leading-snug">
                    Li e concordo com os Termos de Uso e Política de Privacidade. *
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
          {step < maxSteps ? (
            <Button onClick={handleNext}>Próxima Etapa</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="min-w-[140px]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
