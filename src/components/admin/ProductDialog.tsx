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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Trash2, Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: any
  onSuccess: () => void
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const { profile, loading: authLoading, isLoadingProfile } = useAuth()
  const isAdminOrStaff =
    !!profile && (profile.role === 'admin' || profile.role === 'staff' || !!profile.is_admin)

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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [togglingArchive, setTogglingArchive] = useState(false)

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
          allow_early_redemption: false,
          early_redemption_penalty_pct: 0,
          early_redemption_discount_pct: 0,
          min_grace_period_months: 0,
          is_archived: false,
        })
      }
      fetchDropdownData()
    }
  }, [open, product])

  const fetchDropdownData = async () => {
    setLoadingSeries(true)
    try {
      const { data, error } = await supabase.from('debenture_series').select('id, series_number')
      if (!error) setSeries(data || [])
    } finally {
      setLoadingSeries(false)
    }

    setLoadingStatuses(true)
    try {
      const { data, error } = await supabase.from('product_statuses').select('label')
      if (!error) setStatuses(data || [])
    } finally {
      setLoadingStatuses(false)
    }

    setLoadingRatings(true)
    try {
      const { data, error } = await supabase.from('product_risk_ratings').select('label')
      if (!error) setRatings(data || [])
    } finally {
      setLoadingRatings(false)
    }

    setLoadingCurrencies(true)
    try {
      const { data, error } = await supabase.from('product_currencies').select('code, label')
      if (!error) setCurrencies(data || [])
    } finally {
      setLoadingCurrencies(false)
    }
  }

  const handleSave = async () => {
    if (
      !formData.title ||
      !formData.rate ||
      formData.min_investment === undefined ||
      formData.min_investment === null ||
      formData.min_investment === ''
    ) {
      toast.error('Preencha os campos obrigatórios: Título, Taxa e Investimento Mínimo')
      return
    }

    setSaving(true)
    try {
      const payload = { ...formData }
      delete payload.debenture_series
      if (payload.series_id === '') payload.series_id = null

      if (product?.id) {
        const { error } = await supabase
          .from('investment_products')
          .update(payload)
          .eq('id', product.id)
        if (error) throw error
        toast.success('Produto atualizado com sucesso')
      } else {
        const { error } = await supabase.from('investment_products').insert([payload])
        if (error) throw error
        toast.success('Produto criado com sucesso')
      }
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Erro ao atualizar produto')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!product?.id) return
    setDeleting(true)
    try {
      const { count: invCount } = await supabase
        .from('investments')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', product.id)

      if (invCount && invCount > 0) {
        toast.error('Não é possível excluir: existem investimentos vinculados a este produto.')
        setDeleteConfirmOpen(false)
        return
      }

      if (product.series_id) {
        const { count: subCount } = await supabase
          .from('debenture_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('series_id', product.series_id)

        if (subCount && subCount > 0) {
          toast.error(
            'Não é possível excluir: existem assinaturas de debêntures vinculadas a este produto.',
          )
          setDeleteConfirmOpen(false)
          return
        }
      }

      const { error } = await supabase.from('investment_products').delete().eq('id', product.id)

      if (error) throw error
      toast.success('Produto excluído com sucesso')
      setDeleteConfirmOpen(false)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error('Erro ao excluir produto')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async () => {
    if (!product?.id) return
    setTogglingActive(true)
    try {
      const newValue = !formData.is_active
      const { error } = await supabase
        .from('investment_products')
        .update({ is_active: newValue })
        .eq('id', product.id)
      if (error) throw error
      setFormData({ ...formData, is_active: newValue })
      toast.success(newValue ? 'Produto visível na vitrine' : 'Produto ocultado com sucesso')
      onSuccess()
    } catch (error: any) {
      toast.error('Erro ao atualizar visibilidade')
    } finally {
      setTogglingActive(false)
    }
  }

  const handleToggleArchive = async () => {
    if (!product?.id) return
    setTogglingArchive(true)
    try {
      const newValue = !formData.is_archived
      const { error } = await supabase
        .from('investment_products')
        .update({ is_archived: newValue })
        .eq('id', product.id)
      if (error) throw error
      setFormData({ ...formData, is_archived: newValue })
      toast.success(newValue ? 'Produto arquivado com sucesso' : 'Produto restaurado com sucesso')
      onSuccess()
    } catch (error: any) {
      toast.error('Erro ao arquivar produto')
    } finally {
      setTogglingArchive(false)
    }
  }

  const isReadOnly = !isAdminOrStaff

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="resgate">Resgate</TabsTrigger>
            <TabsTrigger value="tributacao">Tributação</TabsTrigger>
            <TabsTrigger value="gestao">Gestão</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Título do Produto *</Label>
                <Input
                  disabled={isReadOnly}
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Debênture XPTO"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Produto</Label>
                <Select
                  disabled={isReadOnly}
                  value={formData.type || ''}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    <SelectItem value="Debênture">Debênture</SelectItem>
                    <SelectItem value="CRI">CRI</SelectItem>
                    <SelectItem value="CRA">CRA</SelectItem>
                    <SelectItem value="FIDC">FIDC</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || ''}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                  disabled={loadingStatuses || isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingStatuses ? 'Carregando...' : 'Selecione o status'}
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    {statuses.map((s) => (
                      <SelectItem key={s.label} value={s.label}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Série</Label>
                <Select
                  value={formData.series_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, series_id: v })}
                  disabled={loadingSeries || isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingSeries ? 'Carregando...' : 'Selecione uma série'}
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    <SelectItem value="empty">Nenhuma série</SelectItem>
                    {series.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.series_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Taxa / Rentabilidade *</Label>
                <Input
                  disabled={isReadOnly}
                  value={formData.rate || ''}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="Ex: CDI + 2%"
                />
              </div>

              <div className="space-y-2">
                <Label>Prazo (Termo)</Label>
                <Input
                  disabled={isReadOnly}
                  value={formData.term || ''}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  placeholder="Ex: 24 meses"
                />
              </div>

              <div className="space-y-2">
                <Label>Investimento Mínimo (R$) *</Label>
                <Input
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
                  type="number"
                  value={formData.global_quotas || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, global_quotas: parseInt(e.target.value, 10) })
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição Comercial</Label>
                <Textarea
                  disabled={isReadOnly}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  disabled={isReadOnly}
                  checked={formData.is_active || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  id="is-active"
                />
                <Label htmlFor="is-active">Produto Ativo (Visível na vitrine)</Label>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  disabled={isReadOnly}
                  checked={formData.is_highlighted || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_highlighted: v })}
                  id="is-highlighted"
                />
                <Label htmlFor="is-highlighted">Destacar na Vitrine</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="resgate" className="space-y-4 pt-4">
            <div className="space-y-4 border rounded-lg p-5 bg-muted/10">
              <div className="space-y-2">
                <Label>Regras de Resgate</Label>
                <Textarea
                  disabled={isReadOnly}
                  value={formData.redemption_rules || ''}
                  onChange={(e) => setFormData({ ...formData, redemption_rules: e.target.value })}
                  placeholder="Ex: Resgate apenas no vencimento"
                  rows={3}
                />
              </div>

              <div className="flex items-start space-x-3 pt-4 border-t">
                <Checkbox
                  disabled={isReadOnly}
                  id="allow_early"
                  checked={formData.allow_early_redemption || false}
                  onCheckedChange={(c) => {
                    setFormData({
                      ...formData,
                      allow_early_redemption: c,
                      early_redemption_penalty_pct: c ? formData.early_redemption_penalty_pct : 0,
                      early_redemption_discount_pct: c ? formData.early_redemption_discount_pct : 0,
                    })
                  }}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="allow_early" className="text-sm font-semibold cursor-pointer">
                    Permitir Resgate Antecipado
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se habilitado, os investidores poderão solicitar o resgate de cotas antes do
                    vencimento final do produto.
                  </p>
                </div>
              </div>

              {formData.allow_early_redemption && (
                <div className="grid grid-cols-2 gap-4 pt-4 mt-4">
                  <div className="space-y-1.5">
                    <Label>Multa sobre Principal (%)</Label>
                    <Input
                      disabled={isReadOnly}
                      type="number"
                      step="0.1"
                      placeholder="Ex: 5"
                      value={formData.early_redemption_penalty_pct || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          early_redemption_penalty_pct: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desconto no Rendimento (%)</Label>
                    <Input
                      disabled={isReadOnly}
                      type="number"
                      step="0.1"
                      placeholder="Ex: 50"
                      value={formData.early_redemption_discount_pct || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          early_redemption_discount_pct: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-4 mt-4">
                <Label>Prazo de Carência Mínimo (meses)</Label>
                <Input
                  disabled={isReadOnly}
                  type="number"
                  className="w-full sm:w-1/2"
                  placeholder="Ex: 6"
                  value={formData.min_grace_period_months || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, min_grace_period_months: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tempo mínimo que o investimento precisa ficar bloqueado antes de solicitar
                  resgate.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tributacao" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select
                  value={formData.currency || ''}
                  onValueChange={(v) => setFormData({ ...formData, currency: v })}
                  disabled={loadingCurrencies || isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingCurrencies ? 'Carregando...' : 'Selecione a moeda'}
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Regras de Tributação (IR)</Label>
                <Textarea
                  disabled={isReadOnly}
                  value={formData.ir_rules || ''}
                  onChange={(e) => setFormData({ ...formData, ir_rules: e.target.value })}
                  placeholder="Ex: Tabela regressiva de IR"
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gestao" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rating de Risco</Label>
                <Select
                  value={formData.rating || ''}
                  onValueChange={(v) => setFormData({ ...formData, rating: v, risk: v })}
                  disabled={loadingRatings || isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingRatings ? 'Carregando...' : 'Selecione o rating'}
                    />
                  </SelectTrigger>
                  <SelectContent className="z-[1100]">
                    {ratings.map((r) => (
                      <SelectItem key={r.label} value={r.label}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Público Alvo</Label>
                <Input
                  disabled={isReadOnly}
                  value={formData.target_audience || ''}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="Ex: Investidor Qualificado"
                />
              </div>

              <div className="space-y-2">
                <Label>Gestor</Label>
                <Input
                  disabled={isReadOnly}
                  value={formData.manager || ''}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  placeholder="Ex: Gestão Interna"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Política de Gestão</Label>
                <Textarea
                  disabled={isReadOnly}
                  value={formData.management_policy || ''}
                  onChange={(e) => setFormData({ ...formData, management_policy: e.target.value })}
                  placeholder="Ex: Foco em crédito privado..."
                  rows={4}
                />
              </div>
            </div>

            {(authLoading || isLoadingProfile) && product?.id ? (
              <div className="space-y-4 border-t pt-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando permissões...
                </div>
              </div>
            ) : isAdminOrStaff && product?.id ? (
              <div className="space-y-4 border-t pt-6 mt-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Ações do Produto
                </h4>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Visibilidade</span>
                      {formData.is_active ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Produto Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                          Produto Oculto
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Controla se o produto aparece na vitrine pública para investidores.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleActive}
                    disabled={togglingActive}
                  >
                    {togglingActive ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : formData.is_active ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {formData.is_active ? 'Ocultar' : 'Exibir'}
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Arquivo</span>
                      {formData.is_archived ? (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                          Arquivado
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Produtos arquivados não aceitam novos investimentos mas permanecem visíveis no
                      admin.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToggleArchive}
                    disabled={togglingArchive}
                  >
                    {togglingArchive ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : formData.is_archived ? (
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    {formData.is_archived ? 'Restaurar Produto' : 'Arquivar Produto'}
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4 bg-destructive/5">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-destructive">Excluir Produto</span>
                    <p className="text-xs text-muted-foreground">
                      Exclui permanentemente o produto do banco de dados. Esta ação não pode ser
                      desfeita.
                    </p>
                  </div>
                  <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Produto
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir permanentemente este produto? Esta ação não
                          pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmar Exclusão
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
