import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, Users } from 'lucide-react'
import type { SeriesData, SubscriptionData } from './ManualDeedDialog'

interface Props {
  series: SeriesData
  index: number
  onChange: (index: number, data: SeriesData) => void
  onRemove: (index: number) => void
}

export function ManualSeriesForm({ series, index, onChange, onRemove }: Props) {
  const updateField = (field: keyof SeriesData, value: any) => {
    onChange(index, { ...series, [field]: value })
  }

  const addSubscription = () => {
    const newSub: SubscriptionData = {
      investor_name: '',
      document_number: '',
      quantity: 1,
      unit_price: 1000,
      subscription_date: new Date().toISOString().split('T')[0],
    }
    onChange(index, { ...series, subscriptions: [...series.subscriptions, newSub] })
  }

  const updateSub = (subIdx: number, field: keyof SubscriptionData, value: any) => {
    const newSubs = [...series.subscriptions]
    newSubs[subIdx] = { ...newSubs[subIdx], [field]: value }
    onChange(index, { ...series, subscriptions: newSubs })
  }

  const removeSub = (subIdx: number) => {
    const newSubs = series.subscriptions.filter((_, i) => i !== subIdx)
    onChange(index, { ...series, subscriptions: newSubs })
  }

  return (
    <Card className="border-border/50 shadow-sm relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">Série {index + 1}</CardTitle>
        <CardDescription>
          Detalhes financeiros e subscrições vinculadas a esta série.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Número da Série</Label>
            <Input
              className="h-9"
              value={series.series_number}
              onChange={(e) => updateField('series_number', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Volume (R$)</Label>
            <Input
              type="number"
              className="h-9 font-mono"
              value={series.volume}
              onChange={(e) => updateField('volume', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Indexador</Label>
            <Select value={series.indexer} onValueChange={(v) => updateField('indexer', v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CDI">CDI</SelectItem>
                <SelectItem value="IPCA">IPCA</SelectItem>
                <SelectItem value="IGP-M">IGP-M</SelectItem>
                <SelectItem value="Pré-fixado">Pré-fixado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Taxa (% a.a.)</Label>
            <Input
              type="number"
              className="h-9"
              step="0.01"
              value={series.rate}
              onChange={(e) => updateField('rate', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Data de Vencimento</Label>
            <Input
              type="date"
              className="h-9"
              value={series.maturity_date}
              onChange={(e) => updateField('maturity_date', e.target.value)}
            />
          </div>
        </div>

        <div className="bg-muted/30 p-4 rounded-md border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Subscrições da Série
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={addSubscription}
              className="h-8 text-xs gap-1 bg-background"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Subscritor
            </Button>
          </div>

          {series.subscriptions.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              Nenhuma subscrição registrada para esta série.
            </div>
          ) : (
            <div className="space-y-3">
              {series.subscriptions.map((sub, sIdx) => (
                <div
                  key={sIdx}
                  className="grid grid-cols-12 gap-3 items-end bg-background p-3 rounded border"
                >
                  <div className="col-span-12 md:col-span-3 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Investidor
                    </Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Nome Completo"
                      value={sub.investor_name}
                      onChange={(e) => updateSub(sIdx, 'investor_name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">CPF/CNPJ</Label>
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="000.000.000-00"
                      value={sub.document_number}
                      onChange={(e) => updateSub(sIdx, 'document_number', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 md:col-span-1 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Qtd.</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={sub.quantity || ''}
                      onChange={(e) => updateSub(sIdx, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-8 md:col-span-2 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">PU (R$)</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs font-mono"
                      value={sub.unit_price || ''}
                      onChange={(e) => updateSub(sIdx, 'unit_price', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-9 md:col-span-3 space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Data Subs.
                    </Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={sub.subscription_date || ''}
                      onChange={(e) => updateSub(sIdx, 'subscription_date', e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSub(sIdx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
