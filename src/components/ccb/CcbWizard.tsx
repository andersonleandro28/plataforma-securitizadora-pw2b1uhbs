import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2, CheckCircle2, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { FileUpload } from '@/components/operations/FileUpload'

export function CcbWizard({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 State
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

  // Step 2 State (Files)
  const [docsFiles, setDocsFiles] = useState<{
    idDoc?: File
    proofAddress?: File
    bankExtract?: File
    irDoc?: File
    borderos: File[]
  }>({ borderos: [] })

  // Step 3 State
  const [opData, setOpData] = useState({
    requestedValue: '',
    termMonths: '12',
    purpose: '',
    proposedRate: '',
  })

  // Step 4 State
  const [guarData, setGuarData] = useState({
    receivableType: 'duplicatas',
    sacados: [] as { name: string; document: string; value: string }[],
  })

  const fetchCep = async () => {
    if (kycData.zip.length === 8 || kycData.zip.length === 9) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${kycData.zip.replace('-', '')}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setKycData((prev) => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }))
        }
      } catch (e) {}
    }
  }

  const handleNext = () => setStep((s) => Math.min(s + 1, 4))
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
  const removeSacado = (index: number) => {
    setGuarData((prev) => ({ ...prev, sacados: prev.sacados.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async () => {
    if (!user) return
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

      docsPaths.borderos = []
      for (let i = 0; i < docsFiles.borderos.length; i++) {
        const file = docsFiles.borderos[i]
        const path = `${user.id}/${Date.now()}_bordero_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        await supabase.storage.from('ccb-docs').upload(path, file)
        docsPaths.borderos.push(path)
      }

      const { data, error } = await supabase.functions.invoke('submit-ccb', {
        body: { borrowerData: kycData, operationData: opData, guaranteesData: guarData, docsPaths },
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
            Preencha os dados abaixo para gerar sua CCB pré-aprovada.
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
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">3. Dados da Operação</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Valor Solicitado (R$)</Label>
                <Input
                  type="number"
                  min="5000"
                  placeholder="Min. R$ 5.000"
                  value={opData.requestedValue}
                  onChange={(e) => setOpData({ ...opData, requestedValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo (Meses)</Label>
                <Input
                  type="number"
                  min="3"
                  max="36"
                  placeholder="3 a 36"
                  value={opData.termMonths}
                  onChange={(e) => setOpData({ ...opData, termMonths: e.target.value })}
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
              <div className="space-y-2">
                <Label>Taxa Proposta (% a.m.) - Opcional</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={opData.proposedRate}
                  onChange={(e) => setOpData({ ...opData, proposedRate: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
            <h3 className="font-semibold text-lg border-b pb-2">4. Garantias e Lastro</h3>
            <div className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label>Tipo de Recebível</Label>
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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
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
            )}
            Gerar e Enviar CCB
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
