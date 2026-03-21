import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, Edit2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface EditSeriesDialogProps {
  series: any
  debentures: any[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditSeriesDialog({
  series,
  debentures = [],
  open,
  onOpenChange,
  onSuccess,
}: EditSeriesDialogProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    series_number: '',
    volume: '',
    indexer: 'CDI',
    rate: '',
    maturity_date: '',
  })

  useEffect(() => {
    if (series && open) {
      setFormData({
        series_number: series.series_number || '',
        volume: String(series.volume || ''),
        indexer: series.indexer || 'CDI',
        rate: String(series.rate || ''),
        maturity_date: series.maturity_date ? series.maturity_date.split('T')[0] : '',
      })
    }
  }, [series, open])

  const parentDebenture = debentures.find((d) => d.id === series?.debenture_id)

  const otherSeriesVolume =
    parentDebenture?.series
      ?.filter((s: any) => s.id !== series?.id)
      .reduce((acc: number, s: any) => acc + Number(s.volume || 0), 0) || 0

  const availableVolume = parentDebenture
    ? Number(parentDebenture.total_volume) - otherSeriesVolume
    : 0

  const isVolumeExceeded = Number(formData.volume || 0) > availableVolume

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    if (!formData.series_number || !formData.volume) {
      toast.error('Número da Série e Volume são obrigatórios.')
      return
    }

    if (isVolumeExceeded) {
      toast.error('O volume da série excede o saldo disponível na escritura.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('debenture_series')
        .update({
          series_number: formData.series_number,
          volume: Number(formData.volume),
          indexer: formData.indexer,
          rate: Number(formData.rate) || 0,
          maturity_date: formData.maturity_date || null,
        })
        .eq('id', series.id)

      if (error) throw new Error(`Erro ao atualizar série: ${error.message}`)

      toast.success('Série atualizada com sucesso!')
      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao processar a edição da série.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" /> Editar Série
          </DialogTitle>
          <DialogDescription>
            Ajuste os dados cadastrais da série. O volume está sujeito ao limite total da escritura
            de <strong>{parentDebenture?.issuer_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {parentDebenture && (
            <div className="bg-muted/50 p-3 rounded-md text-sm border flex items-center justify-between">
              <span className="text-muted-foreground">Saldo disponível na escritura:</span>
              <span
                className={`font-mono font-medium ${isVolumeExceeded ? 'text-destructive' : 'text-primary'}`}
              >
                {formatCurrency(availableVolume)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Número da Série</Label>
              <Input
                placeholder="Ex: 002"
                value={formData.series_number}
                onChange={(e) => setFormData({ ...formData, series_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Volume (R$)</Label>
              <Input
                type="number"
                placeholder="0.00"
                className={`font-mono ${isVolumeExceeded ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                value={formData.volume}
                onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
              />
            </div>
          </div>
          {isVolumeExceeded && (
            <p className="text-xs text-destructive animate-in fade-in">
              O volume informado ({formatCurrency(Number(formData.volume))}) ultrapassa o saldo
              disponível.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Indexador</Label>
              <Select
                value={formData.indexer}
                onValueChange={(val) => setFormData({ ...formData, indexer: val })}
              >
                <SelectTrigger>
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
              <Label>Taxa (% a.a.)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 3.5"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data de Vencimento</Label>
            <Input
              type="date"
              value={formData.maturity_date}
              onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || isVolumeExceeded}
            className="min-w-[120px]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
