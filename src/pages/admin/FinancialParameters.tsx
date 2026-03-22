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
import { Loader2, Save, Settings2, History, Info } from 'lucide-react'

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
    structuring_fee_type: 'percentage',
    analysis_fee: 0,
    analysis_fee_type: 'fixed',
    iof_fixed_rate: 0.38,
    iof_daily_rate: 0.0041,
  }

  const fetchParams = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('financial_parameters')
      .select('*')
      .eq('receivable_type', type)
      .maybeSingle()

    if (data) {
      setParams(data)
    } else {
      // If specific type not found, try to fetch global as a baseline, but keep type
      const { data: globalData } = await supabase
        .from('financial_parameters')
        .select('*')
        .eq('receivable_type', 'global')
        .maybeSingle()

      setParams({ ...(globalData || defaultParams), id: undefined, receivable_type: type })
    }
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
        receivable_type: type,
        interest_rate_monthly: Number(params.interest_rate_monthly),
        discount_rate_monthly: Number(params.discount_rate_monthly),
        ad_valorem_rate: Number(params.ad_valorem_rate),
        structuring_fee: Number(params.structuring_fee),
        structuring_fee_type: params.structuring_fee_type,
        analysis_fee: Number(params.analysis_fee),
        analysis_fee_type: params.analysis_fee_type,
        iof_fixed_rate: Number(params.iof_fixed_rate),
        iof_daily_rate: Number(params.iof_daily_rate),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }

      if (pId) {
        const { error } = await supabase.from('financial_parameters').update(payload).eq('id', pId)
        if (error) throw error
      } else {
        const { data: inserted, error } = await supabase
          .from('financial_parameters')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        pId = inserted?.id
      }

      if (pId) {
        await supabase
          .from('parameter_history')
          .insert({ parameter_id: pId, changes: payload, changed_by: user?.id })
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'UPDATE_PARAMETERS',
          entity_type: 'financial_parameters',
          entity_id: pId,
          details: { type, payload },
        })
      }

      toast.success(`Parâmetros para "${type}" atualizados com sucesso.`)
      fetchParams()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar parâmetros.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações Financeiras</h1>
        <p className="text-muted-foreground">
          Defina as taxas padrão e as taxas específicas por tipo de ativo (TDM, TJM, TAV, TE, TA).
        </p>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Hierarquia de Cálculo:</strong> O motor financeiro sempre buscará primeiro a
            taxa específica do ativo. Caso não encontre, ou caso o ativo não exija taxa
            diferenciada, ele utilizará a configuração "Global". O cálculo é efetuado 100% no
            servidor.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-background p-4 rounded-lg border shadow-sm">
        <Label className="text-base font-semibold whitespace-nowrap">Configurar Taxas para:</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-[300px] border-primary/50 focus:ring-primary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global" className="font-bold text-primary">
              Global (Padrão/Fallback)
            </SelectItem>
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" /> Parâmetros do Motor de Cálculo
          </CardTitle>
          <CardDescription>
            Defina as taxas que serão aplicadas nas operações do tipo{' '}
            <strong>{type.toUpperCase().replace('_', ' ')}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Juros e Deságio */}
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground/80 border-b pb-2">
                  1. Custo do Capital (Proporcional ao Prazo)
                </h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>Taxa de Deságio Mensal (TDM)</span>
                      <span className="text-xs text-muted-foreground">% ao mês</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={params.discount_rate_monthly}
                        onChange={(e) =>
                          setParams({ ...params, discount_rate_monthly: e.target.value })
                        }
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Aplicado sobre o Valor de Face.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>Taxa de Juros Mensal (TJM)</span>
                      <span className="text-xs text-muted-foreground">% ao mês</span>
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={params.interest_rate_monthly}
                        onChange={(e) =>
                          setParams({ ...params, interest_rate_monthly: e.target.value })
                        }
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Aplicado sobre o Valor Solicitado.
                    </p>
                  </div>
                </div>
              </div>

              {/* Taxas Fixas e Estruturais */}
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground/80 border-b pb-2">
                  2. Custos Operacionais e Risco
                </h3>
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Taxa Ad Valorem (TAV)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={params.ad_valorem_rate}
                        onChange={(e) => setParams({ ...params, ad_valorem_rate: e.target.value })}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Sobre o V. de Face.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Taxa Estruturação (TE)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={params.structuring_fee}
                        onChange={(e) => setParams({ ...params, structuring_fee: e.target.value })}
                      />
                      <Select
                        value={params.structuring_fee_type}
                        onValueChange={(v) => setParams({ ...params, structuring_fee_type: v })}
                      >
                        <SelectTrigger className="w-[100px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">R$ Fixo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Incide sobre o V. Solicitado.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Taxa de Análise (TA)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={params.analysis_fee}
                        onChange={(e) => setParams({ ...params, analysis_fee: e.target.value })}
                      />
                      <Select
                        value={params.analysis_fee_type}
                        onValueChange={(v) => setParams({ ...params, analysis_fee_type: v })}
                      >
                        <SelectTrigger className="w-[100px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">R$ Fixo</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">Custo de análise de crédito.</p>
                  </div>
                </div>
              </div>

              {/* Impostos */}
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground/80 border-b pb-2">
                  3. Tributação (IOF)
                </h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>IOF Fixo (%)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={params.iof_fixed_rate}
                      onChange={(e) => setParams({ ...params, iof_fixed_rate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Padrão: 0.38%</p>
                  </div>
                  <div className="space-y-2">
                    <Label>IOF Diário (%)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={params.iof_daily_rate}
                      onChange={(e) => setParams({ ...params, iof_daily_rate: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Padrão: 0.0041% ao dia</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-4 justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <History className="h-3.5 w-3.5" /> Última alteração:{' '}
            {params.updated_at ? new Date(params.updated_at).toLocaleString('pt-BR') : 'Nunca'}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            size="lg"
            className="gap-2 min-w-[150px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Parâmetros
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
