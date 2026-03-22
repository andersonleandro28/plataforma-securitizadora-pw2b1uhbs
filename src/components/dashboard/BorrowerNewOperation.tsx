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
import { toast } from 'sonner'
import { Loader2, Calculator, Send } from 'lucide-react'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function BorrowerNewOperation({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simulation, setSimulation] = useState<any>(null)

  const [formData, setFormData] = useState({
    receivableType: '',
    receivableTypeOther: '',
    cedente: '',
    sacado: '',
    documentNumber: '',
    faceValue: '',
    requestedValue: '',
    issueDate: '',
    dueDate: '',
    installments: '1',
    observations: '',
  })

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
    setSimulating(false)
  }

  const handleSubmit = async () => {
    if (!formData.receivableType) return toast.error('Tipo de Recebível é obrigatório')
    if (formData.receivableType === 'outro' && !formData.receivableTypeOther)
      return toast.error('Descreva o tipo de recebível')
    if (!files.length) return toast.error('Anexe pelo menos um documento comprobatório')
    if (Number(formData.requestedValue) > Number(formData.faceValue))
      return toast.error('Valor solicitado não pode ser maior que o valor de face')

    setSubmitting(true)
    try {
      // 1. Create operation - This persists the operation in DB
      const { data: op, error: opErr } = await supabase
        .from('credit_operations')
        .insert({
          borrower_id: user?.id,
          receivable_type: formData.receivableType,
          receivable_type_other: formData.receivableTypeOther,
          cedente: formData.cedente,
          sacado: formData.sacado,
          document_number: formData.documentNumber,
          face_value: Number(formData.faceValue),
          requested_value: Number(formData.requestedValue),
          issue_date: formData.issueDate,
          due_date: formData.dueDate,
          installments: Number(formData.installments),
          observations: formData.observations,
          status: 'enviado',
        })
        .select()
        .single()

      if (opErr) throw opErr

      // 2. Upload files reliably as multipart/form-data linked to operation ID
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

      // 3. Trigger robust Server-side Calculation ensuring values are permanently saved
      await supabase.functions.invoke('calculate-operation', { body: { operation_id: op.id } })

      // Audit trail
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'CREATE_OPERATION',
        entity_type: 'credit_operations',
        entity_id: op.id,
      })

      toast.success('Borderô enviado com sucesso para análise!')

      setFormData({
        receivableType: '',
        receivableTypeOther: '',
        cedente: '',
        sacado: '',
        documentNumber: '',
        faceValue: '',
        requestedValue: '',
        issueDate: '',
        dueDate: '',
        installments: '1',
        observations: '',
      })
      setFiles([])
      setSimulation(null)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar operação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Enviar Novo Borderô</CardTitle>
          <CardDescription>
            Preencha os dados do recebível e anexe os documentos comprobatórios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            {formData.receivableType === 'outro' && (
              <div className="space-y-2">
                <Label>Descreva o Recebível *</Label>
                <Input
                  value={formData.receivableTypeOther}
                  onChange={(e) =>
                    setFormData({ ...formData, receivableTypeOther: e.target.value })
                  }
                />
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cedente / Originador *</Label>
              <Input
                value={formData.cedente}
                onChange={(e) => setFormData({ ...formData, cedente: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sacado / Devedor *</Label>
              <Input
                value={formData.sacado}
                onChange={(e) => setFormData({ ...formData, sacado: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Número do Documento *</Label>
              <Input
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
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

          <div className="grid md:grid-cols-2 gap-4 pt-2">
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

          <div className="space-y-2 pt-2">
            <Label>Observações Adicionais</Label>
            <Textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              placeholder="Informações relevantes para a análise..."
            />
          </div>

          <div className="space-y-2 pt-4">
            <Label>Documentos Comprobatórios (XML, PDF, JPG, etc) *</Label>
            <FileUpload files={files} setFiles={setFiles} />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t py-4">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !formData.receivableType ||
              !files.length ||
              Number(formData.requestedValue) > Number(formData.faceValue)
            }
            className="w-full gap-2"
            size="lg"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Enviar para Análise
          </Button>
        </CardFooter>
      </Card>

      <Card className="h-fit shadow-sm border-primary/20 sticky top-6">
        <CardHeader className="pb-4 bg-primary/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-primary" /> Simulador Dinâmico
          </CardTitle>
          <CardDescription>
            Cálculo em tempo real (Server-side) baseado nos parâmetros do ativo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {simulating ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : simulation ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Prazo Base:</span>
                <span className="font-medium text-foreground">{simulation.termDays} dias</span>
              </div>
              <div className="flex justify-between">
                <span>Valor de Face (VF):</span>
                <span className="font-mono">{formatCurrency(Number(formData.faceValue))}</span>
              </div>
              <div className="flex justify-between">
                <span>Valor Solicitado (VS):</span>
                <span className="font-mono font-medium">
                  {formatCurrency(Number(formData.requestedValue))}
                </span>
              </div>
              <div className="border-t my-2 pt-2 space-y-2">
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
              <div className="flex justify-between border-t border-b py-3 font-semibold text-lg items-center bg-muted/10 px-2 rounded-sm mt-2">
                <span>Líquido Estimado:</span>
                <span className="text-emerald-600 font-mono">
                  {formatCurrency(simulation.net_value)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Custo Efetivo Total (CET): <strong>{simulation.effective_cost.toFixed(2)}%</strong>
                <br />
                <span className="opacity-75">* Valores sujeitos a análise de crédito.</span>
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-md border border-dashed">
              Selecione o tipo de ativo, datas e preencha os valores para visualizar a simulação
              transparente.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
