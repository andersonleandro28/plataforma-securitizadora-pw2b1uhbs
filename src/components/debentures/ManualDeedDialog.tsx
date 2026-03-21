import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, FileSignature, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ManualSeriesForm } from './ManualSeriesForm'

export interface SubscriptionData {
  investor_name: string
  document_number: string
  quantity: number
  unit_price: number
  subscription_date: string
}

export interface SeriesData {
  series_number: string
  volume: string
  indexer: string
  rate: string
  maturity_date: string
  subscriptions: SubscriptionData[]
}

export interface DeedData {
  issuer_name: string
  total_volume: string
  issue_date: string
  series: SeriesData[]
}

interface ManualDeedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const defaultSeries: SeriesData = {
  series_number: '001',
  volume: '',
  indexer: 'CDI',
  rate: '',
  maturity_date: '',
  subscriptions: [],
}

export function ManualDeedDialog({ open, onOpenChange, onSuccess }: ManualDeedDialogProps) {
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<DeedData>({
    issuer_name: '',
    total_volume: '',
    issue_date: new Date().toISOString().split('T')[0],
    series: [{ ...defaultSeries }],
  })

  const resetForm = () => {
    setData({
      issuer_name: '',
      total_volume: '',
      issue_date: new Date().toISOString().split('T')[0],
      series: [{ ...defaultSeries }],
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm()
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    if (!data.issuer_name || !data.total_volume) {
      toast.error('Emissor e Volume Total são obrigatórios.')
      return
    }

    setSaving(true)
    try {
      const { data: debData, error: debErr } = await supabase
        .from('debentures')
        .insert({
          issuer_name: data.issuer_name,
          total_volume: Number(data.total_volume) || 0,
          issue_date: data.issue_date || null,
        })
        .select('id')
        .single()

      if (debErr) throw new Error(`Erro ao salvar debênture: ${debErr.message}`)

      for (const s of data.series) {
        if (!s.series_number || !s.volume) continue

        const { data: seriesData, error: seriesErr } = await supabase
          .from('debenture_series')
          .insert({
            debenture_id: debData.id,
            series_number: s.series_number,
            volume: Number(s.volume) || 0,
            indexer: s.indexer,
            rate: Number(s.rate) || 0,
            maturity_date: s.maturity_date || null,
          })
          .select('id')
          .single()

        if (seriesErr) throw new Error(`Erro ao salvar série: ${seriesErr.message}`)

        if (s.subscriptions.length > 0) {
          const subsToInsert = s.subscriptions.map((sub) => ({
            series_id: seriesData.id,
            investor_name: sub.investor_name || 'Investidor Não Identificado',
            document_number: sub.document_number,
            quantity: sub.quantity,
            unit_price: sub.unit_price,
            total_amount: sub.quantity * sub.unit_price,
            subscription_date: sub.subscription_date || null,
          }))

          const { error: subErr } = await supabase
            .from('debenture_subscriptions')
            .insert(subsToInsert)
          if (subErr) console.error('Erro ao salvar subscrições:', subErr)
        }
      }

      toast.success('Escritura e subscrições registradas com sucesso!')
      onSuccess?.()
      handleOpenChange(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao processar o cadastro manual.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b bg-muted/10">
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Cadastro Manual de Escritura
          </DialogTitle>
          <DialogDescription>
            Registre os dados da emissão, configure as séries e cadastre as subscrições diretamente
            no banco de dados (inserindo as datas reais de cada operação).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">1. Dados da Emissão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do Emissor</Label>
                <Input
                  placeholder="Ex: Securitizadora S.A."
                  value={data.issuer_name}
                  onChange={(e) => setData({ ...data, issuer_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Volume Total da Emissão (R$)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="font-mono"
                  value={data.total_volume}
                  onChange={(e) => setData({ ...data, total_volume: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Emissão (Oficial)</Label>
                <Input
                  type="date"
                  value={data.issue_date}
                  onChange={(e) => setData({ ...data, issue_date: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold">2. Séries e Subscrições</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() =>
                  setData({
                    ...data,
                    series: [
                      ...data.series,
                      {
                        ...defaultSeries,
                        series_number: String(data.series.length + 1).padStart(3, '0'),
                      },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Nova Série
              </Button>
            </div>

            <div className="space-y-4">
              {data.series.map((series, idx) => (
                <ManualSeriesForm
                  key={idx}
                  index={idx}
                  series={series}
                  onChange={(i, updatedSeries) => {
                    const newSeries = [...data.series]
                    newSeries[i] = updatedSeries
                    setData({ ...data, series: newSeries })
                  }}
                  onRemove={(i) => {
                    if (data.series.length === 1)
                      return toast.error('A emissão precisa ter pelo menos uma série.')
                    setData({ ...data, series: data.series.filter((_, sIdx) => sIdx !== i) })
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <DialogFooter className="p-6 shrink-0 border-t bg-muted/10">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Gravando...' : 'Salvar Escritura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
