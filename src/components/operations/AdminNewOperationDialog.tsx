import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/operations/FileUpload'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useBorrowerLimit } from '@/hooks/use-borrower-limit'
import { toast } from 'sonner'
import { Loader2, Calculator, Send, User, Building, AlertCircle } from 'lucide-react'

interface AdminNewOperationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface BorrowerOption {
  id: string
  full_name: string | null
  email: string | null
  document_number: string | null
  pj_company_name: string | null
  pj_trade_name: string | null
  credit_limit: number | null
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function AdminNewOperationDialog({
  open,
  onOpenChange,
  onSuccess,
}: AdminNewOperationDialogProps) {
  const { user } = useAuth()
  const [borrowers, setBorrowers] = useState<BorrowerOption[]>([])
  const [loadingBorrowers, setLoadingBorrowers] = useState(false)
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>('')

  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simulation, setSimulation] = useState<any>(null)

  const {
    available,
    limit,
    loading: limitLoading,
  } = useBorrowerLimit(selectedBorrowerId || undefined)

  const [formData, setFormData] = useState({
    receivableType: '',
    receivableTypeOther: '',
    cedente: '',
    sacado: '',
    sacadoDocument: '',
    sacadoEmail: '',
    sacadoPhone: '',
    documentNumber: '',
    faceValue: '',
    requestedValue: '',
    issueDate: '',
    dueDate: '',
    installments: '1',
    initialStatus: 'enviado',
    observations: '',
  })

  // Load borrowers list when modal opens
  useEffect(() => {
    if (!open) return
    const fetchBorrowers = async () => {
      setLoadingBorrowers(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, document_number, pj_company_name, pj_trade_name, credit_limit',
        )
        .or('is_borrower.eq.true,role.eq.borrower')
        .order('full_name', { ascending: true })

      if (!error && data) {
        setBorrowers(data)
      }
      setLoadingBorrowers(false)
    }
    fetchBorrowers()
  }, [open])

  // When borrower changes, update Cedente field default if empty or matches previous borrower
  const handleSelectBorrower = (borrowerId: string) => {
    setSelectedBorrowerId(borrowerId)
    const b = borrowers.find((item) => item.id === borrowerId)
    if (b) {
      const cedenteName = b.pj_company_name || b.pj_trade_name || b.full_name || ''
      setFormData((prev) => ({
        ...prev,
        cedente: cedenteName,
      }))
    }
  }

  // Auto calculate simulation when important fields change
  useEffect(() => {
    const handler = setTimeout(() => {
      if (
        formData.receivableType &&
        formData.faceValue &&
        formData.requestedValue &&
        formData.dueDate
      ) {
        handleSimulate()
      }
    }, 800)
    return () => clearTimeout(handler)
  }, [formData.receivableType, formData.faceValue, formData.requestedValue, formData.dueDate])

  const handleSimulate = async () => {
    if (Number(formData.requestedValue) > Number(formData.faceValue)) return
    setSimulating(true)
    try {
      const { data } = await supabase.functions.invoke('calculate-operation', {
        body: {
          simulate_data: {
            receivable_type: formData.receivableType,
            face_value: formData.faceValue,
            requested_value: formData.requestedValue,
            due_date: formData.dueDate,
          },
        },
      })
      if (data?.data) setSimulation(data.data)
    } catch (err) {
      console.error('Simulation error', err)
    } finally {
      setSimulating(false)
    }
  }

  const resetForm = () => {
    setSelectedBorrowerId('')
    setFormData({
      receivableType: '',
      receivableTypeOther: '',
      cedente: '',
      sacado: '',
      sacadoDocument: '',
      sacadoEmail: '',
      sacadoPhone: '',
      documentNumber: '',
      faceValue: '',
      requestedValue: '',
      issueDate: '',
      dueDate: '',
      installments: '1',
      initialStatus: 'enviado',
      observations: '',
    })
    setFiles([])
    setSimulation(null)
  }

  const handleSubmit = async () => {
    if (!selectedBorrowerId) return toast.error('Selecione o tomador / cedente da operação')
    if (!formData.receivableType) return toast.error('Tipo de Recebível é obrigatório')
    if (formData.receivableType === 'outro' && !formData.receivableTypeOther)
      return toast.error('Descreva o tipo de recebível')
    if (!formData.cedente) return toast.error('Informe o nome do cedente / originador')
    if (!formData.documentNumber) return toast.error('Informe o número do documento')
    if (!formData.issueDate) return toast.error('Informe a data de emissão')
    if (!formData.dueDate) return toast.error('Informe a data de vencimento')
    if (
      !formData.sacado ||
      !formData.sacadoDocument ||
      !formData.sacadoEmail ||
      !formData.sacadoPhone
    )
      return toast.error('Preencha todos os dados do sacado (nome, documento, e-mail e telefone)')
    if (!formData.faceValue || Number(formData.faceValue) <= 0)
      return toast.error('Valor de face inválido')
    if (!formData.requestedValue || Number(formData.requestedValue) <= 0)
      return toast.error('Valor solicitado inválido')
    if (Number(formData.requestedValue) > Number(formData.faceValue))
      return toast.error('Valor solicitado não pode ser maior que o valor de face')

    // Aviso se passar do limite, mas permite admin avançar se limite for 0 ou se desejar
    if (limit > 0 && Number(formData.requestedValue) > available) {
      const confirmProceed = window.confirm(
        `Atenção: O valor solicitado (${formatCurrency(
          Number(formData.requestedValue),
        )}) excede o limite disponível do tomador (${formatCurrency(
          available,
        )}). Deseja prosseguir com o lançamento administrativo mesmo assim?`,
      )
      if (!confirmProceed) return
    }

    setSubmitting(true)
    try {
      // 1. Criar operação de crédito
      const { data: op, error: opErr } = await supabase
        .from('credit_operations')
        .insert({
          borrower_id: selectedBorrowerId,
          receivable_type: formData.receivableType,
          receivable_type_other: formData.receivableTypeOther || null,
          cedente: formData.cedente,
          sacado: formData.sacado,
          sacado_document: formData.sacadoDocument,
          sacado_email: formData.sacadoEmail,
          sacado_phone: formData.sacadoPhone,
          document_number: formData.documentNumber,
          face_value: Number(formData.faceValue),
          requested_value: Number(formData.requestedValue),
          issue_date: formData.issueDate,
          due_date: formData.dueDate,
          installments: Number(formData.installments) || 1,
          observations: formData.observations
            ? `[Lançado pelo Admin]: ${formData.observations}`
            : '[Lançado pelo Admin na mesa de operações]',
          status: formData.initialStatus || 'enviado',
        })
        .select()
        .single()

      if (opErr) throw opErr

      // 2. Upload de arquivos anexados (se houver)
      if (files.length > 0) {
        for (const file of files) {
          const path = `${op.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const { error: uploadError } = await supabase.storage
            .from('operation-docs')
            .upload(path, file)

          if (!uploadError) {
            await supabase.from('operation_documents').insert({
              operation_id: op.id,
              file_path: path,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              uploaded_by: user?.id,
            })
          }
        }
      }

      // 3. Disparar cálculo server-side da operação
      try {
        await supabase.functions.invoke('calculate-operation', { body: { operation_id: op.id } })
      } catch (calcErr) {
        console.warn('Erro ao invocar calculate-operation:', calcErr)
      }

      // 4. Registro no log de auditoria
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'ADMIN_CREATE_OPERATION',
        entity_type: 'credit_operations',
        entity_id: op.id,
        details: {
          launched_by_admin: true,
          borrower_id: selectedBorrowerId,
          face_value: Number(formData.faceValue),
          requested_value: Number(formData.requestedValue),
          initial_status: formData.initialStatus,
        },
      })

      toast.success('Operação de antecipação lançada com sucesso!')
      resetForm()
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao lançar operação')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Lançar Operação de Antecipação</DialogTitle>
          <DialogDescription>
            Lançamento direto de antecipação de recebíveis pelo administrador na mesa de operações.
          </DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-3 gap-6 py-2">
          {/* Formulário Principal */}
          <div className="lg:col-span-2 space-y-4">
            {/* Seleção do Tomador */}
            <div className="space-y-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <User className="w-4 h-4 text-primary" /> Tomador de Crédito (Cliente) *
                </Label>
                {selectedBorrowerId && !limitLoading && (
                  <span className="text-xs text-muted-foreground">
                    Limite Disp:{' '}
                    <strong className="text-foreground">{formatCurrency(available)}</strong>
                  </span>
                )}
              </div>
              <Select
                value={selectedBorrowerId}
                onValueChange={handleSelectBorrower}
                disabled={loadingBorrowers}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue
                    placeholder={
                      loadingBorrowers ? 'Carregando tomadores...' : 'Selecione o tomador...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.pj_company_name || b.full_name || 'Sem nome'}{' '}
                      {b.document_number ? `(${b.document_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBorrower && (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedBorrower.pj_company_name || selectedBorrower.full_name}
                    </p>
                    <p>{selectedBorrower.email || 'Sem e-mail'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px]">Limite Cadastrado:</p>
                    <p className="font-mono font-medium text-foreground">
                      {formatCurrency(Number(selectedBorrower.credit_limit || 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Ativo e Status Inicial */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Recebível *</Label>
                <Select
                  value={formData.receivableType}
                  onValueChange={(v) => setFormData({ ...formData, receivableType: v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione o Ativo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="promissoria">Nota Promissória</SelectItem>
                    <SelectItem value="duplicata">Duplicata</SelectItem>
                    <SelectItem value="mutuo">Contrato de Mútuo</SelectItem>
                    <SelectItem value="confissao_divida">Confissão de Dívida</SelectItem>
                    <SelectItem value="contratual">Recebível Contratual</SelectItem>
                    <SelectItem value="outro">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status Inicial da Operação *</Label>
                <Select
                  value={formData.initialStatus}
                  onValueChange={(v) => setFormData({ ...formData, initialStatus: v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Status inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enviado">Enviado (Novo Borderô)</SelectItem>
                    <SelectItem value="em_triagem">Em Triagem</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado (Pronto para Aditivo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.receivableType === 'outro' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Descreva o Recebível *</Label>
                  <Input
                    value={formData.receivableTypeOther}
                    onChange={(e) =>
                      setFormData({ ...formData, receivableTypeOther: e.target.value })
                    }
                    placeholder="Descreva a natureza do título..."
                  />
                </div>
              )}
            </div>

            {/* Originador e Título */}
            <div className="space-y-3 pt-2">
              <div className="border-b pb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> Dados do Originador e Título
                </h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cedente / Originador *</Label>
                  <Input
                    value={formData.cedente}
                    onChange={(e) => setFormData({ ...formData, cedente: e.target.value })}
                    placeholder="Razão Social / Nome do Cedente"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número do Documento (Ex: NF, N° Título) *</Label>
                  <Input
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    placeholder="Ex: NF-e 12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Emissão *</Label>
                  <Input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Dados do Sacado (Devedor) */}
            <div className="space-y-3 pt-2">
              <div className="border-b pb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dados do Sacado (Devedor)
                </h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome / Razão Social *</Label>
                  <Input
                    value={formData.sacado}
                    onChange={(e) => setFormData({ ...formData, sacado: e.target.value })}
                    placeholder="Nome do Sacado / Devedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ *</Label>
                  <Input
                    value={formData.sacadoDocument}
                    onChange={(e) => setFormData({ ...formData, sacadoDocument: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formData.sacadoEmail}
                    onChange={(e) => setFormData({ ...formData, sacadoEmail: e.target.value })}
                    placeholder="contato@sacado.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input
                    value={formData.sacadoPhone}
                    onChange={(e) => setFormData({ ...formData, sacadoPhone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Valores Financeiros */}
            <div className="space-y-3 pt-2">
              <div className="border-b pb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valores da Operação
                </h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor de Face (VF) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.faceValue}
                    onChange={(e) => setFormData({ ...formData, faceValue: e.target.value })}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Solicitado p/ Antecipação (VS) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.requestedValue}
                    onChange={(e) => setFormData({ ...formData, requestedValue: e.target.value })}
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2 pt-2">
              <Label>Observações Internas (Admin)</Label>
              <Textarea
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                placeholder="Observações sobre a originação, garantias ou condições especiais..."
                rows={2}
              />
            </div>

            {/* Anexos */}
            <div className="space-y-2 pt-2">
              <Label>Documentos Comprobatórios (Opcional no lançamento manual)</Label>
              <FileUpload files={files} setFiles={setFiles} />
            </div>
          </div>

          {/* Card Lateral: Simulador em Tempo Real */}
          <div className="space-y-4">
            <Card className="shadow-none border-primary/20 sticky top-0">
              <CardHeader className="pb-3 bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calculator className="h-4 w-4 text-primary" /> Simulador Financeiro
                </CardTitle>
                <CardDescription className="text-xs">
                  Cálculo em tempo real (mesma regra do borderô de clientes).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                {simulating ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : simulation ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Prazo Base:</span>
                      <span className="font-medium text-foreground">
                        {simulation.termDays} dias
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor de Face (VF):</span>
                      <span className="font-mono">
                        {formatCurrency(Number(formData.faceValue))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor Solicitado (VS):</span>
                      <span className="font-mono font-medium">
                        {formatCurrency(Number(formData.requestedValue))}
                      </span>
                    </div>
                    <div className="border-t my-2 pt-2 space-y-1.5">
                      <div className="flex justify-between text-destructive">
                        <span>Deságio Estimado:</span>
                        <span>-{formatCurrency(simulation.discount_val)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Juros Proporcionais:</span>
                        <span>-{formatCurrency(simulation.interest_val)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Custo Ad Valorem:</span>
                        <span>-{formatCurrency(simulation.ad_valorem_val)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Custo Estruturação:</span>
                        <span>-{formatCurrency(simulation.structuring_val)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Taxa de Análise:</span>
                        <span>-{formatCurrency(simulation.analysis_val)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>IOF (Fixo + Diário):</span>
                        <span>
                          -{formatCurrency(simulation.iof_daily_val + simulation.iof_fixed_val)}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-b py-2.5 font-semibold text-sm items-center bg-muted/20 px-2 rounded mt-2">
                      <span>Líquido Estimado:</span>
                      <span className="text-emerald-600 font-mono text-base">
                        {formatCurrency(simulation.net_value)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      CET Estimado: <strong>{simulation.effective_cost.toFixed(2)}%</strong>
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs bg-muted/20 rounded border border-dashed px-3">
                    Preencha o tipo de ativo, datas e valores para ver a prévia dos descontos.
                  </div>
                )}

                {Number(formData.requestedValue) > Number(formData.faceValue) && (
                  <div className="text-destructive bg-destructive/10 p-2 rounded text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Valor solicitado não pode ser maior que o valor de face.</span>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      submitting ||
                      !selectedBorrowerId ||
                      !formData.receivableType ||
                      !formData.documentNumber ||
                      !formData.faceValue ||
                      !formData.requestedValue ||
                      Number(formData.requestedValue) > Number(formData.faceValue)
                    }
                    className="w-full gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Confirmar Lançamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
