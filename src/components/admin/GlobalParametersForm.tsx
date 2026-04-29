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
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'

export function GlobalParametersForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [params, setParams] = useState<any>(null)

  const [rates, setRates] = useState({
    discount: '0',
    adValorem: '0',
    structuring: '0',
    analysis: '0',
    iofFixed: '0',
    iofDaily: '0',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('financial_parameters')
      .select('*')
      .eq('receivable_type', 'global')
      .maybeSingle()

    if (data) {
      setParams(data)
      setRates({
        discount: data.discount_rate_monthly?.toString() || '0',
        adValorem: data.ad_valorem_rate?.toString() || '0',
        structuring: data.structuring_fee?.toString() || '0',
        analysis: data.analysis_fee?.toString() || '0',
        iofFixed: data.iof_fixed_rate?.toString() || '0',
        iofDaily: data.iof_daily_rate?.toString() || '0',
      })
    } else {
      setParams({ id: crypto.randomUUID(), receivable_type: 'global' })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('financial_parameters').upsert(
        {
          id: params.id,
          receivable_type: 'global',
          discount_rate_monthly: Number(rates.discount),
          ad_valorem_rate: Number(rates.adValorem),
          structuring_fee: Number(rates.structuring),
          analysis_fee: Number(rates.analysis),
          iof_fixed_rate: Number(rates.iofFixed),
          iof_daily_rate: Number(rates.iofDaily),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'receivable_type' },
      )
      if (error) throw error
      toast.success('Parâmetros globais salvos com sucesso.')
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
    <Card>
      <CardHeader>
        <CardTitle>Taxas e Descontos (Geral)</CardTitle>
        <CardDescription>
          Configurações para antecipações, aquisições de recebíveis e demais operações financeiras.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label>Taxa de Desconto Mensal (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={rates.discount}
            onChange={(e) => setRates({ ...rates, discount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Taxa Ad Valorem (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={rates.adValorem}
            onChange={(e) => setRates({ ...rates, adValorem: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Tarifa de Estruturação (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={rates.structuring}
            onChange={(e) => setRates({ ...rates, structuring: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Tarifa de Análise (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={rates.analysis}
            onChange={(e) => setRates({ ...rates, analysis: e.target.value })}
          />
        </div>
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
          <Label>IOF Diário (%)</Label>
          <Input
            type="number"
            step="0.00001"
            value={rates.iofDaily}
            onChange={(e) => setRates({ ...rates, iofDaily: e.target.value })}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t border-slate-100 pt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2 px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{' '}
          Salvar Parâmetros Gerais
        </Button>
      </CardFooter>
    </Card>
  )
}
