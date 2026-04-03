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
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, ChevronRight, Plus, Trash2, Calculator, Info } from 'lucide-react'
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

export function CcbWizard({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [ccbConfig, setCcbConfig] = useState<any>(null)

  useEffect(() => {
    supabase
      .from('config_ccb')
      .select('*')
      .single()
      .then(({ data }) => {
        if (data) setCcbConfig(data)
      })
  }, [])

  const [kycData, setKycData] = useState({
    name: profile?.full_name || '',
    document: profile?.document_number || '',
    dob: '',
    maritalStatus: '',
    occupation: profile?.pf_occupation || '',
    income: '',
    zip: profile?.address_zip || '',
    street: profile?.address_street || '',
    number: profile?.address_number || '',
    neighborhood: profile?.address_neighborhood || '',
    city: profile?.address_city || '',
    state: profile?.address_state || '',
    phone: profile?.phone || '',
    email: profile?.email || user?.email || '',
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
    sacados: [] as { name: string; document: string; value: string }[],
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

  const handleFile = (key: string, file?: File) => {
    if (file && file.size > 5 * 1024 * 1024) return toast.error('O arquivo deve ter no máximo 5MB.')
    setDocsFiles((prev: any) => ({ ...prev, [key]: file }))
  }

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

      let saldo = pv
      let totalIofDiario = 0
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

      let low = 0.0
      let high = 1.0
      let r = 0.0
      for (let i = 0; i < 50; i++) {
        r = (low + high) / 2
        const currentPv = (parcelaFinal * (1 - Math.pow(1 + r, -n))) / r
        if (currentPv > pv) low = r
        else high = r
      }
      const cetAnual = (Math.pow(1 + r, 12) - 1) * 100

      setSchedule(newSchedule)
      setSimData({ installment_value: parcelaFinal, total_to_pay: totalToPay, cet: cetAnual })
      setOpData((prev: any) => ({
        ...prev,
        simulation: {
          installment_value: parcelaFinal,
          total_to_pay: totalToPay,
          cet: cetAnual,
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
    if (zip.length === 8 || zip.length === 9) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${zip.replace('-', '')}/json/`)
        const data = await res.json()
        if (!data.erro)
          setFn((prev: any) => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }))
      } catch (e) {
        console.error('Erro ao buscar CEP:', e)
      }
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!kycData.name || !kycData.document)
        return toast.error('Preencha os campos obrigatórios (Nome e Documento).')
      if (kycData.maritalStatus === 'casado' && (!spouseData.name || !spouseData.document))
        return toast.error('Preencha os dados obrigatórios do cônjuge.')
    }
    if (step === 2) {
      if (!docsFiles.idFront || !docsFiles.idBack || !docsFiles.selfie || !docsFiles.proofAddress)
        return toast.error('Anexe Frente/Verso da Identidade, Selfie e Comprovante de Residência.')
      if (
        kycData.maritalStatus === 'casado' &&
        (!docsFiles.spouseIdFront ||
          !docsFiles.spouseSelfie ||
          !docsFiles.spouseAddress ||
          !docsFiles.marriageCert)
      )
        return toast.error('Anexe os documentos obrigatórios do cônjuge e a Certidão de Casamento.')
    }
    if (step === 3) {
      if (!opData.requestedValue || !opData.termMonths || !opData.creditType)
        return toast.error('Preencha o valor, prazo e o tipo de crédito.')
      if (!bankData.bank || !bankData.account) return toast.error('Preencha os dados bancários.')
      if (docsFiles.bankExtracts.length === 0) return toast.error('Anexe os extratos bancários.')
    }
    setStep((s) => Math.min(s + 1, 4))
  }
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1))

  const addSacado = () =>
    setGuarData((prev) => ({
      ...prev,
      sacados: [...prev.sacados, { name: '', document: '', value: '' }],
    }))
  const updateSacado = (index: number, field: string, value: string) => {
    const updated = [...guarData.sacados]
    updated[index] = { ...updated[index], [field]: value }
    setGuarData((prev) => ({ ...prev, sacados: updated }))
  }

  const handleSubmit = async () => {
    if (!user) return
    if (isVehicle && !docsFiles.vehicleDoc)
      return toast.error('Documento do veículo é obrigatório.')
    if (
      isAval &&
      (!guarantorData.name ||
        !docsFiles.guarantorIdFront ||
        !docsFiles.guarantorIncome ||
        !docsFiles.guarantorAddress)
    )
      return toast.error('Preencha os dados e anexe TODOS os documentos obrigatórios do avalista.')

    setLoading(true)
    try {
      const docsPaths: any = {}
      const upload = async (file: File, key: string, bucket: string = 'ccb-docs') => {
        const path = `${user.id}/${Date.now()}_${key}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const { error } = await supabase.storage.from(bucket).upload(path, file)
        if (error) throw error
        docsPaths[key] = path
      }

      const fileMap: any = {
        id_front: docsFiles.idFront,
        id_back: docsFiles.idBack,
        selfie: docsFiles.selfie,
        proof_address: docsFiles.proofAddress,
        vehicle_doc: docsFiles.vehicleDoc,
      }
      for (const [k, f] of Object.entries(fileMap)) if (f) await upload(f as File, k)

      const spouseMap: any = {
        marriage_cert: docsFiles.marriageCert,
        spouse_id_front: docsFiles.spouseIdFront,
        spouse_id_back: docsFiles.spouseIdBack,
        spouse_selfie: docsFiles.spouseSelfie,
        spouse_address: docsFiles.spouseAddress,
      }
      for (const [k, f] of Object.entries(spouseMap))
        if (f) await upload(f as File, k, 'ccb_conjuges_docs')

      const guarMap: any = {
        guarantor_id_front: docsFiles.guarantorIdFront,
        guarantor_id_back: docsFiles.guarantorIdBack,
        guarantor_selfie: docsFiles.guarantorSelfie,
        guarantor_address: docsFiles.guarantorAddress,
        guarantor_income: docsFiles.guarantorIncome,
      }
      for (const [k, f] of Object.entries(guarMap))
        if (f) await upload(f as File, k, 'ccb_avalistas_docs')

      const uploadArray = async (files: File[], key: string) => {
        docsPaths[key] = []
        for (let i = 0; i < files.length; i++) {
          const path = `${user.id}/${Date.now()}_${key}_${i}_${files[i].name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          await supabase.storage.from('ccb-docs').upload(path, files[i])
          docsPaths[key].push(path)
        }
      }

      await uploadArray(docsFiles.bankExtracts, 'bankExtracts')
      await uploadArray(docsFiles.additionalDocs, 'additionalDocs')

      const { data, error } = await supabase.functions.invoke('submit-ccb', {
        body: {
          borrowerData: kycData,
          spouseData: kycData.maritalStatus === 'casado' ? spouseData : null,
          operationData: opData,
          guaranteesData: guarData,
          guarantorData: isAval ? guarantorData : null,
          bankData,
          docsPaths,
        },
      })
      if (error || data?.error) throw new Error(data?.error || error?.message)

      toast.success('Solicitação CCB enviada com sucesso!')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-t-4 border-t-[#00C2E0] shadow-md relative overflow-hidden">
      <div className="bg-[#00C2E0]/10 p-4 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Formulário de Emissão BDIGITAL</h2>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para gerar sua simulação e CCB pré-aprovada.
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
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">1. Dados do Solicitante (KYC)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={kycData.name}
                  onChange={(e) => setKycData({ ...kycData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CPF / CNPJ *</Label>
                <Input
                  value={kycData.document}
                  onChange={(e) => setKycData({ ...kycData, document: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Nasc.</Label>
                <Input
                  type="date"
                  value={kycData.dob}
                  onChange={(e) => setKycData({ ...kycData, dob: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado Civil</Label>
                <Select
                  value={kycData.maritalStatus}
                  onValueChange={(v) => setKycData({ ...kycData, maritalStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ocupação</Label>
                <Input
                  value={kycData.occupation}
                  onChange={(e) => setKycData({ ...kycData, occupation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Renda Mensal</Label>
                <Input
                  type="number"
                  value={kycData.income}
                  onChange={(e) => setKycData({ ...kycData, income: e.target.value })}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={kycData.zip}
                  onBlur={() => fetchCep(kycData.zip, setKycData)}
                  onChange={(e) => setKycData({ ...kycData, zip: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rua</Label>
                <Input
                  value={kycData.street}
                  onChange={(e) => setKycData({ ...kycData, street: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={kycData.number}
                  onChange={(e) => setKycData({ ...kycData, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={kycData.neighborhood}
                  onChange={(e) => setKycData({ ...kycData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade/UF</Label>
                <Input
                  value={`${kycData.city} - ${kycData.state}`}
                  disabled
                  className="bg-muted/50"
                />
              </div>
            </div>

            {kycData.maritalStatus === 'casado' && (
              <div className="md:col-span-3 space-y-4 pt-4 border-t border-dashed mt-4">
                <h4 className="font-semibold text-sm">Dados do Cônjuge *</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={spouseData.name}
                      onChange={(e) => setSpouseData({ ...spouseData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input
                      value={spouseData.document}
                      onChange={(e) => setSpouseData({ ...spouseData, document: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Nasc.</Label>
                    <Input
                      type="date"
                      value={spouseData.dob}
                      onChange={(e) => setSpouseData({ ...spouseData, dob: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      value={spouseData.email}
                      onChange={(e) => setSpouseData({ ...spouseData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={spouseData.phone}
                      onChange={(e) => setSpouseData({ ...spouseData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={spouseData.zip}
                      onBlur={() => fetchCep(spouseData.zip, setSpouseData)}
                      onChange={(e) => setSpouseData({ ...spouseData, zip: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Rua</Label>
                    <Input
                      value={spouseData.street}
                      onChange={(e) => setSpouseData({ ...spouseData, street: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={spouseData.number}
                      onChange={(e) => setSpouseData({ ...spouseData, number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={spouseData.neighborhood}
                      onChange={(e) =>
                        setSpouseData({ ...spouseData, neighborhood: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade/UF</Label>
                    <Input
                      value={`${spouseData.city} - ${spouseData.state}`}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">2. Upload de Documentos</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Identidade (Frente) *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFile('idFront', e.target.files?.[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>Identidade (Verso) *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFile('idBack', e.target.files?.[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>Selfie com Documento *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFile('selfie', e.target.files?.[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>Comprovante de Residência *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFile('proofAddress', e.target.files?.[0])}
                />
              </div>
            </div>

            {kycData.maritalStatus === 'casado' && (
              <div className="mt-6 pt-4 border-t border-dashed">
                <h4 className="font-semibold text-sm mb-4">Documentos do Cônjuge *</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Certidão de Casamento *</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFile('marriageCert', e.target.files?.[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RG/CPF Cônjuge (Frente) *</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFile('spouseIdFront', e.target.files?.[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RG/CPF Cônjuge (Verso)</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFile('spouseIdBack', e.target.files?.[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Selfie Cônjuge *</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFile('spouseSelfie', e.target.files?.[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprovante Residência Cônjuge *</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFile('spouseAddress', e.target.files?.[0])}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#00C2E0]" /> 3. Simulação e Pagamento
            </h3>
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
                      <SelectItem value="Credito Certo bdigital - Pessoa Física - pagamento mensal - aval">
                        PF - Aval
                      </SelectItem>
                      <SelectItem value="Credito Pessoal - Garantia - Veiculo">
                        Pessoal - Veiculo
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Valor Solicitado</Label>
                    <span className="font-bold text-xl text-[#00C2E0]">
                      R$ {Number(opData.requestedValue || 5000).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <Slider
                    min={5000}
                    max={500000}
                    step={1000}
                    value={[Number(opData.requestedValue) || 5000]}
                    onValueChange={(v) => setOpData({ ...opData, requestedValue: v[0].toString() })}
                    className="py-2"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Prazo</Label>
                    <span className="font-bold text-xl text-[#00C2E0]">{opData.termMonths}x</span>
                  </div>
                  <Slider
                    min={3}
                    max={ccbConfig?.max_term_months || 36}
                    step={1}
                    value={[Number(opData.termMonths) || 12]}
                    onValueChange={(v) => setOpData({ ...opData, termMonths: v[0].toString() })}
                    className="py-2"
                  />
                </div>
              </div>
              <div className="bg-muted/30 p-6 rounded-xl border border-[#00C2E0]/20 flex flex-col justify-center">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumo da Simulação
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Valor Parcela</span>
                    <span className="font-bold text-primary">
                      R${' '}
                      {simData.installment_value.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Total a Pagar</span>
                    <span className="font-semibold">
                      R${' '}
                      {simData.total_to_pay.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Total IOF</span>
                    <span className="font-semibold">
                      R${' '}
                      {Number(opData.simulation?.total_iof || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-sm">CET (a.a.)</span>
                    <span className="font-semibold text-[#00C2E0]">{simData.cet.toFixed(2)}%</span>
                  </div>
                </div>

                <Alert className="bg-muted/50 mt-4 border-primary/20">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    IOF calculado conforme Lei 9.532/97 + Dec. 6.306/07. Simulação dia a dia sobre o
                    saldo devedor.
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold text-sm">Calendário de Vencimentos e Amortização</h4>
              <ScrollArea className="h-[250px] border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Amortização</TableHead>
                      <TableHead>Juros</TableHead>
                      <TableHead>IOF Diário</TableHead>
                      <TableHead>Parcela (Base)</TableHead>
                      <TableHead>Saldo Devedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((row: any) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell>
                          R${' '}
                          {row.amortizacao.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          R${' '}
                          {row.juros.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          R${' '}
                          {row.iof_diario.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          R${' '}
                          {row.pmt_base.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          R${' '}
                          {row.saldo_devedor.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold text-sm">Dados Bancários para Recebimento</h4>
              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  placeholder="Banco"
                  value={bankData.bank}
                  onChange={(e) => setBankData({ ...bankData, bank: e.target.value })}
                />
                <Input
                  placeholder="Agência"
                  value={bankData.branch}
                  onChange={(e) => setBankData({ ...bankData, branch: e.target.value })}
                />
                <Input
                  placeholder="Conta"
                  value={bankData.account}
                  onChange={(e) => setBankData({ ...bankData, account: e.target.value })}
                />
                <Input
                  placeholder="Titular"
                  value={bankData.owner_name}
                  onChange={(e) => setBankData({ ...bankData, owner_name: e.target.value })}
                />
                <Input
                  placeholder="CPF/CNPJ Titular"
                  value={bankData.owner_document}
                  onChange={(e) => setBankData({ ...bankData, owner_document: e.target.value })}
                />
                <Input
                  placeholder="Chave PIX (Opcional)"
                  value={bankData.pix_key}
                  onChange={(e) => setBankData({ ...bankData, pix_key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
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
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">4. Garantias e Complementos</h3>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Garantia Principal *</Label>
                  <Select
                    value={guarData.guaranteeType}
                    onValueChange={(v) => setGuarData({ ...guarData, guaranteeType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veiculo">Veículo</SelectItem>
                      <SelectItem value="imovel">Imóvel</SelectItem>
                      <SelectItem value="avalista">Avalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isVehicle && (
                <div className="space-y-2 p-4 bg-muted/20 border rounded-md">
                  <Label>Documento do Veículo (CRLV/DUT) *</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFile('vehicleDoc', e.target.files?.[0])}
                  />
                </div>
              )}

              {isAval && (
                <div className="space-y-4 p-4 bg-muted/20 border rounded-md">
                  <h4 className="font-semibold text-sm border-b pb-2">Dados do Avalista *</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Nome</Label>
                      <Input
                        value={guarantorData.name}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        value={guarantorData.document}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, document: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Nasc.</Label>
                      <Input
                        type="date"
                        value={guarantorData.dob}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, dob: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Renda (R$)</Label>
                      <Input
                        type="number"
                        value={guarantorData.income}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, income: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Relação</Label>
                      <Input
                        value={guarantorData.relationship}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, relationship: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={guarantorData.zip}
                        onBlur={() => fetchCep(guarantorData.zip, setGuarantorData)}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, zip: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Rua</Label>
                      <Input
                        value={guarantorData.street}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, street: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input
                        value={guarantorData.number}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, number: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input
                        value={guarantorData.neighborhood}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, neighborhood: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade/UF</Label>
                      <Input
                        value={`${guarantorData.city} - ${guarantorData.state}`}
                        disabled
                        className="bg-muted/50"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label className="text-xs">RG/CPF (Frente) *</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFile('guarantorIdFront', e.target.files?.[0])}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">RG/CPF (Verso)</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFile('guarantorIdBack', e.target.files?.[0])}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Selfie *</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFile('guarantorSelfie', e.target.files?.[0])}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Comprovante de Residência *</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFile('guarantorAddress', e.target.files?.[0])}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs">Comprovante de Renda *</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFile('guarantorIncome', e.target.files?.[0])}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <Label>Documentos Adicionais (Múltiplos)</Label>
                <FileUpload
                  files={docsFiles.additionalDocs}
                  setFiles={(f) =>
                    setDocsFiles({
                      ...docsFiles,
                      additionalDocs: typeof f === 'function' ? f(docsFiles.additionalDocs) : f,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-muted/10 border-t p-4 flex justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={step === 1 || loading}>
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
