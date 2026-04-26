import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ChevronRight, Calculator, Info } from 'lucide-react'
import { FileUpload } from '@/components/operations/FileUpload'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'

const InputField = ({ label, value, onChange, className, ...props }: any) => (
  <div className={`space-y-2 ${className || ''}`}>
    <Label>{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} {...props} />
  </div>
)

const FileField = ({ label, onChange }: { label: string; onChange: (f: File) => void }) => (
  <div className="space-y-2">
    <Label className="text-xs">{label}</Label>
    <Input
      type="file"
      accept="image/*,.pdf"
      onChange={(e) => onChange(e.target.files?.[0] as File)}
    />
  </div>
)

export function CcbWizard({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [ccbConfig, setCcbConfig] = useState<any>(null)
  const [entityType, setEntityType] = useState<'pf' | 'pj'>(
    profile?.entity_type === 'pj' ? 'pj' : 'pf',
  )

  useEffect(() => {
    supabase
      .from('config_ccb')
      .select('*')
      .single()
      .then(({ data }) => data && setCcbConfig(data))
  }, [])

  const [kycData, setKycData] = useState({
    name: profile?.full_name || profile?.pj_company_name || '',
    document: profile?.document_number || '',
    dob: profile?.pf_birth_date || '',
    maritalStatus: profile?.pf_marital_status || 'solteiro',
    occupation: profile?.pf_occupation || '',
    income: profile?.pj_annual_revenue ? String(profile.pj_annual_revenue / 12) : '',
    foundationDate: profile?.pj_foundation_date || '',
    cnae: profile?.pj_cnae || '',
    zip: profile?.address_zip || '',
    street: profile?.address_street || '',
    number: profile?.address_number || '',
    neighborhood: profile?.address_neighborhood || '',
    city: profile?.address_city || '',
    state: profile?.address_state || '',
    phone: profile?.phone || '',
    email: profile?.email || user?.email || '',
  })

  const [partnerData, setPartnerData] = useState({
    name: '',
    document: '',
    rg: '',
    dob: '',
    maritalStatus: 'solteiro',
    occupation: '',
    participation: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  })

  const [spouseData, setSpouseData] = useState({
    name: '',
    document: '',
    dob: '',
    phone: '',
    email: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
  })

  const [bankData, setBankData] = useState({
    bank: '',
    branch: '',
    account: '',
    owner_name: '',
    owner_document: '',
    pix_key: '',
  })

  const [opData, setOpData] = useState<any>({
    requestedValue: '10000',
    termMonths: '12',
    purpose: '',
    creditType: '',
    proposedRate: '',
    simulation: {},
  })

  const [guarData, setGuarData] = useState({
    guaranteeType: '',
    receivableType: 'duplicatas',
    sacados: [] as any[],
  })

  const [guarantorData, setGuarantorData] = useState({
    name: '',
    document: '',
    dob: '',
    phone: '',
    email: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    income: '',
    relationship: '',
  })

  const [docsFiles, setDocsFiles] = useState<any>({ bankExtracts: [], additionalDocs: [] })
  const handleFile = (key: string, file?: File) =>
    file && setDocsFiles((p: any) => ({ ...p, [key]: file }))

  const isVehicle =
    opData.creditType?.toUpperCase().includes('VEICULO') || guarData.guaranteeType === 'veiculo'
  const isAval =
    opData.creditType?.toUpperCase().includes('AVAL') || guarData.guaranteeType === 'avalista'

  const [simData, setSimData] = useState({ installment_value: 0, total_to_pay: 0, cet: 0 })
  const [schedule, setSchedule] = useState<any[]>([])

  useEffect(() => {
    if (ccbConfig && opData.requestedValue && opData.termMonths) {
      const pv = Number(opData.requestedValue)
      const n = Number(opData.termMonths)
      const rate = (Number(ccbConfig.interest_rate_monthly) || 0) / 100

      let pmt = pv / n
      if (rate > 0) pmt = (pv * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)

      const fixedCost = Number(ccbConfig.fixed_emission_cost) || 0
      const iofFixedRate = Number(ccbConfig.iof_rate) || 0.38
      const iofDaily30 = Number(ccbConfig.iof_daily_rate_30) || 0.0041
      const iofDailyAfter = Number(ccbConfig.iof_daily_rate_after) || 0.00274
      const iofFixo = pv * (iofFixedRate / 100)

      let saldo = pv,
        totalIofDiario = 0
      const newSchedule = []

      for (let i = 1; i <= n; i++) {
        const juros = saldo * rate
        const amortizacao = pmt - juros
        const days = i * 30
        const days1to30 = Math.min(days, 30)
        const daysAfter = Math.max(0, days - 30)
        const iofDiarioParcela =
          amortizacao * (days1to30 * (iofDaily30 / 100) + daysAfter * (iofDailyAfter / 100))

        totalIofDiario += iofDiarioParcela
        saldo -= amortizacao
        newSchedule.push({
          month: i,
          amortizacao,
          juros,
          pmt_base: pmt,
          iof_diario: iofDiarioParcela,
          saldo_devedor: Math.max(0, saldo),
        })
      }

      const totalIof = iofFixo + totalIofDiario
      const parcelaFinal = pmt + totalIof / n + fixedCost / n
      const totalToPay = parcelaFinal * n

      let low = 0.0,
        high = 1.0,
        r = 0.0
      for (let i = 0; i < 50; i++) {
        r = (low + high) / 2
        const currentPv = (parcelaFinal * (1 - Math.pow(1 + r, -n))) / r
        if (currentPv > pv) low = r
        else high = r
      }

      setSchedule(newSchedule)
      setSimData({
        installment_value: parcelaFinal,
        total_to_pay: totalToPay,
        cet: (Math.pow(1 + r, 12) - 1) * 100,
      })
      setOpData((prev: any) => ({
        ...prev,
        simulation: {
          installment_value: parcelaFinal,
          total_to_pay: totalToPay,
          cet: (Math.pow(1 + r, 12) - 1) * 100,
          rate_used: rate,
          fixed_cost: fixedCost,
          iof_fixo: iofFixo,
          iof_diario: totalIofDiario,
          total_iof: totalIof,
          schedule: newSchedule,
        },
      }))
    }
  }, [opData.requestedValue, opData.termMonths, ccbConfig])

  const fetchCep = async (zip: string, setFn: any) => {
    if (zip.length >= 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${zip.replace(/\D/g, '')}/json/`)
        const data = await res.json()
        if (!data.erro)
          setFn((p: any) => ({
            ...p,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }))
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const fetchCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (cleanCnpj.length === 14) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
        const data = await res.json()
        if (data.razao_social) {
          setKycData((p) => ({
            ...p,
            name: data.razao_social,
            foundationDate: data.data_inicio_atividade || p.foundationDate,
            cnae: data.cnae_fiscal_descricao || p.cnae,
            zip: data.cep || p.zip,
            street: data.logradouro || p.street,
            number: data.numero || p.number,
            neighborhood: data.bairro || p.neighborhood,
            city: data.municipio || p.city,
            state: data.uf || p.state,
          }))
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const renderAddress = (data: any, setData: any, title?: string) => (
    <div className="space-y-4 pt-2">
      {title && <h4 className="font-semibold text-sm">{title}</h4>}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            value={data.zip}
            onBlur={() => fetchCep(data.zip, setData)}
            onChange={(e) => setData({ ...data, zip: e.target.value })}
          />
        </div>
        <InputField
          className="md:col-span-2"
          label="Rua"
          value={data.street}
          onChange={(v: string) => setData({ ...data, street: v })}
        />
        <InputField
          label="Número"
          value={data.number}
          onChange={(v: string) => setData({ ...data, number: v })}
        />
        <InputField
          className="md:col-span-2"
          label="Bairro"
          value={data.neighborhood}
          onChange={(v: string) => setData({ ...data, neighborhood: v })}
        />
        <InputField
          className="md:col-span-2"
          label="Cidade/UF"
          value={`${data.city} - ${data.state}`}
          disabled
          className="bg-muted/50"
        />
      </div>
    </div>
  )

  const handleNext = () => {
    if (step === 1) {
      if (!kycData.name || !kycData.document)
        return toast.error('Preencha Nome/Razão Social e Documento.')
    }
    if (step === 2) {
      if (entityType === 'pj' && (!partnerData.name || !partnerData.document))
        return toast.error('Preencha os dados do Sócio Administrador.')
      if (
        entityType === 'pf' &&
        kycData.maritalStatus === 'casado' &&
        (!spouseData.name || !spouseData.document)
      )
        return toast.error('Preencha os dados do Cônjuge.')
    }
    if (step === 3) {
      if (!opData.requestedValue || !opData.termMonths || !opData.creditType)
        return toast.error('Preencha valor, prazo e tipo de crédito.')
      if (!bankData.bank || !bankData.account) return toast.error('Preencha os dados bancários.')
    }
    setStep((s) => Math.min(s + 1, 4))
  }

  const handleSubmit = async () => {
    if (!user) return
    setLoading(true)
    try {
      const docsPaths: any = {}
      const upload = async (f: File, key: string, b = 'ccb-docs') => {
        const path = `${user.id}/${Date.now()}_${key}_${f.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const { error } = await supabase.storage.from(b).upload(path, f)
        if (error) throw error
        docsPaths[key] = path
      }

      const fMap: any = {
        id_front: docsFiles.idFront,
        id_back: docsFiles.idBack,
        selfie: docsFiles.selfie,
        proof_address: docsFiles.proofAddress,
        vehicle_doc: docsFiles.vehicleDoc,
        social_contract: docsFiles.socialContract,
        cnpj_card: docsFiles.cnpjCard,
        revenue_proof: docsFiles.revenueProof,
        partner_id_front: docsFiles.partnerIdFront,
        partner_id_back: docsFiles.partnerIdBack,
        partner_selfie: docsFiles.partnerSelfie,
        partner_address: docsFiles.partnerAddress,
        partner_ir: docsFiles.partnerIr,
      }
      for (const [k, f] of Object.entries(fMap)) if (f) await upload(f as File, k)

      for (const [k, f] of Object.entries({
        marriage_cert: docsFiles.marriageCert,
        spouse_id_front: docsFiles.spouseIdFront,
        spouse_id_back: docsFiles.spouseIdBack,
        spouse_selfie: docsFiles.spouseSelfie,
        spouse_address: docsFiles.spouseAddress,
      } as any))
        if (f) await upload(f as File, k, 'ccb_conjuges_docs')

      for (const [k, f] of Object.entries({
        guarantor_id_front: docsFiles.guarantorIdFront,
        guarantor_id_back: docsFiles.guarantorIdBack,
        guarantor_selfie: docsFiles.guarantorSelfie,
        guarantor_address: docsFiles.guarantorAddress,
        guarantor_income: docsFiles.guarantorIncome,
      } as any))
        if (f) await upload(f as File, k, 'ccb_avalistas_docs')

      const uArr = async (files: File[], key: string) => {
        docsPaths[key] = []
        for (let i = 0; i < files.length; i++) {
          const path = `${user.id}/${Date.now()}_${key}_${i}_${files[i].name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          await supabase.storage.from('ccb-docs').upload(path, files[i])
          docsPaths[key].push(path)
        }
      }
      await uArr(docsFiles.bankExtracts, 'bankExtracts')
      await uArr(docsFiles.additionalDocs, 'additionalDocs')

      const { data, error } = await supabase.functions.invoke('submit-ccb', {
        body: {
          entityType,
          borrowerData: { ...kycData, entityType },
          partnerData: entityType === 'pj' ? partnerData : null,
          spouseData: entityType === 'pf' && kycData.maritalStatus === 'casado' ? spouseData : null,
          operationData: opData,
          guaranteesData: guarData,
          guarantorData: isAval ? guarantorData : null,
          bankData,
          docsPaths,
        },
      })
      if (error || data?.error) throw new Error(data?.error || error?.message)
      toast.success('Solicitação enviada com sucesso!')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-t-4 border-t-[#00C2E0] shadow-md relative overflow-hidden">
      <div className="bg-[#00C2E0]/10 p-4 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Formulário de Emissão BDIGITAL</h2>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para gerar sua simulação e CCB.
          </p>
        </div>
        <div className="w-full md:w-1/3">
          <div className="flex justify-between text-xs font-medium mb-1 text-muted-foreground">
            <span>Progresso</span>
            <span>{step * 25}%</span>
          </div>
          <Progress value={step * 25} className="h-2" />
        </div>
      </div>
      <CardContent className="p-6 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <h3 className="font-semibold text-lg border-b pb-2">
              1. Dados do Solicitante (Empresa/PF)
            </h3>
            <div className="flex items-center gap-6 mb-4 bg-muted/20 p-3 rounded-md border">
              <Label className="text-base font-semibold">Tipo de Solicitante:</Label>
              <RadioGroup
                value={entityType}
                onValueChange={(v: any) => setEntityType(v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pf" id="pf" />
                  <Label htmlFor="pf">Pessoa Física</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pj" id="pj" />
                  <Label htmlFor="pj">Pessoa Jurídica</Label>
                </div>
              </RadioGroup>
            </div>

            {entityType === 'pj' ? (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <InputField
                    className="md:col-span-2"
                    label="Razão Social *"
                    value={kycData.name}
                    onChange={(v: string) => setKycData({ ...kycData, name: v })}
                  />
                  <div className="space-y-2">
                    <Label>CNPJ *</Label>
                    <Input
                      value={kycData.document}
                      onBlur={(e) => fetchCnpj(e.target.value)}
                      onChange={(e) => setKycData({ ...kycData, document: e.target.value })}
                    />
                  </div>
                  <InputField
                    label="Data de Fundação"
                    type="date"
                    value={kycData.foundationDate}
                    onChange={(v: string) => setKycData({ ...kycData, foundationDate: v })}
                  />
                  <InputField
                    label="Faturamento Médio Mensal"
                    type="number"
                    value={kycData.income}
                    onChange={(v: string) => setKycData({ ...kycData, income: v })}
                  />
                  <InputField
                    label="CNAE Principal"
                    value={kycData.cnae}
                    onChange={(v: string) => setKycData({ ...kycData, cnae: v })}
                  />
                </div>
                {renderAddress(kycData, setKycData, 'Endereço Comercial')}
              </>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <InputField
                    className="md:col-span-2"
                    label="Nome Completo *"
                    value={kycData.name}
                    onChange={(v: string) => setKycData({ ...kycData, name: v })}
                  />
                  <InputField
                    label="CPF *"
                    value={kycData.document}
                    onChange={(v: string) => setKycData({ ...kycData, document: v })}
                  />
                  <InputField
                    label="Data Nasc."
                    type="date"
                    value={kycData.dob}
                    onChange={(v: string) => setKycData({ ...kycData, dob: v })}
                  />
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select
                      value={kycData.maritalStatus}
                      onValueChange={(v) => setKycData({ ...kycData, maritalStatus: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <InputField
                    label="Profissão"
                    value={kycData.occupation}
                    onChange={(v: string) => setKycData({ ...kycData, occupation: v })}
                  />
                  <InputField
                    label="Renda Mensal"
                    type="number"
                    value={kycData.income}
                    onChange={(v: string) => setKycData({ ...kycData, income: v })}
                  />
                </div>
                {renderAddress(kycData, setKycData, 'Endereço Residencial')}
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="font-semibold text-lg border-b pb-2">2. Sócios e Intervenientes</h3>
            {entityType === 'pj' && (
              <div className="space-y-4">
                <h4 className="font-semibold text-primary">
                  Sócio Administrador / Avalista Principal *
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <InputField
                    className="md:col-span-2"
                    label="Nome Completo"
                    value={partnerData.name}
                    onChange={(v: string) => setPartnerData({ ...partnerData, name: v })}
                  />
                  <InputField
                    label="CPF"
                    value={partnerData.document}
                    onChange={(v: string) => setPartnerData({ ...partnerData, document: v })}
                  />
                  <InputField
                    label="RG"
                    value={partnerData.rg}
                    onChange={(v: string) => setPartnerData({ ...partnerData, rg: v })}
                  />
                  <InputField
                    label="Data Nasc."
                    type="date"
                    value={partnerData.dob}
                    onChange={(v: string) => setPartnerData({ ...partnerData, dob: v })}
                  />
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select
                      value={partnerData.maritalStatus}
                      onValueChange={(v) => setPartnerData({ ...partnerData, maritalStatus: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <InputField
                    label="Profissão"
                    value={partnerData.occupation}
                    onChange={(v: string) => setPartnerData({ ...partnerData, occupation: v })}
                  />
                  <InputField
                    label="Participação Societária (%)"
                    type="number"
                    value={partnerData.participation}
                    onChange={(v: string) => setPartnerData({ ...partnerData, participation: v })}
                  />
                  <InputField
                    label="Telefone"
                    value={partnerData.phone}
                    onChange={(v: string) => setPartnerData({ ...partnerData, phone: v })}
                  />
                </div>
                {renderAddress(partnerData, setPartnerData, 'Endereço Residencial do Sócio')}
              </div>
            )}
            {entityType === 'pf' && kycData.maritalStatus === 'casado' && (
              <div className="space-y-4">
                <h4 className="font-semibold text-primary">Dados do Cônjuge *</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <InputField
                    className="md:col-span-2"
                    label="Nome Completo"
                    value={spouseData.name}
                    onChange={(v: string) => setSpouseData({ ...spouseData, name: v })}
                  />
                  <InputField
                    label="CPF"
                    value={spouseData.document}
                    onChange={(v: string) => setSpouseData({ ...spouseData, document: v })}
                  />
                  <InputField
                    label="Data Nasc."
                    type="date"
                    value={spouseData.dob}
                    onChange={(v: string) => setSpouseData({ ...spouseData, dob: v })}
                  />
                  <InputField
                    label="Telefone"
                    value={spouseData.phone}
                    onChange={(v: string) => setSpouseData({ ...spouseData, phone: v })}
                  />
                </div>
                {renderAddress(spouseData, setSpouseData)}
              </div>
            )}
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-4">Garantias Adicionais</h4>
              <div className="space-y-2 w-1/2">
                <Label>Tipo de Garantia Secundária</Label>
                <Select
                  value={guarData.guaranteeType}
                  onValueChange={(v) => setGuarData({ ...guarData, guaranteeType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="veiculo">Veículo</SelectItem>
                    <SelectItem value="imovel">Imóvel</SelectItem>
                    <SelectItem value="avalista">Avalista Adicional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAval && (
                <div className="grid md:grid-cols-3 gap-4 mt-4 bg-muted/20 p-4 border rounded-md">
                  <InputField
                    className="md:col-span-2"
                    label="Nome do Avalista"
                    value={guarantorData.name}
                    onChange={(v: string) => setGuarantorData({ ...guarantorData, name: v })}
                  />
                  <InputField
                    label="CPF"
                    value={guarantorData.document}
                    onChange={(v: string) => setGuarantorData({ ...guarantorData, document: v })}
                  />
                  <InputField
                    label="Renda (R$)"
                    type="number"
                    value={guarantorData.income}
                    onChange={(v: string) => setGuarantorData({ ...guarantorData, income: v })}
                  />
                  <InputField
                    label="Relação"
                    value={guarantorData.relationship}
                    onChange={(v: string) =>
                      setGuarantorData({ ...guarantorData, relationship: v })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="font-semibold text-lg border-b pb-2">3. Simulação e Dados Bancários</h3>
            <div className="grid md:grid-cols-2 gap-6 bg-background border p-4 rounded-xl shadow-sm">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Tipo de Crédito BDIGITAL *</Label>
                  <Select
                    value={opData.creditType}
                    onValueChange={(v) => setOpData({ ...opData, creditType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Credito Certo Bdigital - Garantia Real - VEICULOS">
                        Garantia Real - VEICULOS
                      </SelectItem>
                      <SelectItem value="CREDITO CERTO BDIGITAL - CAPITAL DE GIRO - MENSAL - AVAL CCB ATUALIZADA">
                        Capital de Giro - AVAL
                      </SelectItem>
                      <SelectItem value="Credito Pessoal - Garantia - Veiculo">
                        Pessoal - Veiculo
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label>Valor</Label>
                    <span className="font-bold text-[#00C2E0]">
                      R$ {Number(opData.requestedValue || 5000).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <Slider
                    min={5000}
                    max={500000}
                    step={1000}
                    value={[Number(opData.requestedValue) || 5000]}
                    onValueChange={(v) => setOpData({ ...opData, requestedValue: v[0].toString() })}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label>Prazo</Label>
                    <span className="font-bold text-[#00C2E0]">{opData.termMonths}x</span>
                  </div>
                  <Slider
                    min={3}
                    max={ccbConfig?.max_term_months || 36}
                    step={1}
                    value={[Number(opData.termMonths) || 12]}
                    onValueChange={(v) => setOpData({ ...opData, termMonths: v[0].toString() })}
                  />
                </div>
              </div>
              <div className="bg-muted/30 p-6 rounded-xl border border-[#00C2E0]/20 flex flex-col justify-center space-y-3">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumo da Simulação
                </h4>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm">Valor Parcela</span>
                  <span className="font-bold text-primary">
                    R${' '}
                    {simData.installment_value.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm">Total a Pagar</span>
                  <span className="font-semibold">
                    R$ {simData.total_to_pay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-sm">CET (a.a.)</span>
                  <span className="font-semibold text-[#00C2E0]">{simData.cet.toFixed(2)}%</span>
                </div>
                <Alert className="bg-muted/50 mt-4 border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-xs">
                    IOF calculado conforme Lei 9.532/97 + Dec. 6.306/07. Simulação dia a dia.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold text-sm">Dados Bancários para Recebimento</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <InputField
                  label="Banco"
                  value={bankData.bank}
                  onChange={(v: string) => setBankData({ ...bankData, bank: v })}
                />
                <InputField
                  label="Agência"
                  value={bankData.branch}
                  onChange={(v: string) => setBankData({ ...bankData, branch: v })}
                />
                <InputField
                  label="Conta"
                  value={bankData.account}
                  onChange={(v: string) => setBankData({ ...bankData, account: v })}
                />
                <InputField
                  label="Titular"
                  value={bankData.owner_name}
                  onChange={(v: string) => setBankData({ ...bankData, owner_name: v })}
                />
                <InputField
                  label="CPF/CNPJ Titular"
                  value={bankData.owner_document}
                  onChange={(v: string) => setBankData({ ...bankData, owner_document: v })}
                />
                <InputField
                  label="Chave PIX"
                  value={bankData.pix_key}
                  onChange={(v: string) => setBankData({ ...bankData, pix_key: v })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <h3 className="font-semibold text-lg border-b pb-2">
              4. Módulo de Documentação (Uploads)
            </h3>
            {entityType === 'pj' ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Documentos da Empresa *</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <FileField
                    label="Contrato Social/Estatuto"
                    onChange={(f) => handleFile('socialContract', f)}
                  />
                  <FileField label="Cartão CNPJ" onChange={(f) => handleFile('cnpjCard', f)} />
                  <FileField
                    label="Comprovante de Faturamento"
                    onChange={(f) => handleFile('revenueProof', f)}
                  />
                </div>
                <h4 className="font-semibold text-sm pt-4 border-t">
                  Documentos do Sócio Administrador *
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <FileField
                    label="RG/CNH (Frente)"
                    onChange={(f) => handleFile('partnerIdFront', f)}
                  />
                  <FileField
                    label="RG/CNH (Verso)"
                    onChange={(f) => handleFile('partnerIdBack', f)}
                  />
                  <FileField
                    label="Selfie com Documento"
                    onChange={(f) => handleFile('partnerSelfie', f)}
                  />
                  <FileField
                    label="Comprovante de Residência"
                    onChange={(f) => handleFile('partnerAddress', f)}
                  />
                  <FileField
                    label="Declaração IR (Opcional)"
                    onChange={(f) => handleFile('partnerIr', f)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Documentos Pessoais *</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <FileField
                    label="Identidade (Frente)"
                    onChange={(f) => handleFile('idFront', f)}
                  />
                  <FileField label="Identidade (Verso)" onChange={(f) => handleFile('idBack', f)} />
                  <FileField
                    label="Selfie com Documento"
                    onChange={(f) => handleFile('selfie', f)}
                  />
                  <FileField
                    label="Comprovante de Residência"
                    onChange={(f) => handleFile('proofAddress', f)}
                  />
                </div>
                {kycData.maritalStatus === 'casado' && (
                  <>
                    <h4 className="font-semibold text-sm pt-4 border-t">Documentos do Cônjuge *</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      <FileField
                        label="Identidade (Frente)"
                        onChange={(f) => handleFile('spouseIdFront', f)}
                      />
                      <FileField
                        label="Selfie Cônjuge"
                        onChange={(f) => handleFile('spouseSelfie', f)}
                      />
                      <FileField
                        label="Certidão Casamento"
                        onChange={(f) => handleFile('marriageCert', f)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {(isVehicle || isAval) && (
              <h4 className="font-semibold text-sm pt-4 border-t">Garantias *</h4>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              {isVehicle && (
                <FileField label="CRLV do Veículo" onChange={(f) => handleFile('vehicleDoc', f)} />
              )}
              {isAval && (
                <>
                  <FileField
                    label="Identidade Avalista"
                    onChange={(f) => handleFile('guarantorIdFront', f)}
                  />
                  <FileField
                    label="Comprovante Renda"
                    onChange={(f) => handleFile('guarantorIncome', f)}
                  />
                </>
              )}
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label>3 Últimos Extratos Bancários (Múltiplos arquivos) *</Label>
              <FileUpload
                files={docsFiles.bankExtracts}
                setFiles={(f) =>
                  setDocsFiles({
                    ...docsFiles,
                    bankExtracts: typeof f === 'function' ? f(docsFiles.bankExtracts) : f,
                  })
                }
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-muted/10 border-t p-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(s - 1, 1))}
          disabled={step === 1 || loading}
        >
          Voltar
        </Button>
        {step < 4 ? (
          <Button onClick={handleNext} className="gap-2">
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#00C2E0] hover:bg-[#00a9c4] text-white gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Encaminhar CCB
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
