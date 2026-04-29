import { useEffect, useState } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Calculator, Info, Lock, Unlock, Save, Loader2 } from 'lucide-react'

export function CcbParametersForm() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [annualLocked, setAnnualLocked] = useState(true)

  const [rates, setRates] = useState({
    monthly: '0',
    annual: '0',
    fixed: '0',
    iofFixed: '0.38',
    iof30: '0.0041',
    iofAfter: '0.00274',
  })

  const [sim, setSim] = useState({
    value: '10000',
    term: '12',
    installment: 0,
    cetMonthly: 0,
    cetAnnual: 0,
  })

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('config_ccb').select('*').limit(1).maybeSingle()
    if (data) {
      setConfig(data)
      setRates({
        monthly: data.interest_rate_monthly?.toString() || '0',
        annual: data.interest_rate_annual?.toString() || '0',
        fixed: data.fixed_emission_cost?.toString() || '0',
        iofFixed: data.iof_rate?.toString() || '0.38',
        iof30: data.iof_daily_rate_30?.toString() || '0.0041',
        iofAfter: data.iof_daily_rate_after?.toString() || '0.00274',
      })
    } else {
      setConfig({ id: crypto.randomUUID() })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (annualLocked && rates.monthly !== '') {
      const iMensal = Number(rates.monthly) / 100
      if (!isNaN(iMensal)) {
        const iAnual = (Math.pow(1 + iMensal, 12) - 1) * 100
        setRates((r) => ({ ...r, annual: iAnual.toFixed(4) }))
      }
    }
  }, [rates.monthly, annualLocked])

  useEffect(() => {
    const pv = Number(sim.value)
    const n = Number(sim.term)
    const rate = Number(rates.monthly) / 100
    const fee = Number(rates.fixed)
    const iofFixRate = Number(rates.iofFixed) / 100
    const iofD30 = Number(rates.iof30) / 100
    const iofDAfter = Number(rates.iofAfter) / 100

    if (pv > 0 && n > 0) {
      let pmt = pv / n
      if (rate > 0) pmt = (pv * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)

      const iofFixoVal = pv * iofFixRate
      let saldo = pv
      let totalIofDiario = 0

      for (let i = 1; i <= n; i++) {
        const juros = saldo * rate
        const amortizacao = pmt - juros
        const days = i * 30
        totalIofDiario +=
          amortizacao * (Math.min(days, 30) * iofD30 + Math.max(0, days - 30) * iofDAfter)
        saldo -= amortizacao
      }

      const pmtFinal = pmt + (iofFixoVal + totalIofDiario + fee) / n
      let low = 0.0,
        high = 1.0,
        cetM = 0.0
      for (let i = 0; i < 50; i++) {
        cetM = (low + high) / 2
        const calcPv = (pmtFinal * (1 - Math.pow(1 + cetM, -n))) / cetM
        if (calcPv > pv) low = cetM
        else high = cetM
      }

      setSim((s) => ({
        ...s,
        installment: pmtFinal,
        cetMonthly: cetM * 100,
        cetAnnual: (Math.pow(1 + cetM, 12) - 1) * 100,
      }))
    }
  }, [sim.value, sim.term, rates])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('config_ccb').upsert(
        {
          id: config.id,
          interest_rate_monthly: Number(rates.monthly),
          interest_rate_annual: Number(rates.annual),
          fixed_emission_cost: Number(rates.fixed),
          iof_rate: Number(rates.iofFixed),
          iof_daily_rate_30: Number(rates.iof30),
          iof_daily_rate_after: Number(rates.iofAfter),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (error) throw error
      toast.success('Parâmetros salvos com sucesso.')
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle>Taxas de Juros Base</CardTitle>
          <CardDescription>Configure a taxa nominal da CCB Digital</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50/50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-xs">
              Taxas calculadas via Juros Compostos.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Taxa Mensal (% a.m.)</Label>
            <Input
              type="number"
              step="0.0001"
              value={rates.monthly}
              onChange={(e) => setRates({ ...rates, monthly: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
              <Label>Taxa Anual (% a.a.)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => setAnnualLocked(!annualLocked)}
              >
                {annualLocked ? (
                  <Lock className="h-3 w-3 mr-1" />
                ) : (
                  <Unlock className="h-3 w-3 mr-1" />
                )}
                {annualLocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
            </div>
            <Input
              type="number"
              step="0.0001"
              value={rates.annual}
              onChange={(e) => setRates({ ...rates, annual: e.target.value })}
              disabled={annualLocked}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Custos e Impostos</CardTitle>
          <CardDescription>Custo Fixo e parâmetros de IOF</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tarifa de Emissão (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={rates.fixed}
              onChange={(e) => setRates({ ...rates, fixed: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>IOF Fixo (%)</Label>
              <Input
                type="number"
                step="0.0001"
                value={rates.iofFixed}
                onChange={(e) => setRates({ ...rates, iofFixed: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>IOF Diário (até 30d)</Label>
              <Input
                type="number"
                step="0.00001"
                value={rates.iof30}
                onChange={(e) => setRates({ ...rates, iof30: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>IOF Diário (&gt;30d)</Label>
              <Input
                type="number"
                step="0.00001"
                value={rates.iofAfter}
                onChange={(e) => setRates({ ...rates, iofAfter: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> CET
          </CardTitle>
          <CardDescription>
            Custo Efetivo Total simulado considerando juros, tarifas e impostos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-6 items-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor Solicitado</Label>
                <Input
                  type="number"
                  value={sim.value}
                  onChange={(e) => setSim({ ...sim, value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo (Meses)</Label>
                <Input
                  type="number"
                  value={sim.term}
                  onChange={(e) => setSim({ ...sim, term: e.target.value })}
                />
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm col-span-3 grid grid-cols-3 gap-4 text-center">
              <div className="border-r border-dashed">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Parcela
                </div>
                <div className="font-bold text-primary text-2xl">
                  R${' '}
                  {sim.installment.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="border-r border-dashed">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  CET Mensal
                </div>
                <div className="font-bold text-rose-600 text-2xl">{sim.cetMonthly.toFixed(4)}%</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  CET Anual
                </div>
                <div className="font-bold text-rose-600 text-2xl">{sim.cetAnnual.toFixed(4)}%</div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-slate-200/60 pt-4 mt-4 bg-white/50 rounded-b-xl">
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{' '}
            Salvar Parâmetros CCB
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
