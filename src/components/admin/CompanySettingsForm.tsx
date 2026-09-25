import { useState, useEffect } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import {
  Building2,
  Save,
  Loader2,
  FileCheck2,
  MapPin,
  UserCheck,
  Phone,
  Mail,
  ShieldCheck,
  Search,
} from 'lucide-react'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { CompanySettingsFormData, formatCompanyAddress } from '@/services/company-settings'
import {
  maskCnpj,
  maskCpf,
  maskPhone,
  maskCep,
  validateCnpj,
  validateCpf,
  onlyDigits,
} from '@/lib/cpf-cnpj'

export function CompanySettingsForm() {
  const { settings, loading, updateSettings, refresh } = useCompanySettings()
  const [saving, setSaving] = useState(false)
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false)
  const [lookingUpCep, setLookingUpCep] = useState(false)

  const [formData, setFormData] = useState<CompanySettingsFormData>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',
    inscricao_municipal: '',
    endereco_logradouro: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_uf: '',
    endereco_cep: '',
    telefone: '',
    email: '',
    representante_nome: '',
    representante_cargo: 'Sócio-Administrador',
    representante_cpf: '',
    capital_social: 0,
    registro_regulador: '',
  })

  // Sincroniza formulário com dados carregados
  useEffect(() => {
    if (settings) {
      setFormData({
        razao_social: settings.razao_social || '',
        nome_fantasia: settings.nome_fantasia || '',
        cnpj: settings.cnpj ? maskCnpj(settings.cnpj) : '',
        inscricao_estadual: settings.inscricao_estadual || '',
        inscricao_municipal: settings.inscricao_municipal || '',
        endereco_logradouro: settings.endereco_logradouro || '',
        endereco_numero: settings.endereco_numero || '',
        endereco_complemento: settings.endereco_complemento || '',
        endereco_bairro: settings.endereco_bairro || '',
        endereco_cidade: settings.endereco_cidade || '',
        endereco_uf: settings.endereco_uf || '',
        endereco_cep: settings.endereco_cep ? maskCep(settings.endereco_cep) : '',
        telefone: settings.telefone ? maskPhone(settings.telefone) : '',
        email: settings.email || '',
        representante_nome: settings.representante_nome || '',
        representante_cargo: settings.representante_cargo || 'Sócio-Administrador',
        representante_cpf: settings.representante_cpf ? maskCpf(settings.representante_cpf) : '',
        capital_social: settings.capital_social || 0,
        registro_regulador: settings.registro_regulador || '',
      })
    }
  }, [settings])

  // Busca automática na BrasilAPI por CNPJ
  const handleCnpjBlur = async () => {
    const raw = onlyDigits(formData.cnpj)
    if (raw.length !== 14) return
    if (!validateCnpj(raw)) {
      toast.error('CNPJ inválido. Verifique os dígitos informados.')
      return
    }

    setLookingUpCnpj(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`)
      if (res.ok) {
        const data = await res.json()
        setFormData((prev) => ({
          ...prev,
          razao_social: data.razao_social || prev.razao_social,
          nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
          endereco_logradouro: data.logradouro || prev.endereco_logradouro,
          endereco_numero: data.numero || prev.endereco_numero,
          endereco_complemento: data.complemento || prev.endereco_complemento,
          endereco_bairro: data.bairro || prev.endereco_bairro,
          endereco_cidade: data.municipio || prev.endereco_cidade,
          endereco_uf: data.uf || prev.endereco_uf,
          endereco_cep: data.cep || prev.endereco_cep,
          telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1) : prev.telefone,
          email: data.email?.toLowerCase() || prev.email,
          capital_social: data.capital_social ? Number(data.capital_social) : prev.capital_social,
        }))
        toast.success('Dados da empresa obtidos automaticamente da Receita Federal!')
      }
    } catch (err) {
      console.warn('Falha na consulta BrasilAPI CNPJ:', err)
    } finally {
      setLookingUpCnpj(false)
    }
  }

  // Busca automática por CEP
  const handleCepBlur = async () => {
    const rawCep = onlyDigits(formData.endereco_cep || '')
    if (rawCep.length !== 8) return

    setLookingUpCep(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${rawCep}`)
      if (res.ok) {
        const data = await res.json()
        setFormData((prev) => ({
          ...prev,
          endereco_logradouro: data.street || prev.endereco_logradouro,
          endereco_bairro: data.neighborhood || prev.endereco_bairro,
          endereco_cidade: data.city || prev.endereco_cidade,
          endereco_uf: data.state || prev.endereco_uf,
        }))
        toast.info('Endereço autocompletado pelo CEP.')
      }
    } catch (err) {
      console.warn('Falha na consulta de CEP:', err)
    } finally {
      setLookingUpCep(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.razao_social.trim()) {
      toast.error('Informe a Razão Social da Securitizadora.')
      return
    }

    const cleanCnpj = onlyDigits(formData.cnpj)
    if (!cleanCnpj) {
      toast.error('Informe o CNPJ da Securitizadora.')
      return
    }

    if (cleanCnpj.length !== 14 || !validateCnpj(cleanCnpj)) {
      toast.error('CNPJ inválido. Por favor confira os 14 dígitos.')
      return
    }

    if (formData.representante_cpf) {
      const cleanCpf = onlyDigits(formData.representante_cpf)
      if (cleanCpf && (cleanCpf.length !== 11 || !validateCpf(cleanCpf))) {
        toast.error('CPF do representante legal inválido.')
        return
      }
    }

    setSaving(true)
    try {
      await updateSettings({
        ...formData,
        cnpj: maskCnpj(cleanCnpj),
        telefone: formData.telefone ? maskPhone(formData.telefone) : null,
        representante_cpf: formData.representante_cpf
          ? maskCpf(onlyDigits(formData.representante_cpf))
          : null,
        endereco_cep: formData.endereco_cep ? maskCep(formData.endereco_cep) : null,
      })
      toast.success(
        'Dados da Securitizadora atualizados com sucesso! Todos os novos contratos e documentos já utilizarão estas informações.',
      )
      await refresh()
    } catch (err: any) {
      console.error('Erro ao salvar dados da securitizadora:', err)
      toast.error('Erro ao salvar dados: ' + (err.message || 'Falha desconhecida'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados da securitizadora...</p>
      </div>
    )
  }

  // Preâmbulo de demonstração em tempo real
  const previewAddress = formatCompanyAddress(formData)
  const previewPreambulo = `${formData.razao_social || '[RAZÃO SOCIAL DA SECURITIZADORA]'}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${formData.cnpj || '[CNPJ]'}, com sede em ${previewAddress || '[ENDEREÇO COMPLETO]'}${formData.inscricao_estadual ? `, Inscrição Estadual nº ${formData.inscricao_estadual}` : ''}${formData.registro_regulador ? `, marco regulatório (${formData.registro_regulador})` : ''}${formData.representante_nome ? `, neste ato representada por seu ${formData.representante_cargo || 'Sócio-Administrador'}, Sr(a). ${formData.representante_nome}${formData.representante_cpf ? `, CPF nº ${formData.representante_cpf}` : ''}` : ''}, doravante denominada simplesmente "CESSIONÁRIA".`

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Alerta explicativo */}
      <Alert className="bg-primary/5 border-primary/20 text-foreground">
        <Building2 className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs">
          <strong>Fonte Única Cadastral:</strong> Estes dados alimentam automaticamente o cabeçalho,
          preâmbulo e rodapé de todos os contratos de cessão, aditivos contratuais, CCBs, termos de
          subscrição de debêntures, recibos de liquidação e relatórios oficiais gerados pelo
          sistema.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bloco 1: Identificação Institucional */}
        <Card className="border-t-4 border-t-primary shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Identificação da Securitizadora
            </CardTitle>
            <CardDescription className="text-xs">
              Razão Social, Nome Fantasia, CNPJ e Inscrições
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Razão Social *</Label>
              <Input
                value={formData.razao_social}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                placeholder="Ex: Nexum Securitizadora S.A."
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome Fantasia</Label>
              <Input
                value={formData.nome_fantasia || ''}
                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                placeholder="Ex: Nexum Security 360º"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">CNPJ *</Label>
                  {lookingUpCnpj && (
                    <span className="text-[10px] text-primary flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: maskCnpj(e.target.value) })}
                    onBlur={handleCnpjBlur}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    required
                  />
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Capital Social (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.capital_social || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, capital_social: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="1000000.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Inscrição Estadual (IE)</Label>
                <Input
                  value={formData.inscricao_estadual || ''}
                  onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                  placeholder="Isento ou Nº da IE"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Inscrição Municipal (IM)</Label>
                <Input
                  value={formData.inscricao_municipal || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, inscricao_municipal: e.target.value })
                  }
                  placeholder="Nº da Inscrição Municipal"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Registro / Marco Regulatório</Label>
              <Input
                value={formData.registro_regulador || ''}
                onChange={(e) => setFormData({ ...formData, registro_regulador: e.target.value })}
                placeholder="Ex: CVM nº 60/2021 / Lei 14.430/2022"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Representação Legal e Contato */}
        <Card className="border-t-4 border-t-primary shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              Representante Legal & Contatos
            </CardTitle>
            <CardDescription className="text-xs">
              Signatário oficial dos preâmbulos contratuais e dados para correspondência
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Representante Legal</Label>
              <Input
                value={formData.representante_nome || ''}
                onChange={(e) => setFormData({ ...formData, representante_nome: e.target.value })}
                placeholder="Nome completo do administrador/diretor"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Cargo do Representante</Label>
                <Input
                  value={formData.representante_cargo || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, representante_cargo: e.target.value })
                  }
                  placeholder="Ex: Sócio-Administrador, Diretor"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">CPF do Representante</Label>
                <Input
                  value={formData.representante_cpf ?? ''}
                  onChange={(e) => {
                    const rawDigits = onlyDigits(e.target.value)
                    setFormData((prev) => ({
                      ...prev,
                      representante_cpf: maskCpf(rawDigits),
                    }))
                  }}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Telefone / WhatsApp
                </Label>
                <Input
                  value={formData.telefone ?? ''}
                  onChange={(e) => {
                    const rawDigits = onlyDigits(e.target.value)
                    setFormData((prev) => ({
                      ...prev,
                      telefone: maskPhone(rawDigits),
                    }))
                  }}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  inputMode="tel"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" /> E-mail Institucional
                </Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@empresa.com.br"
                />
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Assinaturas Digitais
              </div>
              <p>
                O representante cadastrado acima será o signatário padrão da Securitizadora em
                envelopes eletrônicos de aditivos e contratos (DocuSign/Assinatura Interna).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloco 3: Endereço da Sede */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Endereço da Sede Social
          </CardTitle>
          <CardDescription className="text-xs">
            Localização física da securitizadora para preâmbulos e foro contratual
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">CEP</Label>
                {lookingUpCep && (
                  <span className="text-[10px] text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> CEP...
                  </span>
                )}
              </div>
              <Input
                value={formData.endereco_cep ?? ''}
                onChange={(e) => {
                  const rawDigits = onlyDigits(e.target.value)
                  setFormData((prev) => ({
                    ...prev,
                    endereco_cep: maskCep(rawDigits),
                  }))
                }}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                maxLength={9}
                inputMode="numeric"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold">Logradouro (Rua, Av, etc.)</Label>
              <Input
                value={formData.endereco_logradouro || ''}
                onChange={(e) => setFormData({ ...formData, endereco_logradouro: e.target.value })}
                placeholder="Ex: Avenida Brasil"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Número</Label>
              <Input
                value={formData.endereco_numero || ''}
                onChange={(e) => setFormData({ ...formData, endereco_numero: e.target.value })}
                placeholder="Ex: 123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Complemento / Sala</Label>
              <Input
                value={formData.endereco_complemento || ''}
                onChange={(e) => setFormData({ ...formData, endereco_complemento: e.target.value })}
                placeholder="Ex: Sala 402, Bloco B"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Bairro</Label>
              <Input
                value={formData.endereco_bairro || ''}
                onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })}
                placeholder="Ex: Centro"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cidade</Label>
              <Input
                value={formData.endereco_cidade || ''}
                onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
                placeholder="Ex: Criciúma"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">UF</Label>
              <Input
                value={formData.endereco_uf || ''}
                onChange={(e) =>
                  setFormData({ ...formData, endereco_uf: e.target.value.toUpperCase() })
                }
                placeholder="SC"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloco 4: Espelho e Demonstração do Preâmbulo */}
      <Card className="bg-slate-50 dark:bg-slate-900/50 border-dashed shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
            Visualização Prévia do Preâmbulo Contratual Gerado
          </CardTitle>
          <CardDescription className="text-xs">
            Como os contratos, aditivos de cessão e termos exibirão a qualificação da
            securitizadora:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-background rounded-lg border font-serif text-xs sm:text-sm leading-relaxed text-foreground shadow-inner">
            <p className="text-justify">{previewPreambulo}</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {settings?.updated_at
              ? `Última atualização em: ${new Date(settings.updated_at).toLocaleString('pt-BR')}`
              : 'Configuração padrão do sistema'}
          </span>
          <Button type="submit" disabled={saving} className="gap-2 px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Dados da Securitizadora
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
