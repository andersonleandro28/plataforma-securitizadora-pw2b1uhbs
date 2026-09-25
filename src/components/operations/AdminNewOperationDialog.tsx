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
import { useSacadoSuggestions, KnownSacado } from '@/hooks/use-sacado-suggestions'
import { SacadoAutocomplete } from '@/components/operations/SacadoAutocomplete'
import { onlyDigits, maskCpf, maskCnpj } from '@/lib/cpf-cnpj'
import { toast } from 'sonner'
import { fetchCreditManagers, CreditManager } from '@/services/credit-managers'
import {
  Loader2,
  Calculator,
  Send,
  User,
  Building,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  FileCheck,
  Paperclip,
  CheckCircle2,
} from 'lucide-react'

export interface OperationInstallmentItem {
  id: string
  number: number
  dueDate: string
  value: string
  file?: File | null
  documentName?: string
  documentPath?: string
}

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
  const [creditManagers, setCreditManagers] = useState<CreditManager[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<string>('none')

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

  const [installmentsList, setInstallmentsList] = useState<OperationInstallmentItem[]>([])
  const [autoFilledSacado, setAutoFilledSacado] = useState(false)
  const [autoFilledSource, setAutoFilledSource] = useState<string>('')

  const {
    findByExactDocument,
    findByExactName,
    searchSuggestions,
    loading: loadingSacados,
  } = useSacadoSuggestions()

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

      try {
        const mgrs = await fetchCreditManagers(true) // apenas ativos para novas operações
        setCreditManagers(mgrs)
      } catch (mErr) {
        console.error('Erro ao buscar gerentes de crédito:', mErr)
      }
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

  const numInstallments = Math.max(1, parseInt(formData.installments, 10) || 1)

  // Serializar parcelas para envio na simulação
  const serializeInstallmentsForCalc = () => {
    if (numInstallments <= 1) return []
    return installmentsList.map((inst) => ({
      number: inst.number,
      dueDate: inst.dueDate,
      value: inst.value ? Number(inst.value) : null,
    }))
  }

  // Chave de dependência das parcelas para re-simulação automática
  const installmentsKey = installmentsList
    .map((i) => `${i.number}:${i.dueDate}:${i.value}`)
    .join('|')

  // Auto calculate simulation when important fields change
  useEffect(() => {
    const handler = setTimeout(() => {
      const hasBaseDue = Boolean(formData.dueDate)
      const hasInstallmentDues =
        numInstallments > 1 &&
        installmentsList.length > 0 &&
        installmentsList.some((i) => Boolean(i.dueDate))

      if (
        formData.receivableType &&
        formData.faceValue &&
        formData.requestedValue &&
        (hasBaseDue || hasInstallmentDues)
      ) {
        handleSimulate()
      }
    }, 600)
    return () => clearTimeout(handler)
  }, [
    formData.receivableType,
    formData.faceValue,
    formData.requestedValue,
    formData.issueDate,
    formData.dueDate,
    formData.installments,
    installmentsKey,
  ])

  const handleSimulate = async () => {
    if (Number(formData.requestedValue) > Number(formData.faceValue)) return
    setSimulating(true)
    try {
      const serializedInstallments = serializeInstallmentsForCalc()
      // Se parcelado, se não tiver dueDate geral, usa a última ou 1ª parcela como fallback
      const effectiveDueDate =
        formData.dueDate ||
        (serializedInstallments.length > 0
          ? serializedInstallments[serializedInstallments.length - 1]?.dueDate ||
            serializedInstallments[0]?.dueDate
          : undefined)

      const { data } = await supabase.functions.invoke('calculate-operation', {
        body: {
          simulate_data: {
            receivable_type: formData.receivableType,
            face_value: formData.faceValue,
            requested_value: formData.requestedValue,
            issue_date: formData.issueDate || undefined,
            due_date: effectiveDueDate,
            installments_data: serializedInstallments,
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

  // Sincronizar número de parcelas com installmentsList
  const syncInstallmentsCount = (
    targetCount: number,
    baseDueDate?: string,
    totalFaceValue?: number,
  ) => {
    const validCount = Math.max(1, targetCount)
    setInstallmentsList((prev) => {
      const next: OperationInstallmentItem[] = []
      const perValue =
        totalFaceValue && validCount > 0 ? (totalFaceValue / validCount).toFixed(2) : ''

      for (let i = 1; i <= validCount; i++) {
        const existing = prev.find((p) => p.number === i)
        if (existing) {
          next.push(existing)
        } else {
          // Calcular vencimento mensal sugerido baseado na parcela 1 ou baseDueDate
          let suggestedDue = ''
          const refDateStr = prev[0]?.dueDate || baseDueDate || formData.dueDate || ''
          if (refDateStr) {
            const parts = refDateStr.split('-')
            if (parts.length === 3) {
              const d = new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10),
              )
              d.setMonth(d.getMonth() + (i - 1))
              suggestedDue = d.toISOString().split('T')[0]
            }
          }
          next.push({
            id: `inst-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            number: i,
            dueDate: suggestedDue,
            value: perValue,
            file: null,
            documentName: '',
          })
        }
      }
      return next
    })
  }

  // Quando o input de parcelas mudar
  const handleInstallmentsChange = (valStr: string) => {
    setFormData((prev) => ({ ...prev, installments: valStr }))
    const count = parseInt(valStr, 10)
    if (!isNaN(count) && count > 1) {
      syncInstallmentsCount(count, formData.dueDate, Number(formData.faceValue) || undefined)
    }
  }

  // Ação para gerar vencimentos mensais automaticamente a partir do 1º vencimento
  const handleAutoGenerateDates = () => {
    const firstDue = installmentsList[0]?.dueDate || formData.dueDate
    if (!firstDue) {
      toast.error('Informe a data de vencimento da Parcela 1 para gerar as seguintes')
      return
    }
    const parts = firstDue.split('-')
    if (parts.length !== 3) return
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)

    setInstallmentsList((prev) =>
      prev.map((inst, idx) => {
        const d = new Date(year, month + idx, day)
        const dateStr = d.toISOString().split('T')[0]
        return {
          ...inst,
          dueDate: dateStr,
        }
      }),
    )
    toast.success('Vencimentos mensais gerados a partir da 1ª parcela!')
  }

  // Ação para ratear o valor de face igualmente entre as parcelas
  const handleSplitValuesEqually = () => {
    const total = Number(formData.faceValue)
    if (!total || total <= 0) {
      toast.error('Preencha o Valor de Face antes de ratear')
      return
    }
    const count = installmentsList.length
    if (count <= 0) return
    const each = (total / count).toFixed(2)
    setInstallmentsList((prev) =>
      prev.map((inst) => ({
        ...inst,
        value: each,
      })),
    )
    toast.success(`Valor de face dividido igualmente (${count}x de R$ ${each})`)
  }

  const handleUpdateInstallment = (
    index: number,
    field: keyof OperationInstallmentItem,
    value: any,
  ) => {
    setInstallmentsList((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddInstallmentRow = () => {
    const newCount = installmentsList.length + 1
    setFormData((prev) => ({ ...prev, installments: String(newCount) }))
    setInstallmentsList((prev) => [
      ...prev,
      {
        id: `inst-${newCount}-${Date.now()}`,
        number: newCount,
        dueDate: '',
        value: formData.faceValue ? (Number(formData.faceValue) / newCount).toFixed(2) : '',
        file: null,
        documentName: '',
      },
    ])
  }

  const handleRemoveInstallmentRow = (index: number) => {
    if (installmentsList.length <= 2) {
      toast.info('Para apenas 1 parcela, altere o campo "Parcelas" para 1.')
      return
    }
    const filtered = installmentsList.filter((_, i) => i !== index)
    const renumbered = filtered.map((item, idx) => ({ ...item, number: idx + 1 }))
    setInstallmentsList(renumbered)
    setFormData((prev) => ({ ...prev, installments: String(renumbered.length) }))
  }

  // Cálculos de validação de parcelas
  const sumInstallmentsValue = installmentsList.reduce(
    (acc, curr) => acc + (Number(curr.value) || 0),
    0,
  )
  const faceValueNum = Number(formData.faceValue) || 0
  const installmentsValueDifference = Math.abs(sumInstallmentsValue - faceValueNum)
  const hasValueDivergence =
    numInstallments > 1 &&
    installmentsList.some((i) => Boolean(i.value)) &&
    faceValueNum > 0 &&
    installmentsValueDifference > 0.05

  const resetForm = () => {
    setSelectedBorrowerId('')
    setSelectedManagerId('none')
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
    setAutoFilledSacado(false)
    setAutoFilledSource('')
    setInstallmentsList([])
    setFiles([])
    setSimulation(null)
  }

  // Preenche dados do sacado a partir de um registro conhecido encontrado
  const applyKnownSacado = (item: KnownSacado, notify = true) => {
    setFormData((prev) => ({
      ...prev,
      sacado: item.name || prev.sacado,
      sacadoDocument: item.document || prev.sacadoDocument,
      sacadoEmail: item.email || prev.sacadoEmail,
      sacadoPhone: item.phone || prev.sacadoPhone,
    }))
    setAutoFilledSacado(true)
    setAutoFilledSource(item.source)
    if (notify) {
      toast.info(
        `Dados do sacado preenchidos automaticamente (${item.source === 'credit_operations' ? 'operação anterior' : 'cadastro'})`,
        { duration: 3500 },
      )
    }
  }

  // Handler para mudança no Documento (CPF/CNPJ) do Sacado com detecção automática exata
  const handleSacadoDocumentChange = (val: string) => {
    // Formatação amigável se o usuário digitar/colar apenas números
    const clean = onlyDigits(val)
    let formattedVal = val
    if (clean.length === 11) {
      formattedVal = maskCpf(clean)
    } else if (clean.length === 14) {
      formattedVal = maskCnpj(clean)
    }

    setFormData((prev) => ({ ...prev, sacadoDocument: formattedVal }))

    // Buscar match por documento exato (prioridade máxima)
    if (clean.length === 11 || clean.length === 14) {
      const match = findByExactDocument(clean)
      if (match) {
        applyKnownSacado(match, true)
      }
    }
  }

  // Handler para mudança no Nome do Sacado
  const handleSacadoNameChange = (val: string) => {
    setFormData((prev) => ({ ...prev, sacado: val }))

    // Se o usuário não digitou documento e o nome digitado bater exatamente com um único sacado conhecido
    if (!formData.sacadoDocument && val.trim().length >= 4) {
      const match = findByExactName(val)
      if (match) {
        applyKnownSacado(match, true)
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedBorrowerId) return toast.error('Selecione o tomador / cedente da operação')
    if (!formData.receivableType) return toast.error('Tipo de Recebível é obrigatório')
    if (formData.receivableType === 'outro' && !formData.receivableTypeOther)
      return toast.error('Descreva o tipo de recebível')
    if (!formData.cedente) return toast.error('Informe o nome do cedente / originador')
    if (!formData.documentNumber) return toast.error('Informe o número do documento')
    if (!formData.issueDate)
      return toast.error('Informe a data da operação / emissão (base do cálculo de juros)')
    if (formData.issueDate > todayStr)
      return toast.error(
        'A data da operação não pode ser futura. Deve ser hoje ou uma data retroativa.',
      )
    if (numInstallments <= 1) {
      if (!formData.dueDate) return toast.error('Informe a data de vencimento')
      if (formData.issueDate >= formData.dueDate)
        return toast.error('A data de vencimento deve ser posterior à data da operação.')
    } else {
      // Validações para múltiplas parcelas
      if (installmentsList.length === 0) {
        return toast.error('Defina os vencimentos das parcelas.')
      }
      for (let i = 0; i < installmentsList.length; i++) {
        const item = installmentsList[i]
        if (!item.dueDate) {
          return toast.error(`Informe a data de vencimento da Parcela ${item.number}`)
        }
        if (item.dueDate <= formData.issueDate) {
          return toast.error(
            `O vencimento da Parcela ${item.number} (${new Date(
              item.dueDate + 'T00:00:00',
            ).toLocaleDateString('pt-BR')}) deve ser posterior à data da operação (${new Date(
              formData.issueDate + 'T00:00:00',
            ).toLocaleDateString('pt-BR')}).`,
          )
        }
      }
    }

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
      // Preparar payload de parcelas para o JSONB
      const serializedInstallments =
        numInstallments > 1
          ? installmentsList.map((inst) => ({
              number: inst.number,
              dueDate: inst.dueDate,
              value: inst.value ? Number(inst.value) : null,
              documentName: inst.file ? inst.file.name : inst.documentName || null,
            }))
          : []

      // Se parcelas > 1, a due_date da operação pode ser sincronizada com a última parcela ou 1ª parcela
      const effectiveDueDate =
        numInstallments > 1 && installmentsList[0]?.dueDate
          ? installmentsList[installmentsList.length - 1]?.dueDate || installmentsList[0].dueDate
          : formData.dueDate

      // 1. Criar operação de crédito (com alíquota histórica vigente do gerente)
      const selectedManager = creditManagers.find((m) => m.id === selectedManagerId)
      const historicalCommissionRate =
        selectedManager && selectedManagerId !== 'none'
          ? Number(selectedManager.commission_anticipation_pct || 0)
          : null

      const { data: op, error: opErr } = await supabase
        .from('credit_operations')
        .insert({
          borrower_id: selectedBorrowerId,
          manager_id: selectedManagerId && selectedManagerId !== 'none' ? selectedManagerId : null,
          commission_rate_applied: historicalCommissionRate,
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
          due_date: effectiveDueDate,
          installments: numInstallments,
          installments_data: serializedInstallments,
          observations: formData.observations
            ? `[Lançado pelo Admin]: ${formData.observations}`
            : '[Lançado pelo Admin na mesa de operações]',
          status: formData.initialStatus || 'enviado',
        } as any)
        .select()
        .single()

      if (opErr) throw opErr

      // 2. Upload de arquivos anexados
      // 2a. Documentos individuais por parcela (se parcelas > 1)
      const updatedInstallments: any[] = [...serializedInstallments]
      let hasInstallmentUpdates = false

      if (numInstallments > 1) {
        for (let i = 0; i < installmentsList.length; i++) {
          const inst = installmentsList[i]
          if (inst.file) {
            const safeName = inst.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const path = `${op.id}/parcela_${inst.number}_${Date.now()}_${safeName}`
            const { error: uploadError } = await supabase.storage
              .from('operation-docs')
              .upload(path, inst.file)

            if (!uploadError) {
              await supabase.from('operation_documents').insert({
                operation_id: op.id,
                file_path: path,
                file_name: `Parcela ${inst.number} - ${inst.file.name}`,
                file_type: inst.file.type,
                file_size: inst.file.size,
                uploaded_by: user?.id,
                category: `parcela_${inst.number}`,
              } as any)

              if (updatedInstallments[i]) {
                updatedInstallments[i] = {
                  ...updatedInstallments[i],
                  documentPath: path,
                  documentName: inst.file.name,
                }
                hasInstallmentUpdates = true
              }
            }
          }
        }

        // Se gravamos o documentPath de cada arquivo de parcela, atualizar installments_data
        if (hasInstallmentUpdates) {
          await supabase
            .from('credit_operations')
            .update({ installments_data: updatedInstallments } as any)
            .eq('id', op.id)
        }
      }

      // 2b. Documentos gerais adicionais anexados no componente FileUpload geral
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
  const todayStr = new Date().toISOString().split('T')[0]
  const isRetroactiveDate = Boolean(formData.issueDate && formData.issueDate < todayStr)
  const isFutureDate = Boolean(formData.issueDate && formData.issueDate > todayStr)

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
                  <Building className="w-3.5 h-3.5" /> Dados do Originador, Gerente e Título
                </h4>
              </div>

              {/* Seletor de Gerente de Crédito */}
              <div className="p-3 bg-muted/20 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="op-manager"
                    className="text-xs font-medium flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-primary" /> Gerente de Crédito (Indicação)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Define a comissão sobre o deságio
                  </span>
                </div>
                <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                  <SelectTrigger id="op-manager" className="bg-background">
                    <SelectValue placeholder="Selecione o gerente responsável..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Sem indicação de gerente (não paga comissão)
                    </SelectItem>
                    {creditManagers.map((mgr) => (
                      <SelectItem key={mgr.id} value={mgr.id}>
                        {mgr.full_name} ({mgr.commission_anticipation_pct}% comissão)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Exibição clara do % aplicado vigente na data da operação */}
                {selectedManagerId && selectedManagerId !== 'none' ? (
                  <div className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/20 text-xs">
                    <span className="text-muted-foreground">
                      Percentual de comissão vigente (antecipação):
                    </span>
                    <span className="font-semibold text-primary">
                      {creditManagers.find((m) => m.id === selectedManagerId)
                        ?.commission_anticipation_pct ?? 0}
                      %
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (será gravado nesta operação)
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Nenhuma comissão será gerada para esta operação.
                  </p>
                )}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="issueDate">Data da Operação (Emissão / Base dos Juros) *</Label>
                    {isRetroactiveDate && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                        Retroativa
                      </span>
                    )}
                  </div>
                  <Input
                    id="issueDate"
                    type="date"
                    max={todayStr}
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    className={
                      isFutureDate ? 'border-destructive focus-visible:ring-destructive' : ''
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pode ser uma <strong>data retroativa no passado</strong> ou a data de hoje. Os
                    juros e deságio serão calculados a partir desta data até o vencimento.
                  </p>
                  {isFutureDate && (
                    <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> A data da operação não pode ser futura.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">
                    {numInstallments > 1 ? '1º Vencimento (ou Base) *' : 'Data de Vencimento *'}
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => {
                      const newDue = e.target.value
                      setFormData((prev) => ({ ...prev, dueDate: newDue }))
                      if (numInstallments > 1 && installmentsList.length > 0) {
                        setInstallmentsList((prev) =>
                          prev.map((inst, idx) =>
                            idx === 0 ? { ...inst, dueDate: newDue } : inst,
                          ),
                        )
                      }
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {numInstallments > 1
                      ? 'Data de vencimento da primeira parcela ou referência de cálculo.'
                      : 'Data em que o título / recebível vence.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.installments}
                    onChange={(e) => handleInstallmentsChange(e.target.value)}
                  />
                  {numInstallments > 1 && (
                    <p className="text-[11px] text-primary font-medium">
                      Operação dividida em {numInstallments} parcelas. Configure os vencimentos e
                      documentos abaixo.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO DINÂMICA DE PARCELAS (SE PARCELAS > 1) */}
            {numInstallments > 1 && (
              <div className="space-y-3 pt-2 bg-muted/20 border border-primary/20 rounded-lg p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Cronograma de Parcelas &amp; Documentos
                      Individuais ({installmentsList.length} parcelas)
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      Informe o vencimento, valor e anexe o documento comprobatório de cada parcela.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleAutoGenerateDates}
                      title="Preenche vencimentos mensais a partir do 1º vencimento"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" /> Vencimentos Mensais
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleSplitValuesEqually}
                      title="Divide o valor de face igualmente entre as parcelas"
                    >
                      <Calculator className="w-3 h-3 text-primary" /> Ratear VF
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleAddInstallmentRow}
                    >
                      <Plus className="w-3 h-3" /> Parcela
                    </Button>
                  </div>
                </div>

                {hasValueDivergence && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-300 dark:border-amber-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Soma das parcelas ({formatCurrency(sumInstallmentsValue)}) difere do Valor
                        de Face ({formatCurrency(faceValueNum)}).
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-amber-700 dark:text-amber-300 underline"
                      onClick={handleSplitValuesEqually}
                    >
                      Ajustar automaticamente
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {installmentsList.map((inst, index) => {
                    const isDueValid =
                      inst.dueDate && (!formData.issueDate || inst.dueDate > formData.issueDate)
                    return (
                      <div
                        key={inst.id}
                        className="p-2.5 rounded border bg-background/80 hover:bg-background transition-colors flex flex-col md:flex-row md:items-center gap-3 text-xs"
                      >
                        <div className="flex items-center justify-between md:w-28 shrink-0">
                          <span className="font-semibold text-primary flex items-center gap-1">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                              {inst.number}
                            </span>
                            Parcela {inst.number}
                          </span>
                          {installmentsList.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive md:hidden"
                              onClick={() => handleRemoveInstallmentRow(index)}
                              title="Remover parcela"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {/* Vencimento individual */}
                        <div className="space-y-1 flex-1 min-w-[150px]">
                          <Label className="text-[11px] text-muted-foreground">Vencimento *</Label>
                          <Input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const val = e.target.value
                              handleUpdateInstallment(index, 'dueDate', val)
                              if (index === 0 && !formData.dueDate) {
                                setFormData((prev) => ({ ...prev, dueDate: val }))
                              }
                            }}
                            className={`h-8 text-xs ${
                              inst.dueDate && !isDueValid ? 'border-destructive' : ''
                            }`}
                          />
                          {inst.dueDate && !isDueValid && (
                            <p className="text-[10px] text-destructive">
                              Deve ser posterior à data da operação
                            </p>
                          )}
                        </div>

                        {/* Valor individual */}
                        <div className="space-y-1 md:w-36 shrink-0">
                          <Label className="text-[11px] text-muted-foreground">Valor (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={inst.value}
                            onChange={(e) =>
                              handleUpdateInstallment(index, 'value', e.target.value)
                            }
                            placeholder={
                              faceValueNum > 0
                                ? (faceValueNum / installmentsList.length).toFixed(2)
                                : '0.00'
                            }
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        {/* Upload de documento individual da parcela */}
                        <div className="space-y-1 flex-1 min-w-[200px]">
                          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Paperclip className="w-3 h-3" /> Documento / Título da Parcela
                          </Label>
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-input bg-background hover:bg-muted/50 text-xs text-foreground transition-colors h-8 shrink-0">
                              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{inst.file ? 'Trocar' : 'Anexar'}</span>
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.zip"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleUpdateInstallment(index, 'file', file)
                                    handleUpdateInstallment(index, 'documentName', file.name)
                                  }
                                }}
                              />
                            </label>
                            {inst.file ? (
                              <div className="flex items-center gap-1.5 overflow-hidden text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 text-[11px] flex-1">
                                <FileCheck className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate" title={inst.file.name}>
                                  {inst.file.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateInstallment(index, 'file', null)
                                    handleUpdateInstallment(index, 'documentName', '')
                                  }}
                                  className="ml-auto text-muted-foreground hover:text-destructive"
                                  title="Remover anexo"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic truncate">
                                Nenhum arquivo selecionado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botão remover desktop */}
                        {installmentsList.length > 2 && (
                          <div className="hidden md:flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveInstallmentRow(index)}
                              title="Remover parcela"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Dados do Sacado (Devedor) */}
            <div className="space-y-3 pt-2">
              <div className="border-b pb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> Dados do Sacado (Devedor)
                </h4>
                {autoFilledSacado && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    Dados preenchidos automaticamente de{' '}
                    {autoFilledSource === 'credit_operations' ? 'operação anterior' : 'cadastro'}
                  </span>
                )}
              </div>

              {autoFilledSacado && (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2.5 rounded flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Reconhecemos este sacado no histórico. Os campos foram preenchidos e estão
                      abertos para edição caso necessite alterar.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground underline px-1.5"
                    onClick={() => {
                      setAutoFilledSacado(false)
                      setAutoFilledSource('')
                    }}
                  >
                    Dispensar
                  </Button>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {/* Autocomplete com sugestões ao digitar Nome */}
                <SacadoAutocomplete
                  label="Nome / Razão Social *"
                  placeholder="Digite o nome ou selecione das sugestões..."
                  value={formData.sacado}
                  onChange={handleSacadoNameChange}
                  onSelectSacado={(item) => applyKnownSacado(item, true)}
                  suggestions={searchSuggestions(formData.sacado)}
                  isLoading={loadingSacados}
                  autoFilled={autoFilledSacado}
                  autoFilledSource={autoFilledSource}
                  onClearAutoFill={() => {
                    setAutoFilledSacado(false)
                    setAutoFilledSource('')
                  }}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>CPF / CNPJ *</Label>
                    <span className="text-[10px] text-muted-foreground">
                      Match automático por documento
                    </span>
                  </div>
                  <Input
                    value={formData.sacadoDocument}
                    onChange={(e) => handleSacadoDocumentChange(e.target.value)}
                    placeholder="00.000.000/0000-00 ou CPF"
                    className={autoFilledSacado ? 'border-emerald-500/40' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formData.sacadoEmail}
                    onChange={(e) => setFormData({ ...formData, sacadoEmail: e.target.value })}
                    placeholder="contato@sacado.com"
                    className={autoFilledSacado ? 'border-emerald-500/40' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input
                    value={formData.sacadoPhone}
                    onChange={(e) => setFormData({ ...formData, sacadoPhone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className={autoFilledSacado ? 'border-emerald-500/40' : ''}
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
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        Prazo de Juros:
                        {simulation.isInstallmentCalculation && (
                          <span className="text-[10px] text-primary font-medium">
                            (médio ponderado)
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-foreground">
                        {simulation.termDays} dias
                      </span>
                    </div>

                    <div className="text-[11px] bg-muted/40 p-2 rounded border text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Período de Juros:</span>
                        {isRetroactiveDate && (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800">
                            Retroativa
                          </span>
                        )}
                      </div>
                      {simulation.isInstallmentCalculation &&
                      Array.isArray(simulation.installmentsBreakdown) ? (
                        <p className="text-foreground">
                          Cálculo somado individualmente para as{' '}
                          <strong>{simulation.installmentsBreakdown.length} parcelas</strong> a
                          partir de{' '}
                          <strong>
                            {formData.issueDate
                              ? new Date(formData.issueDate + 'T00:00:00').toLocaleDateString(
                                  'pt-BR',
                                )
                              : 'hoje'}
                          </strong>
                          .
                        </p>
                      ) : formData.issueDate && formData.dueDate ? (
                        <p>
                          {simulation.termDays} dias (de{' '}
                          <strong className="text-foreground">
                            {new Date(formData.issueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </strong>{' '}
                          a{' '}
                          <strong className="text-foreground">
                            {new Date(formData.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </strong>
                          )
                        </p>
                      ) : formData.dueDate ? (
                        <p>
                          {simulation.termDays} dias (de hoje a{' '}
                          <strong className="text-foreground">
                            {new Date(formData.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </strong>
                          )
                        </p>
                      ) : (
                        <span>-</span>
                      )}
                    </div>

                    {/* Detalhamento por Parcela se cálculo for parcelado */}
                    {simulation.isInstallmentCalculation &&
                      Array.isArray(simulation.installmentsBreakdown) &&
                      simulation.installmentsBreakdown.length > 0 && (
                        <div className="mt-2 border rounded-md p-2 bg-background/50 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
                            <span>Detalhamento por Parcela</span>
                            <span>Prazo / Juros</span>
                          </div>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                            {simulation.installmentsBreakdown.map((item: any) => (
                              <div
                                key={item.number}
                                className="flex items-center justify-between text-[10.5px] p-1 rounded bg-muted/30 border border-muted"
                              >
                                <div>
                                  <span className="font-semibold text-foreground">
                                    P{item.number}:
                                  </span>{' '}
                                  <span className="font-mono text-muted-foreground">
                                    {formatCurrency(Number(item.faceValue || 0))}
                                  </span>
                                  {item.dueDate && (
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                      (
                                      {new Date(item.dueDate + 'T00:00:00').toLocaleDateString(
                                        'pt-BR',
                                      )}
                                      )
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-medium text-foreground">
                                    {item.termDays}d
                                  </span>{' '}
                                  <span className="text-destructive font-mono text-[10px]">
                                    (-
                                    {formatCurrency(
                                      Number(item.interest_val || 0) +
                                        Number(item.discount_val || 0),
                                    )}
                                    )
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="flex justify-between pt-1">
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
                      !formData.issueDate ||
                      isFutureDate ||
                      (!formData.dueDate && numInstallments <= 1) ||
                      (numInstallments > 1 && installmentsList.some((inst) => !inst.dueDate)) ||
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
