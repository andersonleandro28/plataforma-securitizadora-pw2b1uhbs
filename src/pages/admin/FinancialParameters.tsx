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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { Loader2, Save, Settings2, History, Info, Banknote } from 'lucide-react'

export default function FinancialParameters() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<string>('global')
  const [params, setParams] = useState<any>({})
  const [ccbConfig, setCcbConfig] = useState<any>({})

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

  const defaultCcbConfig = {
    partner_name: 'BDIGITAL',
    interest_rate_monthly: 2.5,
    interest_rate_annual: 34.49,
    iof_rate: 0.38,
    irrf_rate: 1.5,
    multiplier_factor: 1.0,
    max_term_months: 36,
  }

  const fetchData = async () => {
    setLoading(true)

    // Fetch Motor Params
    const { data } = await supabase
      .from('financial_parameters')
      .select('*')
      .eq('receivable_type', type)
      .maybeSingle()
    if (data) {
      setParams(data)
    } else {
      const { data: globalData } = await supabase
        .from('financial_parameters')
        .select('*')
        .eq('receivable_type', 'global')
        .maybeSingle()
      setParams({ ...(globalData || defaultParams), id: undefined, receivable_type: type })
    }

    // Fetch CCB Config
    const { data: ccbData } = await supabase.from('config_ccb').select('*').maybeSingle()
    if (ccbData) {
      setCcbConfig(ccbData)
    } else {
      setCcbConfig(defaultCcbConfig)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [type])

  const handleSaveParams = async () => {
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
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar parâmetros.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCcb = async () => {
    setSaving(true)
    try {
      const payload = {
        partner_name: ccbConfig.partner_name,
        interest_rate_monthly: Number(ccbConfig.interest_rate_monthly),
        interest_rate_annual: Number(ccbConfig.interest_rate_annual),
        iof_rate: Number(ccbConfig.iof_rate),
        irrf_rate: Number(ccbConfig.irrf_rate),
        multiplier_factor: Number(ccbConfig.multiplier_factor),
        max_term_months: Number(ccbConfig.max_term_months),
        updated_at: new Date().toISOString(),
      }

      if (ccbConfig.id) {
        const { error } = await supabase.from('config_ccb').update(payload).eq('id', ccbConfig.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('config_ccb').insert(payload)
        if (error) throw error
      }

      toast.success('Configurações CCB atualizadas com sucesso.')
      fetchData()
    } catch (err: any) {
      toast.error('Erro ao salvar configurações CCB: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações Financeiras</h1>
        <p className="text-muted-foreground">
          Gerencie as taxas do motor de antecipação e as regras para emissão de CCB (BDIGITAL).
        </p>
      </div>

      <Tabs defaultValue="motor" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="motor" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Motor de Antecipação
          </TabsTrigger>
          <TabsTrigger value="ccb" className="flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Configurações CCB
          </TabsTrigger>
        </TabsList>

        <TabsContent value="motor" className="space-y-6">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong>Hierarquia de Cálculo:</strong> O motor busca primeiro a taxa específica do
                ativo. Caso não encontre, utiliza a "Global".
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-background p-4 rounded-lg border shadow-sm">
            <Label className="text-base font-semibold whitespace-nowrap">
              Configurar Taxas para:
            </Label>
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
                Parâmetros do Motor de Cálculo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground/80 border-b pb-2">
                  1. Custo do Capital
                </h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Taxa de Deságio Mensal (TDM)</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Taxa de Juros Mensal (TJM)</Label>
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
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground/80 border-b pb-2">
                  2. Custos Operacionais
                </h3>
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Taxa Ad Valorem (TAV)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={params.ad_valorem_rate}
                      onChange={(e) => setParams({ ...params, ad_valorem_rate: e.target.value })}
                    />
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
                  </div>
                </div>
              </div>
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
                  </div>
                  <div className="space-y-2">
                    <Label>IOF Diário (%)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={params.iof_daily_rate}
                      onChange={(e) => setParams({ ...params, iof_daily_rate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t py-4 justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <History className="h-3.5 w-3.5" /> Última alteração:{' '}
                {params.updated_at ? new Date(params.updated_at).toLocaleString('pt-BR') : 'Nunca'}
              </div>
              <Button
                onClick={handleSaveParams}
                disabled={saving || loading}
                size="lg"
                className="gap-2 min-w-[150px]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}{' '}
                Salvar Parâmetros
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="ccb" className="space-y-6">
          <Card className="shadow-sm border-t-4 border-t-[#00C2E0]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Simulador de CCB (BDIGITAL)</CardTitle>
              <CardDescription>
                Defina as taxas que serão aplicadas para as simulações e emissões de Cédula de
                Crédito Bancário na área do Tomador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Taxa de Juros Mensal (% a.m.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ccbConfig.interest_rate_monthly}
                    onChange={(e) =>
                      setCcbConfig({ ...ccbConfig, interest_rate_monthly: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxa de Juros Anual (% a.a.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ccbConfig.interest_rate_annual}
                    onChange={(e) =>
                      setCcbConfig({ ...ccbConfig, interest_rate_annual: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prazo Máximo (Meses)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={ccbConfig.max_term_months}
                    onChange={(e) =>
                      setCcbConfig({ ...ccbConfig, max_term_months: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>IOF Base (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ccbConfig.iof_rate}
                    onChange={(e) => setCcbConfig({ ...ccbConfig, iof_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IRRF Base (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ccbConfig.irrf_rate}
                    onChange={(e) => setCcbConfig({ ...ccbConfig, irrf_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fator Multiplicador</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ccbConfig.multiplier_factor}
                    onChange={(e) =>
                      setCcbConfig({ ...ccbConfig, multiplier_factor: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t py-4 justify-between">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <History className="h-3.5 w-3.5" /> Atualizado em:{' '}
                {ccbConfig.updated_at
                  ? new Date(ccbConfig.updated_at).toLocaleString('pt-BR')
                  : 'Nunca'}
              </div>
              <Button
                onClick={handleSaveCcb}
                disabled={saving || loading}
                size="lg"
                className="gap-2 min-w-[150px] bg-[#00C2E0] hover:bg-[#00a9c4]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}{' '}
                Salvar Configurações CCB
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
