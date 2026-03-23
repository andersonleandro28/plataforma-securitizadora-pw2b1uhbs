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
import { Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ProductForm } from './ProductForm'

export function ProductDialog({ open, onOpenChange, product, onSuccess }: any) {
  const [saving, setSaving] = useState(false)
  const [seriesList, setSeriesList] = useState<any[]>([])
  const [data, setData] = useState<any>({})

  useEffect(() => {
    if (open) {
      fetchSeries()
      if (product) {
        setData({ ...product })
      } else {
        setData({
          title: '',
          rating: 'Risco Médio',
          currency: 'BRL',
          status: 'Em Captação',
          type: 'Debênture',
          global_quotas: 1000,
          quota_value: 1000,
          min_quotas_per_investor: 1,
          max_quotas_per_investor: 100,
          sold_quotas: 0,
          is_active: true,
          is_highlighted: false,
          is_archived: false,
        })
      }
    }
  }, [open, product])

  const fetchSeries = async () => {
    const { data: s } = await supabase.from('debenture_series').select('id, series_number, indexer')
    if (s) setSeriesList(s)
  }

  const handleSave = async () => {
    if (!data.title) return toast.error('O nome do produto é obrigatório.')
    if (data.min_quotas_per_investor > data.max_quotas_per_investor) {
      return toast.error('A quantidade mínima de cotas não pode ser maior que a máxima.')
    }
    if (data.max_quotas_per_investor > data.global_quotas) {
      return toast.error('A quantidade máxima por investidor não pode superar a global.')
    }

    setSaving(true)
    try {
      const payload = { ...data, updated_at: new Date().toISOString() }
      let error

      if (data.id) {
        const res = await supabase.from('investment_products').update(payload).eq('id', data.id)
        error = res.error
      } else {
        const res = await supabase.from('investment_products').insert(payload)
        error = res.error
      }

      if (error) throw error
      toast.success('Produto salvo com sucesso!')
      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: any) =>
    setData((prev: any) => ({ ...prev, [field]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b bg-muted/10">
          <DialogTitle>{data.id ? 'Editar Produto' : 'Novo Produto de Investimento'}</DialogTitle>
          <DialogDescription>
            Configure as regras de emissão, cotas e visualização da vitrine do investidor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <ProductForm data={data} onChange={handleChange} seriesList={seriesList} />
        </div>

        <DialogFooter className="p-6 shrink-0 border-t bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
