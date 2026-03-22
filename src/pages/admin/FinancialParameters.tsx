import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Loader2, Save, Settings2 } from 'lucide-react'

export default function FinancialParameters() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<string>('global')
  const [params, setParams] = useState<any>({})

  const defaultParams = {
    receivable_type: 'global',
    interest_rate_monthly: 0,
    discount_rate_monthly: 0,
    ad_valorem_rate: 0,
    ad_valorem_base: 'face_value',
    structuring_fee: 0,
    structuring_fee_type: 'fixed',
    analysis_fee: 0,
    analysis_fee_type: 'fixed',
    iof_fixed_rate: 0,
    iof_daily_rate: 0,
    penalty_rate: 0,
    default_interest_rate: 0,
    min_operation_value: 0,
    max_operation_value: 0,
    min_term_days: 0,
    max_term_days: 0,
    grace_period_days: 0,
  }

  const fetchParams = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('financial_parameters')
      .select('*')
      .eq('receivable_type', type)
      .maybeSingle()
    if (data) setParams(data)
    else setParams({ ...defaultParams, receivable_type: type })
    setLoading(false)
  }

  useEffect(() => {
    fetchParams()
  }, [type])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: current } = await supabase
        .from('financial_parameters')
        .select('id')
        .eq('receivable_type', type)
        .maybeSingle()
      let pId = current?.id

      const payload = {
        ...params,
        interest_rate_monthly: Number(params.interest_rate_monthly),
        discount_rate_monthly: Number(params.discount_rate_monthly),
        ad_valorem_rate: Number(params.ad_valorem_rate),
        structuring_fee: Number(params.structuring_fee),
        analysis_fee: Number(params.analysis_fee),
        iof_fixed_rate: Number(params.iof_fixed_rate),
        iof_daily_rate: Number(params.iof_daily_rate),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      if (pId) {
        await supabase.from('financial_parameters').update(payload).eq('id', pId)
      } else {
        const { data: inserted } = await supabase
          .from('financial_parameters')
          .insert(payload)
          .select()
          .single()
        pId = inserted?.id
      }

      if (pId) {
        await supabase
          .from('parameter_history')
          .insert({ parameter_id: pId, changes: payload, changed_by: user?.id })
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user?.id,
            action: 'UPDATE_PARAMETERS',
            entity_type: 'financial_parameters',
            entity_id: pId,
          })
      }

      toast.success('Parâmetros financeiros atualizados com sucesso.')
    } catch (err) {
      toast.error('Erro ao salvar parâmetros.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parâmetros Financeiros</h1>
        <p className="text-muted-foreground">
          Configure as taxas padrão que o motor de cálculo utilizará para novas operações.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-base">Contexto de Configuração:</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[250px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">Global (Padrão)</SelectItem>
            <SelectItem value="cheque">Cheques</SelectItem>
            <SelectItem value="promissoria">Nota Promissória</SelectItem>
            <SelectItem value="duplicata">Duplicata</SelectItem>
            <SelectItem value="mutuo">Contrato de Mútuo</SelectItem>
            <SelectItem value="confissao_divida">Confissão de Dívida</SelectItem>
            <SelectItem value="contratual">Recebível Contratual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" /> Taxas e Precificação
          </CardTitle>
          <CardDescription>
            Estes valores serão aplicados pro-rata-die em operações de{' '}
            {type === 'global' ? 'qualquer tipo não específico' : type}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deságio Mensal (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.discount_rate_monthly}
                    onChange={(e) =>
                      setParams({ ...params, discount_rate_monthly: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Juros Mensais (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.interest_rate_monthly}
                    onChange={(e) =>
                      setParams({ ...params, interest_rate_monthly: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Taxa Ad Valorem (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.ad_valorem_rate}
                    onChange={(e) => setParams({ ...params, ad_valorem_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base de Cálculo Ad Valorem</Label>
                  <Select
                    value={params.ad_valorem_base}
                    onValueChange={(v) => setParams({ ...params, ad_valorem_base: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="face_value">Valor de Face (Bruto)</SelectItem>
                      <SelectItem value="requested_value">Valor Solicitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-4 gap-4 border-t pt-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Taxa Estruturação</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.structuring_fee}
                    onChange={(e) => setParams({ ...params, structuring_fee: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Tipo Estruturação</Label>
                  <Select
                    value={params.structuring_fee_type}
                    onValueChange={(v) => setParams({ ...params, structuring_fee_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixo (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Taxa Análise</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.analysis_fee}
                    onChange={(e) => setParams({ ...params, analysis_fee: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Tipo Análise</Label>
                  <Select
                    value={params.analysis_fee_type}
                    onValueChange={(v) => setParams({ ...params, analysis_fee_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixo (R$)</SelectItem>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>IOF Diário (%)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={params.iof_daily_rate}
                    onChange={(e) => setParams({ ...params, iof_daily_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IOF Fixo Adicional (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={params.iof_fixed_rate}
                    onChange={(e) => setParams({ ...params, iof_fixed_rate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/20 border-t py-4 justify-end">
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Parâmetros
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
