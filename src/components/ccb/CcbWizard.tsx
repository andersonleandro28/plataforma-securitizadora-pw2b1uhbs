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
import { Loader2, CheckCircle2, ChevronRight, Plus, Trash2, Calculator } from 'lucide-react'
import { FileUpload } from '@/components/operations/FileUpload'

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

  const [docsFiles, setDocsFiles] = useState<{
    idDoc?: File
    proofAddress?: File
    bankExtract?: File
    irDoc?: File
    borderos: File[]
    vehicleDoc?: File
    guarantorDocs: File[]
  }>({ borderos: [], guarantorDocs: [] })

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

  const [spouseData, setSpouseData] = useState({
    name: '',
    document: '',
    dob: '',
    phone: '',
  })

  const [guarantorData, setGuarantorData] = useState({
    name: '',
    document: '',
    income: '',
    address: '',
    phone: '',
    relationship: '',
  })

  const isVehicle =
    opData.creditType?.toUpperCase().includes('VEICULO') || guarData.guaranteeType === 'veiculo'
  const isAval =
    opData.creditType?.toUpperCase().includes('AVAL') || guarData.guaranteeType === 'avalista'

  const [simData, setSimData] = useState({
    installment_value: 0,
    total_iof: 0,
    total_irrf: 0,
    total_to_pay: 0,
    cet: 0,
  })

  useEffect(() => {
    if (ccbConfig && opData.requestedValue && opData.termMonths) {
      const pv = Number(opData.requestedValue)
      const n = Number(opData.termMonths)
      const rate = ccbConfig.interest_rate_monthly / 100

      let pmt = pv / n
      if (rate > 0) {
        pmt = (pv * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
      }

      const iof = pv * (ccbConfig.iof_rate / 100)
      const irrf = pv * (ccbConfig.irrf_rate / 100)
      const multiplier = ccbConfig.multiplier_factor || 1

      const finalPmt = (pmt + iof / n + irrf / n) * multiplier
      const totalToPay = finalPmt * n
      const cet = (totalToPay / pv - 1) * 100

      setSimData({
        installment_value: finalPmt,
        total_iof: iof,
        total_irrf: irrf,
        total_to_pay: totalToPay,
        cet,
      })
      setOpData((prev: any) => ({
        ...prev,
        simulation: { installment_value: finalPmt, total_to_pay: totalToPay, cet, rate_used: rate },
      }))
    }
  }, [opData.requestedValue, opData.termMonths, ccbConfig])

  const fetchCep = async () => {
    if (kycData.zip.length === 8 || kycData.zip.length === 9) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${kycData.zip.replace('-', '')}/json/`)
        const data = await res.json()
        if (!data.erro)
          setKycData((prev) => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }))
      } catch (e) {
        console.error('Error fetching CEP:', e)
      }
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (!kycData.name || !kycData.document)
        return toast.error('Preencha os campos obrigatórios (Nome e Documento).')
      if (kycData.maritalStatus === 'casado' && (!spouseData.name || !spouseData.document)) {
        return toast.error('Preencha os dados obrigatórios do cônjuge.')
      }
    }
    if (step === 2 && (!docsFiles.idDoc || !docsFiles.proofAddress || !docsFiles.bankExtract))
      return toast.error('Anexe Identidade, Comprovante de Residência e Extrato Bancário.')
    if (step === 3 && (!opData.requestedValue || !opData.termMonths || !opData.creditType))
      return toast.error('Preencha o valor, prazo e o tipo de crédito.')
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
  const removeSacado = (index: number) =>
    setGuarData((prev) => ({ ...prev, sacados: prev.sacados.filter((_, i) => i !== index) }))

  const handleSubmit = async () => {
    if (!user) return
    if (isVehicle && !docsFiles.vehicleDoc) {
      toast.error('O documento do veículo é obrigatório para esta modalidade.')
      return setStep(4)
    }
    if (
      isAval &&
      (!guarantorData.name || !guarantorData.document || docsFiles.guarantorDocs.length === 0)
    ) {
      toast.error('Preencha os dados e anexe os documentos do avalista.')
      return setStep(4)
    }

    setLoading(true)
    try {
      const docsPaths: any = {}
      const upload = async (file: File, key: string) => {
        const path = `${user.id}/${Date.now()}_${key}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const { error } = await supabase.storage.from('ccb-docs').upload(path, file)
        if (error) throw error
        docsPaths[key] = path
      }

      if (docsFiles.idDoc) await upload(docsFiles.idDoc, 'identity')
      if (docsFiles.proofAddress) await upload(docsFiles.proofAddress, 'address')
      if (docsFiles.bankExtract) await upload(docsFiles.bankExtract, 'bank_extract')
      if (docsFiles.irDoc) await upload(docsFiles.irDoc, 'ir_document')

      if (docsFiles.vehicleDoc) await upload(docsFiles.vehicleDoc, 'vehicle_doc')

      docsPaths.borderos = []
      for (let i = 0; i < docsFiles.borderos.length; i++) {
        const file = docsFiles.borderos[i]
        const path = `${user.id}/${Date.now()}_bordero_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        await supabase.storage.from('ccb-docs').upload(path, file)
        docsPaths.borderos.push(path)
      }

      docsPaths.guarantorDocs = []
      for (let i = 0; i < docsFiles.guarantorDocs.length; i++) {
        const file = docsFiles.guarantorDocs[i]
        const path = `${user.id}/${Date.now()}_guarantor_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        await supabase.storage.from('ccb-docs').upload(path, file)
        docsPaths.guarantorDocs.push(path)
      }

      const { data, error } = await supabase.functions.invoke('submit-ccb', {
        body: {
          borrowerData: kycData,
          operationData: opData,
          guaranteesData: guarData,
          docsPaths,
          spouseData: kycData.maritalStatus === 'casado' ? spouseData : null,
          guarantorData: isAval ? guarantorData : null,
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
                <Label>Data de Nascimento</Label>
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
                <Label>Renda Mensal (R$)</Label>
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
                  onBlur={fetchCep}
                  onChange={(e) => setKycData({ ...kycData, zip: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rua/Avenida</Label>
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
                  value={`${kycData.city} ${kycData.state ? '- ' + kycData.state : ''}`}
                  disabled
                  className="bg-muted/50"
                />
              </div>
            </div>

            {kycData.maritalStatus === 'casado' && (
              <div className="md:col-span-3 space-y-4 pt-4 border-t border-dashed mt-4">
                <h4 className="font-semibold text-sm">Dados do Cônjuge *</h4>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nome do Cônjuge</Label>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label>Telefone</Label>
                    <Input
                      value={spouseData.phone}
                      onChange={(e) => setSpouseData({ ...spouseData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">2. Envio de Documentos</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Identidade (RG/CNH) *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocsFiles({ ...docsFiles, idDoc: e.target.files?.[0] })}
                />
              </div>
              <div className="space-y-2">
                <Label>Comprovante de Residência *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setDocsFiles({ ...docsFiles, proofAddress: e.target.files?.[0] })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Extrato Bancário (últimos 30 dias) *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocsFiles({ ...docsFiles, bankExtract: e.target.files?.[0] })}
                />
              </div>
              <div className="space-y-2">
                <Label>Declaração IR (Opcional)</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDocsFiles({ ...docsFiles, irDoc: e.target.files?.[0] })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#00C2E0]" /> 3. Simulação e Dados da Operação
            </h3>

            <div className="grid md:grid-cols-2 gap-10 bg-background border p-6 rounded-xl shadow-sm">
              <div className="space-y-8">
                <div className="space-y-2">
                  <Label>Tipo de Crédito BDIGITAL *</Label>
                  <Select
                    value={opData.creditType}
                    onValueChange={(v) => setOpData({ ...opData, creditType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Credito Certo Bdigital - Garantia Real - VEICULOS">
                        Credito Certo Bdigital - Garantia Real - VEICULOS
                      </SelectItem>
                      <SelectItem value="CREDITO CERTO BDIGITAL - CAPITAL DE GIRO - MENSAL - AVAL CCB ATUALIZADA">
                        CREDITO CERTO BDIGITAL - CAPITAL DE GIRO - AVAL
                      </SelectItem>
                      <SelectItem value="Credito Certo bdigital - Pessoa Física - pagamento mensal - aval">
                        Credito Certo Bdigital - PF - Aval
                      </SelectItem>
                      <SelectItem value="Credito Pessoal - Garantia - Veiculo">
                        Credito Pessoal - Garantia - Veiculo
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Valor Solicitado (R$)</Label>
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
                    className="py-4"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Prazo (Meses)</Label>
                    <span className="font-bold text-xl text-[#00C2E0]">{opData.termMonths}x</span>
                  </div>
                  <Slider
                    min={3}
                    max={ccbConfig?.max_term_months || 36}
                    step={1}
                    value={[Number(opData.termMonths) || 12]}
                    onValueChange={(v) => setOpData({ ...opData, termMonths: v[0].toString() })}
                    className="py-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Finalidade</Label>
                  <Select
                    value={opData.purpose}
                    onValueChange={(v) => setOpData({ ...opData, purpose: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="capital_giro">Capital de Giro</SelectItem>
                      <SelectItem value="estoque">Estoque</SelectItem>
                      <SelectItem value="expansao">Expansão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-muted/30 p-6 rounded-xl border border-[#00C2E0]/20 flex flex-col justify-center">
                <h4 className="font-semibold mb-6 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumo da Simulação
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Valor da Parcela Mensal</span>
                    <span className="font-bold text-lg text-primary">
                      R${' '}
                      {simData.installment_value.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Total Geral a Pagar</span>
                    <span className="font-semibold">
                      R${' '}
                      {simData.total_to_pay.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">
                      Impostos Inclusos (IOF+IRRF)
                    </span>
                    <span className="font-semibold text-amber-600">
                      R${' '}
                      {(simData.total_iof + simData.total_irrf).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-sm text-muted-foreground">Custo Efetivo Total (CET)</span>
                    <span className="font-semibold text-[#00C2E0]">
                      {simData.cet.toFixed(2)}% no período
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">4. Garantias e Lastro</h3>
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

                <div className="space-y-2">
                  <Label>Recebível Vinculado (Opcional)</Label>
                  <Select
                    value={guarData.receivableType}
                    onValueChange={(v) => setGuarData({ ...guarData, receivableType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="duplicatas">Duplicatas</SelectItem>
                      <SelectItem value="cheques">Cheques</SelectItem>
                      <SelectItem value="contratos">Contratos</SelectItem>
                      <SelectItem value="boletos">Boletos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isVehicle && (
                <div className="space-y-2 p-4 bg-muted/20 border rounded-md">
                  <Label className="flex items-center gap-2">
                    Documento do Veículo (CRLV/DUT) *
                  </Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setDocsFiles({ ...docsFiles, vehicleDoc: e.target.files?.[0] })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Obrigatório para modalidades com garantia de veículo (Máx 5MB).
                  </p>
                </div>
              )}

              {isAval && (
                <div className="space-y-4 p-4 bg-muted/20 border rounded-md">
                  <h4 className="font-semibold text-sm border-b pb-2">Dados do Avalista *</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
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
                      <Label>Telefone</Label>
                      <Input
                        value={guarantorData.phone}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço Completo</Label>
                      <Input
                        value={guarantorData.address}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Relação (ex: Sócio, Parente)</Label>
                      <Input
                        value={guarantorData.relationship}
                        onChange={(e) =>
                          setGuarantorData({ ...guarantorData, relationship: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <Label>Documentos do Avalista (RG/CPF/Comprovantes) *</Label>
                    <FileUpload
                      files={docsFiles.guarantorDocs}
                      setFiles={(files: any) =>
                        setDocsFiles({
                          ...docsFiles,
                          guarantorDocs:
                            typeof files === 'function' ? files(docsFiles.guarantorDocs) : files,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <Label>Borderôs / Notas Fiscais</Label>
                <FileUpload
                  files={docsFiles.borderos}
                  setFiles={(files: any) =>
                    setDocsFiles({
                      ...docsFiles,
                      borderos: typeof files === 'function' ? files(docsFiles.borderos) : files,
                    })
                  }
                />
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <Label>Sacados Relacionados (Devedores)</Label>
                  <Button variant="outline" size="sm" onClick={addSacado} className="h-8 gap-1">
                    <Plus className="h-3 w-3" /> Adicionar Sacado
                  </Button>
                </div>
                {guarData.sacados.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/30 p-4 text-center rounded-md border border-dashed">
                    Nenhum sacado informado.
                  </div>
                ) : (
                  guarData.sacados.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col md:flex-row gap-2 items-end bg-muted/10 p-3 rounded-md border"
                    >
                      <div className="space-y-1 w-full">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          className="h-8"
                          value={s.name}
                          onChange={(e) => updateSacado(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 w-full">
                        <Label className="text-xs">CNPJ/CPF</Label>
                        <Input
                          className="h-8"
                          value={s.document}
                          onChange={(e) => updateSacado(idx, 'document', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 w-full">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          className="h-8"
                          type="number"
                          value={s.value}
                          onChange={(e) => updateSacado(idx, 'value', e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeSacado(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
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
            className="bg-[#00C2E0] hover:bg-[#00a9c4] text-white font-medium min-w-[150px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}{' '}
            Encaminhar Simulação e Emitir CCB
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
