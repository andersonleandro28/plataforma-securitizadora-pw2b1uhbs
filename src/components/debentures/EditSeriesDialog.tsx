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
import { Loader2, Save, Edit2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { IndexerSelect } from './Selectors'

interface EditSeriesDialogProps {
  series: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditSeriesDialog({ series, open, onOpenChange, onSuccess }: EditSeriesDialogProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    series_number: '',
    volume: '',
    indexer: null as string | null,
    rate: '',
    maturity_date: '',
  })
  const [parentDebenture, setParentDebenture] = useState<any>(null)

  useEffect(() => {
    if (open && series) {
      setFormData({
        series_number: series.series_number || '',
        volume: String(series.volume || ''),
        indexer: series.indexer,
        rate: series.rate != null ? String(series.rate) : '',
        maturity_date: series.maturity_date ? series.maturity_date.split('T')[0] : '',
      })
    }
  }, [open, series])

  useEffect(() => {
    if (open && series?.debenture_id) {
      let mounted = true
      const fetchParent = async () => {
        const { data } = await supabase
          .from('debentures')
          .select('id, issuer_name, total_volume, series:debenture_series(id, volume)')
          .eq('id', series.debenture_id)
          .single()
        if (mounted && data) setParentDebenture(data)
      }
      fetchParent()
      return () => {
        mounted = false
      }
    } else {
      setParentDebenture(null)
    }
  }, [open, series?.debenture_id])

  const otherSeriesVolume =
    parentDebenture?.series
      ?.filter((s: any) => s.id !== series?.id)
      .reduce((acc: number, s: any) => acc + Number(s.volume || 0), 0) || 0

  const availableVolume = parentDebenture
    ? Number(parentDebenture.total_volume) - otherSeriesVolume
    : 0

  const isVolumeExceeded = Number(formData.volume || 0) > availableVolume

  const hasYieldImpact =
    Number(formData.rate) !== Number(series?.rate) ||
    (formData.maturity_date || '') !==
      (series?.maturity_date ? series.maturity_date.split('T')[0] : '')

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    if (!formData.series_number || !formData.volume || formData.rate === '') {
      toast.error('Número da Série, Volume e Taxa são obrigatórios.')
      return
    }

    if (isNaN(Number(formData.volume)) || isNaN(Number(formData.rate))) {
      toast.error('Volume e Taxa devem ser números válidos.')
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

      await supabase.from('audit_logs').insert({
        entity_type: 'debenture_series',
        entity_id: series.id,
        action: 'series_updated',
        user_id: user?.id,
        details: { message: 'Série atualizada.' },
      })

      toast.success('Série atualizada com sucesso.')
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

          {hasYieldImpact && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 font-bold">
                Atenção: Impacto no Rendimento
              </AlertTitle>
              <AlertDescription className="text-amber-700 mt-2 text-sm">
                As alterações na taxa ou vencimento afetarão os rendimentos projetados dos
                investidores atuais.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Indexador</Label>
              <IndexerSelect
                value={formData.indexer || null}
                onValueChange={(val) => setFormData({ ...formData, indexer: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Taxa (% a.a.)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 3.5"
                value={formData.rate ?? ''}
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
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
