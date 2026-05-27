import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: any
  onSuccess: () => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const [series, setSeries] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])

  const [loadingSeries, setLoadingSeries] = useState(false)
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [loadingRatings, setLoadingRatings] = useState(false)
  const [loadingCurrencies, setLoadingCurrencies] = useState(false)

  const [formData, setFormData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (product) {
        setFormData({ ...product })
      } else {
        setFormData({
          title: '',
          type: 'Debênture',
          rate: '',
          term: '',
          min_investment: 1000,
          risk: 'Médio',
          rating: '',
          status: '',
          series_id: '',
          currency: 'BRL',
          global_quotas: 1000,
          quota_value: 1000,
          is_active: true,
          is_highlighted: false,
          description: '',
          target_audience: '',
          manager: '',
          management_policy: '',
          redemption_rules: '',
          ir_rules: '',
        })
      }
      fetchDropdownData()
    }
  }, [open, product])

  const fetchDropdownData = async () => {
    // Série
    setLoadingSeries(true)
    console.log('Buscando dados para o seletor: Série')
    try {
      const { data, error } = await supabase.from('debenture_series').select('id, series_number')
      if (error) throw error
      setSeries(data || [])
      console.log('Dados carregados com sucesso: Série')
    } catch (e: any) {
      console.error('ERRO CRÍTICO no seletor Série:', e.message)
      toast.error('Erro ao carregar opções de Série')
    } finally {
      setLoadingSeries(false)
    }

    // Status
    setLoadingStatuses(true)
    console.log('Buscando dados para o seletor: Status')
    try {
      const { data, error } = await supabase.from('product_statuses').select('label')
      if (error) throw error
      setStatuses(data || [])
      console.log('Dados carregados com sucesso: Status')
    } catch (e: any) {
      console.error('ERRO CRÍTICO no seletor Status:', e.message)
      toast.error('Erro ao carregar opções de Status')
    } finally {
      setLoadingStatuses(false)
    }

    // Rating de Risco
    setLoadingRatings(true)
    console.log('Buscando dados para o seletor: Rating de Risco')
    try {
      const { data, error } = await supabase.from('product_risk_ratings').select('label')
      if (error) throw error
      setRatings(data || [])
      console.log('Dados carregados com sucesso: Rating de Risco')
    } catch (e: any) {
      console.error('ERRO CRÍTICO no seletor Rating de Risco:', e.message)
      toast.error('Erro ao carregar opções de Rating de Risco')
    } finally {
      setLoadingRatings(false)
    }

    // Moeda
    setLoadingCurrencies(true)
    console.log('Buscando dados para o seletor: Moeda')
    try {
      const { data, error } = await supabase.from('product_currencies').select('code, label')
      if (error) throw error
      setCurrencies(data || [])
      console.log('Dados carregados com sucesso: Moeda')
    } catch (e: any) {
      console.error('ERRO CRÍTICO no seletor Moeda:', e.message)
      toast.error('Erro ao carregar opções de Moeda')
    } finally {
      setLoadingCurrencies(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...formData }
      if (payload.series_id === '') payload.series_id = null

      if (product?.id) {
        const { error } = await supabase
          .from('investment_products')
          .update(payload)
          .eq('id', product.id)
        if (error) throw error
        toast.success('Produto atualizado com sucesso!')
      } else {
        const { error } = await supabase.from('investment_products').insert([payload])
        if (error) throw error
        toast.success('Produto criado com sucesso!')
      }
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar produto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
            <TabsTrigger value="details">Detalhes e Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Título do Produto</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Debênture XPTO"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Tipo de Produto</Label>
                <Select
                  value={formData.type || ''}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debênture">Debênture</SelectItem>
                    <SelectItem value="CRI">CRI</SelectItem>
                    <SelectItem value="CRA">CRA</SelectItem>
                    <SelectItem value="FIDC">FIDC</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Série</Label>
                <Select
                  value={formData.series_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, series_id: v })}
                  disabled={loadingSeries}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingSeries ? 'Carregando...' : 'Selecione uma série'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {series.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Nenhuma opção cadastrada no banco
                      </SelectItem>
                    ) : (
                      series.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.series_number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || ''}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                  disabled={loadingStatuses}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingStatuses ? 'Carregando...' : 'Selecione o status'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Nenhuma opção cadastrada no banco
                      </SelectItem>
                    ) : (
                      statuses.map((s) => (
                        <SelectItem key={s.label} value={s.label}>
                          {s.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rating de Risco</Label>
                <Select
                  value={formData.rating || ''}
                  onValueChange={(v) => setFormData({ ...formData, rating: v, risk: v })}
                  disabled={loadingRatings}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingRatings ? 'Carregando...' : 'Selecione o rating'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ratings.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Nenhuma opção cadastrada no banco
                      </SelectItem>
                    ) : (
                      ratings.map((r) => (
                        <SelectItem key={r.label} value={r.label}>
                          {r.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select
                  value={formData.currency || ''}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                  disabled={loadingCurrencies}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingCurrencies ? 'Carregando...' : 'Selecione a moeda'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Nenhuma opção cadastrada no banco
                      </SelectItem>
                    ) : (
                      currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label} ({c.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Taxa / Rentabilidade</Label>
                <Input
                  value={formData.rate || ''}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="Ex: CDI + 2%"
                />
              </div>

              <div className="space-y-2">
                <Label>Prazo (Termo)</Label>
                <Input
                  value={formData.term || ''}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  placeholder="Ex: 24 meses"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Investimento Mínimo (R$)</Label>
                <Input
                  type="number"
                  value={formData.min_investment || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, min_investment: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Valor da Cota (R$)</Label>
                <Input
                  type="number"
                  value={formData.quota_value || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, quota_value: parseFloat(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Total de Cotas (Global)</Label>
                <Input
                  type="number"
                  value={formData.global_quotas || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, global_quotas: parseInt(e.target.value, 10) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Público Alvo</Label>
                <Input
                  value={formData.target_audience || ''}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Ex: Investidor Qualificado"
                />
              </div>

              <div className="space-y-2">
                <Label>Gestor</Label>
                <Input
                  value={formData.manager || ''}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  placeholder="Ex: Gestão Interna"
                />
              </div>

              <div className="space-y-2">
                <Label>Política de Gestão</Label>
                <Textarea
                  value={formData.management_policy || ''}
                  onChange={(e) => setFormData({ ...formData, management_policy: e.target.value })}
                  placeholder="Ex: Foco em crédito privado..."
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Regras de Resgate</Label>
                <Textarea
                  value={formData.redemption_rules || ''}
                  onChange={(e) => setFormData({ ...formData, redemption_rules: e.target.value })}
                  placeholder="Ex: Resgate apenas no vencimento"
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Regras de Tributação (IR)</Label>
                <Textarea
                  value={formData.ir_rules || ''}
                  onChange={(e) => setFormData({ ...formData, ir_rules: e.target.value })}
                  placeholder="Ex: Tabela regressiva de IR"
                  rows={3}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição Comercial</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  checked={formData.is_active || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  id="is-active"
                />
                <Label htmlFor="is-active">Produto Ativo (Visível na vitrine)</Label>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  checked={formData.is_highlighted || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_highlighted: v })}
                  id="is-highlighted"
                />
                <Label htmlFor="is-highlighted">Destacar na Vitrine</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
