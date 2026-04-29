import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Calculator, Info, Lock, Unlock, Save, Loader2 } from 'lucide-react'

export default function FinancialParameters() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [annualLocked, setAnnualLocked] = useState(true)

  const [monthlyRate, setMonthlyRate] = useState('')
  const [annualRate, setAnnualRate] = useState('')
  const [fixedCost, setFixedCost] = useState('')
  const [iofFixed, setIofFixed] = useState('')
  const [iofDaily30, setIofDaily30] = useState('')
  const [iofDailyAfter, setIofDailyAfter] = useState('')
  
  const [simValue, setSimValue] = useState('10000')
  const [simTerm, setSimTerm] = useState('12')
  const [simInstallment, setSimInstallment] = useState(0)
  const [simCetMonthly, setSimCetMonthly] = useState(0)
  const [simCetAnnual, setSimCetAnnual] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('config_ccb').select('*').limit(1).maybeSingle()
    if (data) {
      setConfig(data)
      setMonthlyRate(data.interest_rate_monthly?.toString() || '0')
      setAnnualRate(data.interest_rate_annual?.toString() || '0')
      setFixedCost(data.fixed_emission_cost?.toString() || '0')
      setIofFixed(data.iof_rate?.toString() || '0.38')
      setIofDaily30(data.iof_daily_rate_30?.toString() || '0.0041')
      setIofDailyAfter(data.iof_daily_rate_after?.toString() || '0.00274')
    } else {
      setConfig({ id: crypto.randomUUID() })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (annualLocked && monthlyRate !== '') {
      const iMensal = Number(monthlyRate) / 100
      if (!isNaN(iMensal)) {
        const iAnual = (Math.pow(1 + iMensal, 12) - 1) * 100
        setAnnualRate(iAnual.toFixed(4))
      }
    }
  }, [monthlyRate, annualLocked])

  useEffect(() => {
    const pv = Number(simValue)
    const n = Number(simTerm)
    const rate = Number(monthlyRate) / 100
    const fee = Number(fixedCost)
    const iofFixRate = Number(iofFixed) / 100
    const iofD30 = Number(iofDaily30) / 100
    const iofDAfter = Number(iofDailyAfter) / 100

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
        const d30 = Math.min(days, 30)
        const dAfter = Math.max(0, days - 30)
        totalIofDiario += amortizacao * (d30 * iofD30 + dAfter * iofDAfter)
        saldo -= amortizacao
      }

      const totalDiscounts = iofFixoVal + totalIofDiario + fee
      const pmtFinal = pmt + (totalDiscounts / n)

      setSimInstallment(pmtFinal)
      
      let low = 0.0, high = 1.0, cetM = 0.0
      for (let i = 0; i < 50; i++) {
        cetM = (low + high) / 2
        const calcPv = (pmtFinal * (1 - Math.pow(1 + cetM, -n))) / cetM
        if (calcPv > pv) low = cetM
        else high = cetM
      }
      
      setSimCetMonthly(cetM * 100)
      setSimCetAnnual((Math.pow(1 + cetM, 12) - 1) * 100)
    }
  }, [simValue, simTerm, monthlyRate, fixedCost, iofFixed, iofDaily30, iofDailyAfter])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('config_ccb').upsert({
        id: config.id,
        interest_rate_monthly: Number(monthlyRate),
        interest_rate_annual: Number(annualRate),
        fixed_emission_cost: Number(fixedCost),
        iof_rate: Number(iofFixed),
        iof_daily_rate_30: Number(iofDaily30),
        iof_daily_rate_after: Number(iofDailyAfter),
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      
      if (error) throw error
      toast.success('Parâmetros salvos com sucesso.')
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      <div>
        <h1 className="text-3xl font-bold">Configuração de CCB</h1>
        <p className="text-muted-foreground">Gerencie as taxas de juros, custos de emissão e impostos globais.</p>
      </div>

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
                Taxas calculadas via Juros Compostos (Equivalência Bancária). O bloqueio de edição anual garante a precisão exigida pelo Banco Central.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Taxa de Juros Mensal (% a.m.)</Label>
              <Input type="number" step="0.0001" value={monthlyRate} onChange={e => setMonthlyRate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <Label>Taxa Anual Equivalente (% a.a.)</Label>
                <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => setAnnualLocked(!annualLocked)}>
                  {annualLocked ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                  {annualLocked ? 'Desbloquear' : 'Bloquear'}
                </Button>
              </div>
              <Input 
                type="number" step="0.0001" 
                value={annualRate} 
                onChange={e => setAnnualRate(e.target.value)} 
                disabled={annualLocked} 
                className={annualLocked ? 'bg-muted' : ''}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custos e Impostos (IOF)</CardTitle>
            <CardDescription>Custo Fixo e parâmetros do Decreto 6.306/07</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tarifa de Emissão / Custo Fixo (R$)</Label>
              <Input type="number" step="0.01" value={fixedCost} onChange={e => setFixedCost(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>IOF Fixo (%)</Label>
                <Input type="number" step="0.0001" value={iofFixed} onChange={e => setIofFixed(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IOF Diário (até 30d)</Label>
                <Input type="number" step="0.00001" value={iofDaily30} onChange={e => setIofDaily30(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>IOF Diário (>30d)</Label>
                <Input type="number" step="0.00001" value={iofDailyAfter} onChange={e => setIofDailyAfter(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 bg-slate-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Simulação de Custo Efetivo Total (CET)</CardTitle>
            <CardDescription>O CET considera os juros compostos, tarifas e IOF, igualando o fluxo de parcelas ao valor financiado (VPL).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6 items-center">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Valor Solicitado (R$)</Label>
                  <Input type="number" value={simValue} onChange={e => setSimValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prazo (Meses)</Label>
                  <Input type="number" value={simTerm} onChange={e => setSimTerm(e.target.value)} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border shadow-sm col-span-3 grid grid-cols-3 gap-4 text-center">
                <div className="border-r border-dashed">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Valor da Parcela</div>
                  <div className="font-bold text-primary text-2xl">R$ {simInstallment.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
                <div className="border-r border-dashed">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CET Mensal</div>
                  <div className="font-bold text-rose-600 text-2xl">{simCetMonthly.toFixed(4)}%</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CET Anual</div>
                  <div className="font-bold text-rose-600 text-2xl">{simCetAnnual.toFixed(4)}%</div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-slate-200/60 pt-4 mt-4 bg-white/50 rounded-b-xl">
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Parâmetros
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
