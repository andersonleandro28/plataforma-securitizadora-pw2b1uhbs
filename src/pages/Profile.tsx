import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Lock, User, Mail, Camera, Shield, Save, CheckCircle2 } from 'lucide-react'
import { AccessLogs } from '@/components/profile/AccessLogs'
import { UserBankAccounts } from '@/components/profile/UserBankAccounts'
import { KycDocuments } from '@/components/profile/KycDocuments'
import { maskDocument, validateDocument, onlyDigits } from '@/lib/cpf-cnpj'
import { getProfileCompleteness } from '@/lib/profile-completeness'

type EntityType = 'pf' | 'pj' | null | undefined

interface ProfileFormData {
  full_name: string
  phone: string
  document_number: string
  entity_type: EntityType
  // PF
  pf_rg: string
  pf_birth_date: string
  pf_nationality: string
  pf_mother_name: string
  pf_father_name: string
  pf_marital_status: string
  pf_occupation: string
  // PJ
  pj_company_name: string
  pj_trade_name: string
  pj_cnae: string
  pj_annual_revenue: string
  pj_tax_regime: string
  pj_rep_name: string
  // Endereço
  address_zip: string
  address_street: string
  address_number: string
  address_complement: string
  address_neighborhood: string
  address_city: string
  address_state: string
}

const emptyForm: ProfileFormData = {
  full_name: '',
  phone: '',
  document_number: '',
  entity_type: 'pf',
  pf_rg: '',
  pf_birth_date: '',
  pf_nationality: 'Brasileira',
  pf_mother_name: '',
  pf_father_name: '',
  pf_marital_status: '',
  pf_occupation: '',
  pj_company_name: '',
  pj_trade_name: '',
  pj_cnae: '',
  pj_annual_revenue: '',
  pj_tax_regime: '',
  pj_rep_name: '',
  address_zip: '',
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
}

function toDateInput(value: any): string {
  if (!value) return ''
  // value may be a full ISO timestamp or a yyyy-mm-dd date
  return String(value).slice(0, 10)
}

export default function Profile() {
  const { user, profile, signOut } = useAuth()

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loadingProfileUpdate, setLoadingProfileUpdate] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<ProfileFormData>(emptyForm)
  const [loadingDataUpdate, setLoadingDataUpdate] = useState(false)
  const [tab, setTab] = useState('basico')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  // Documentos KYC (contagem para a barra de progresso)
  const [docCount, setDocCount] = useState(0)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAvatarUrl(profile.avatar_url || '')

      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        document_number: maskDocument(
          profile.document_number || '',
          profile.entity_type as EntityType,
        ),
        entity_type: (profile.entity_type as EntityType) || 'pf',
        pf_rg: profile.pf_rg || '',
        pf_birth_date: toDateInput((profile as any).pf_birth_date),
        pf_nationality: profile.pf_nationality || 'Brasileira',
        pf_mother_name: profile.pf_mother_name || '',
        pf_father_name: profile.pf_father_name || '',
        pf_marital_status: profile.pf_marital_status || '',
        pf_occupation: profile.pf_occupation || '',
        pj_company_name: profile.pj_company_name || '',
        pj_trade_name: profile.pj_trade_name || '',
        pj_cnae: profile.pj_cnae || '',
        pj_annual_revenue:
          profile.pj_annual_revenue != null ? String(profile.pj_annual_revenue) : '',
        pj_tax_regime: profile.pj_tax_regime || '',
        pj_rep_name: profile.pj_rep_name || '',
        address_zip: profile.address_zip || '',
        address_street: profile.address_street || '',
        address_number: profile.address_number || '',
        address_complement: profile.address_complement || '',
        address_neighborhood: profile.address_neighborhood || '',
        address_city: profile.address_city || '',
        address_state: profile.address_state || '',
      })
    }
  }, [profile])

  // Carrega a contagem de documentos KYC do usuário
  useEffect(() => {
    const loadDocCount = async () => {
      const { count } = await supabase
        .from('kyc_documents')
        .select('*', { count: 'exact', head: true })
      setDocCount(count || 0)
    }
    loadDocCount()
    // Atualiza a contagem quando houver alterações de perfil
    const handler = () => loadDocCount()
    window.addEventListener('profile-updated', handler)
    return () => window.removeEventListener('profile-updated', handler)
  }, [])

  const updateField = (key: keyof ProfileFormData, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  // Mostra aba "Pessoal" se for PF ou já houver dados PF preenchidos
  const showPfTab =
    formData.entity_type === 'pf' ||
    !!(profile?.pf_rg || (profile as any)?.pf_birth_date || profile?.pf_mother_name)

  // Mostra aba "Empresa" se for PJ ou já houver dados PJ preenchidos
  const showPjTab =
    formData.entity_type === 'pj' ||
    !!(profile?.pj_company_name || profile?.pj_trade_name || profile?.pj_cnae)

  // ---- Máscara e validação de CPF/CNPJ ----
  const documentError = useMemo(() => {
    const raw = onlyDigits(formData.document_number)
    if (!raw) return ''
    const expectedLen = formData.entity_type === 'pj' ? 14 : 11
    if (raw.length < expectedLen) return '' // ainda digitando
    if (!validateDocument(formData.document_number, formData.entity_type)) {
      return formData.entity_type === 'pj'
        ? 'CNPJ inválido. Verifique os dígitos verificadores.'
        : 'CPF inválido. Verifique os dígitos verificadores.'
    }
    return ''
  }, [formData.document_number, formData.entity_type])

  const handleDocumentChange = (value: string) => {
    const masked = maskDocument(value, formData.entity_type)
    updateField('document_number', masked)
  }

  const handleEntityTypeChange = (v: string) => {
    // Reaplica a máscara adequada ao mudar o tipo
    const masked = maskDocument(formData.document_number, v as EntityType)
    setFormData((prev) => ({ ...prev, entity_type: v as EntityType, document_number: masked }))
  }

  // ---- Completude do perfil ----
  const completeness = useMemo(
    () => getProfileCompleteness(profile, docCount > 0),
    [profile, docCount],
  )

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/avatar_${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file)
      if (uploadError) throw uploadError
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      setAvatarUrl(publicUrl)
      toast.success('Foto de perfil atualizada.')
      window.dispatchEvent(new Event('profile-updated'))
    } catch {
      toast.error('Erro ao atualizar foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoadingProfileUpdate(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) toast.error('Erro ao atualizar perfil.')
    else {
      toast.success('Perfil atualizado.')
      window.dispatchEvent(new Event('profile-updated'))
    }
    setLoadingProfileUpdate(false)
  }

  const handleUpdateData = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Bloqueia o salvamento se o documento informado for inválido
    const rawDoc = onlyDigits(formData.document_number)
    if (rawDoc && !validateDocument(formData.document_number, formData.entity_type)) {
      const label = formData.entity_type === 'pj' ? 'CNPJ' : 'CPF'
      return toast.error(`${label} inválido. Corrija antes de salvar.`)
    }

    setLoadingDataUpdate(true)
    const payload: Record<string, any> = {
      full_name: formData.full_name,
      phone: formData.phone || null,
      // Armazena apenas os dígitos no banco
      document_number: rawDoc || null,
      entity_type: formData.entity_type || null,
      pf_rg: formData.pf_rg || null,
      pf_birth_date: formData.pf_birth_date || null,
      pf_nationality: formData.pf_nationality || null,
      pf_mother_name: formData.pf_mother_name || null,
      pf_father_name: formData.pf_father_name || null,
      pf_marital_status: formData.pf_marital_status || null,
      pf_occupation: formData.pf_occupation || null,
      pj_company_name: formData.pj_company_name || null,
      pj_trade_name: formData.pj_trade_name || null,
      pj_cnae: formData.pj_cnae || null,
      pj_annual_revenue: formData.pj_annual_revenue ? Number(formData.pj_annual_revenue) : null,
      pj_tax_regime: formData.pj_tax_regime || null,
      pj_rep_name: formData.pj_rep_name || null,
      address_zip: formData.address_zip || null,
      address_street: formData.address_street || null,
      address_number: formData.address_number || null,
      address_complement: formData.address_complement || null,
      address_neighborhood: formData.address_neighborhood || null,
      address_city: formData.address_city || null,
      address_state: formData.address_state || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
    if (error) {
      toast.error(error.message || 'Erro ao salvar dados cadastrais.')
    } else {
      toast.success('Dados cadastrais atualizados com sucesso.')
      window.dispatchEvent(new Event('profile-updated'))
    }
    setLoadingDataUpdate(false)
  }

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          address_neighborhood: data.bairro || prev.address_neighborhood,
          address_city: data.localidade || prev.address_city,
          address_state: data.uf || prev.address_state,
        }))
      }
    } catch {
      /* ignore */
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) return toast.error('A senha atual é obrigatória.')
    if (newPassword !== confirmPassword) return toast.error('As senhas não coincidem.')
    if (newPassword.length < 6) return toast.error('A nova senha deve ter pelo menos 6 caracteres.')

    setLoadingPassword(true)

    try {
      // 1. Verify current password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      })

      if (verifyError) {
        toast.error('A senha atual está incorreta.')
        setLoadingPassword(false)
        return
      }

      // 2. Update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      toast.success('Senha atualizada com sucesso. Por favor, faça login novamente.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // 3. Sign out user to force re-authentication (Security best practice)
      setTimeout(() => {
        signOut()
      }, 2000)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar a senha.')
    } finally {
      setLoadingPassword(false)
    }
  }

  const renderRoles = () => {
    if (!profile) return null
    const roles = []
    if (profile.is_admin) roles.push('Administrador')
    if (profile.is_staff) roles.push('Equipe Interna')
    if (profile.is_investor) roles.push('Investidor')
    if (profile.is_borrower) roles.push('Tomador')
    if (roles.length === 0) roles.push('Usuário')

    return roles.map((r) => (
      <Badge
        key={r}
        variant="outline"
        className="px-3 py-1 flex items-center gap-1.5 bg-muted/50 text-sm"
      >
        <Shield className="h-3.5 w-3.5 text-primary" /> {r}
      </Badge>
    ))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">Gerencie suas informações e segurança.</p>
        </div>
        <div className="flex flex-wrap gap-2">{renderRoles()}</div>
      </div>

      {/* Barra de progresso "Perfil Completo" */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              {completeness.percentage === 100 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
              <span className="font-medium">Perfil {completeness.percentage}% completo</span>
            </div>
            <Progress value={completeness.percentage} className="flex-1 h-3" />
            {completeness.percentage < 100 && (
              <p className="text-xs text-muted-foreground sm:max-w-xs">
                {completeness.missing.length > 0
                  ? `Pendências: ${completeness.missing.join(', ')}`
                  : 'Envie ao menos 1 documento KYC para concluir.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Avatar + Nome + Email (acima das abas) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Informações Pessoais
          </CardTitle>
          <CardDescription>Personalize sua conta.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateName}>
          <CardContent className="flex flex-col sm:flex-row gap-8">
            <div className="flex flex-col items-center gap-4 sm:border-r sm:pr-8">
              <Avatar className="h-28 w-28 border-2 shadow-sm">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-3xl bg-muted">
                  {fullName.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}{' '}
                Alterar Foto
              </Button>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email de Acesso
                </Label>
                <Input value={user?.email || ''} disabled className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome Completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t pt-6 bg-muted/20">
            <Button type="submit" disabled={loadingProfileUpdate}>
              {loadingProfileUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Dados Cadastrais em abas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Dados Cadastrais
          </CardTitle>
          <CardDescription>
            Mantenha seus dados cadastrais atualizados — espelham o cadastro KYC.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateData}>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="basico">Básico</TabsTrigger>
                {showPfTab && <TabsTrigger value="pessoal">Pessoal</TabsTrigger>}
                {showPjTab && <TabsTrigger value="empresa">Empresa</TabsTrigger>}
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
              </TabsList>

              {/* Aba Básico */}
              <TabsContent value="basico" className="space-y-4 pt-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email de Acesso</Label>
                    <Input value={user?.email || ''} disabled className="bg-muted/50" />
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado pelo perfil.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) => updateField('full_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone / WhatsApp</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF / CNPJ</Label>
                    <Input
                      value={formData.document_number}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder={
                        formData.entity_type === 'pj' ? '00.000.000/0001-00' : '000.000.000-00'
                      }
                      inputMode="numeric"
                      className={
                        documentError ? 'border-destructive focus-visible:ring-destructive' : ''
                      }
                    />
                    {documentError && <p className="text-xs text-destructive">{documentError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Entidade</Label>
                    <Select
                      value={formData.entity_type || 'pf'}
                      onValueChange={handleEntityTypeChange}
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
                </div>
              </TabsContent>

              {/* Aba Pessoal (PF) */}
              {showPfTab && (
                <TabsContent value="pessoal" className="space-y-4 pt-4 animate-fade-in">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RG</Label>
                      <Input
                        value={formData.pf_rg}
                        onChange={(e) => updateField('pf_rg', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={formData.pf_birth_date}
                        onChange={(e) => updateField('pf_birth_date', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nacionalidade</Label>
                      <Input
                        value={formData.pf_nationality}
                        onChange={(e) => updateField('pf_nationality', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Input
                        value={formData.pf_marital_status}
                        onChange={(e) => updateField('pf_marital_status', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da Mãe</Label>
                      <Input
                        value={formData.pf_mother_name}
                        onChange={(e) => updateField('pf_mother_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Pai (Opcional)</Label>
                      <Input
                        value={formData.pf_father_name}
                        onChange={(e) => updateField('pf_father_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Ocupação / Profissão</Label>
                      <Input
                        value={formData.pf_occupation}
                        onChange={(e) => updateField('pf_occupation', e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Aba Empresa (PJ) */}
              {showPjTab && (
                <TabsContent value="empresa" className="space-y-4 pt-4 animate-fade-in">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Razão Social</Label>
                      <Input
                        value={formData.pj_company_name}
                        onChange={(e) => updateField('pj_company_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Nome Fantasia</Label>
                      <Input
                        value={formData.pj_trade_name}
                        onChange={(e) => updateField('pj_trade_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CNAE</Label>
                      <Input
                        value={formData.pj_cnae}
                        onChange={(e) => updateField('pj_cnae', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faturamento Anual (R$)</Label>
                      <Input
                        type="number"
                        value={formData.pj_annual_revenue}
                        onChange={(e) => updateField('pj_annual_revenue', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Regime Tributário</Label>
                      <Select
                        value={formData.pj_tax_regime}
                        onValueChange={(v) => updateField('pj_tax_regime', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simples">Simples Nacional</SelectItem>
                          <SelectItem value="presumido">Lucro Presumido</SelectItem>
                          <SelectItem value="real">Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Representante Legal</Label>
                      <Input
                        value={formData.pj_rep_name}
                        onChange={(e) => updateField('pj_rep_name', e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Aba Endereço */}
              <TabsContent value="endereco" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={formData.address_zip}
                      onChange={(e) => updateField('address_zip', e.target.value)}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Rua / Logradouro</Label>
                    <Input
                      value={formData.address_street}
                      onChange={(e) => updateField('address_street', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.address_number}
                      onChange={(e) => updateField('address_number', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Complemento (Opcional)</Label>
                    <Input
                      value={formData.address_complement}
                      onChange={(e) => updateField('address_complement', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.address_neighborhood}
                      onChange={(e) => updateField('address_neighborhood', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.address_city}
                      onChange={(e) => updateField('address_city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input
                      value={formData.address_state}
                      onChange={(e) => updateField('address_state', e.target.value)}
                      maxLength={2}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-end border-t pt-6 bg-muted/20">
            <Button type="submit" disabled={loadingDataUpdate}>
              {loadingDataUpdate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar Dados
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Documentos KYC */}
      <KycDocuments />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <UserBankAccounts />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-accent" /> Credenciais
            </CardTitle>
            <CardDescription>Atualize sua senha de acesso.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Senha Atual</Label>
                <Input
                  type="password"
                  placeholder="Digite a senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nova Senha</Label>
                <Input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Confirmar Nova Senha</Label>
                <Input
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {loadingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Atualizar
                Senha
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <AccessLogs />
    </div>
  )
}
