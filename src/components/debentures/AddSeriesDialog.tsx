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
import { Loader2, Save, PlusCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

interface AddSeriesDialogProps {
  debenture?: any
  debentures?: any[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddSeriesDialog({
  debenture,
  debentures = [],
  open,
  onOpenChange,
  onSuccess,
}: AddSeriesDialogProps) {
  const [saving, setSaving] = useState(false)
  const [selectedDebentureId, setSelectedDebentureId] = useState<string>('')
  const [formData, setFormData] = useState({
    series_number: '',
    volume: '',
    indexer: 'CDI',
    rate: '',
    maturity_date: '',
  })

  useEffect(() => {
    if (debenture) {
      setSelectedDebentureId(debenture.id)
    } else if (!open) {
      setSelectedDebentureId('')
    }
  }, [debenture, open])

  const resetForm = () => {
    setFormData({
      series_number: '',
      volume: '',
      indexer: 'CDI',
      rate: '',
      maturity_date: '',
    })
    if (!debenture) setSelectedDebentureId('')
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm()
    onOpenChange(isOpen)
  }

  const selectedDebentureObj = debenture || debentures.find((d) => d.id === selectedDebentureId)
  const totalAllocated =
    selectedDebentureObj?.series?.reduce((acc: number, s: any) => acc + Number(s.volume || 0), 0) ||
    0
  const availableVolume = selectedDebentureObj
    ? Number(selectedDebentureObj.total_volume) - totalAllocated
    : 0
  const isVolumeExceeded = Number(formData.volume || 0) > availableVolume

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleSave = async () => {
    if (!selectedDebentureId) {
      toast.error('Selecione a escritura/emissor.')
      return
    }
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
      const { error } = await supabase.from('debenture_series').insert({
        debenture_id: selectedDebentureId,
        series_number: formData.series_number,
        volume: Number(formData.volume),
        indexer: formData.indexer,
        rate: Number(formData.rate) || 0,
        maturity_date: formData.maturity_date || null,
      })

      if (error) throw new Error(`Erro ao salvar série: ${error.message}`)

      toast.success('Série adicionada com sucesso!')
      onSuccess?.()
      handleOpenChange(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao processar o cadastro da série.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" /> Nova Série
          </DialogTitle>
          <DialogDescription>
            {debenture ? (
              <>
                Adicionar uma nova série à escritura de <strong>{debenture.issuer_name}</strong>.
              </>
            ) : (
              'Cadastre uma nova série selecionando a escritura base correspondente.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!debenture && (
            <div className="space-y-1.5">
              <Label>Escritura / Emissor Base</Label>
              <Select value={selectedDebentureId} onValueChange={setSelectedDebentureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a emissão" />
                </SelectTrigger>
                <SelectContent>
                  {debentures.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.issuer_name} ({formatDate(d.created_at)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedDebentureObj && (
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
            disabled={saving || (!debenture && !selectedDebentureId) || isVolumeExceeded}
            className="min-w-[120px]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Série'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
