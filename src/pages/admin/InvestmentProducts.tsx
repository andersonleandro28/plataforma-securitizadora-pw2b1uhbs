import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Loader2 } from 'lucide-react'

export default function InvestmentProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('investment_products')
      .select(
        `
        *,
        debenture_series ( series_number )
      `,
      )
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar produtos de investimento')
      console.error(error)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Produtos de Investimento</h2>
        <div className="flex items-center space-x-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Produto</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes do produto de investimento.
                </DialogDescription>
              </DialogHeader>
              <ProductForm
                onSuccess={() => {
                  setIsModalOpen(false)
                  fetchProducts()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Título
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Tipo
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Série
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Status
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Risco
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Taxa
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado no banco.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{p.title}</td>
                    <td className="p-4 align-middle">{p.type}</td>
                    <td className="p-4 align-middle">{p.debenture_series?.series_number || '-'}</td>
                    <td className="p-4 align-middle">{p.status}</td>
                    <td className="p-4 align-middle">{p.risk}</td>
                    <td className="p-4 align-middle">{p.rate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  console.log('[DEBUG] Renderizando formulário de produtos')

  const [series, setSeries] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<any[]>([])

  const [seriesError, setSeriesError] = useState('')
  const [statusError, setStatusError] = useState('')
  const [ratingError, setRatingError] = useState('')
  const [currencyError, setCurrencyError] = useState('')

  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    type: 'Debênture',
    series_id: '',
    status: '',
    risk: '',
    currency: '',
    rate: '',
    term: '',
    min_investment: 1000,
  })

  useEffect(() => {
    let mounted = true

    async function fetchOptions() {
      // --- SÉRIE ---
      console.log('[DEBUG] Carregando dados para dropdowns: Série')
      const resSeries = await supabase.from('debenture_series').select('*')
      if (!mounted) return
      if (resSeries.error) {
        console.log(`[DEBUG] Erro ao carregar Série: ${resSeries.error.message}`)
        setSeriesError('Erro ao carregar opções')
      } else {
        setSeries(resSeries.data || [])
      }

      // --- STATUS ---
      console.log('[DEBUG] Carregando dados para dropdowns: Status')
      const resStatus = await supabase.from('product_statuses').select('*')
      if (!mounted) return
      if (resStatus.error) {
        console.log(`[DEBUG] Erro ao carregar Status: ${resStatus.error.message}`)
        setStatusError('Erro ao carregar opções')
      } else {
        setStatuses(resStatus.data || [])
      }

      // --- RATING ---
      console.log('[DEBUG] Carregando dados para dropdowns: Rating de Risco')
      const resRisk = await supabase.from('product_risk_ratings').select('*')
      if (!mounted) return
      if (resRisk.error) {
        console.log(`[DEBUG] Erro ao carregar Rating de Risco: ${resRisk.error.message}`)
        setRatingError('Erro ao carregar opções')
      } else {
        setRatings(resRisk.data || [])
      }

      // --- MOEDA ---
      console.log('[DEBUG] Carregando dados para dropdowns: Moeda')
      const resCurr = await supabase.from('product_currencies').select('*')
      if (!mounted) return
      if (resCurr.error) {
        console.log(`[DEBUG] Erro ao carregar Moeda: ${resCurr.error.message}`)
        setCurrencyError('Erro ao carregar opções')
      } else {
        setCurrencies(resCurr.data || [])
      }
    }

    fetchOptions()

    return () => {
      mounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('investment_products').insert({
      title: formData.title,
      type: formData.type,
      series_id: formData.series_id || null,
      status: formData.status || 'Captação Aberta',
      risk: formData.risk || 'Médio',
      currency: formData.currency || 'BRL',
      rate: formData.rate,
      term: formData.term,
      min_investment: formData.min_investment,
    })

    setLoading(false)

    if (error) {
      toast.error('Erro ao salvar o produto')
      console.error('Erro ao salvar produto:', error)
    } else {
      toast.success('Produto salvo com sucesso!')
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Debênture IPCA+"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Input
            id="type"
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            placeholder="Ex: Debênture"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="series">Série</Label>
          <Select
            value={formData.series_id}
            onValueChange={(v) => setFormData({ ...formData, series_id: v })}
          >
            <SelectTrigger id="series">
              <SelectValue placeholder="Selecione uma série" />
            </SelectTrigger>
            <SelectContent>
              {seriesError ? (
                <SelectItem value="error" disabled>
                  {seriesError}
                </SelectItem>
              ) : series.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma opção cadastrada no banco
                </SelectItem>
              ) : (
                series.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.series_number} -{' '}
                    {s.volume?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v })}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Selecione um status" />
            </SelectTrigger>
            <SelectContent>
              {statusError ? (
                <SelectItem value="error" disabled>
                  {statusError}
                </SelectItem>
              ) : statuses.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma opção cadastrada no banco
                </SelectItem>
              ) : (
                statuses.map((s) => (
                  <SelectItem key={s.id} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="risk">Rating de Risco</Label>
          <Select
            value={formData.risk}
            onValueChange={(v) => setFormData({ ...formData, risk: v })}
          >
            <SelectTrigger id="risk">
              <SelectValue placeholder="Selecione o risco" />
            </SelectTrigger>
            <SelectContent>
              {ratingError ? (
                <SelectItem value="error" disabled>
                  {ratingError}
                </SelectItem>
              ) : ratings.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma opção cadastrada no banco
                </SelectItem>
              ) : (
                ratings.map((s) => (
                  <SelectItem key={s.id} value={s.label}>
                    {s.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Moeda</Label>
          <Select
            value={formData.currency}
            onValueChange={(v) => setFormData({ ...formData, currency: v })}
          >
            <SelectTrigger id="currency">
              <SelectValue placeholder="Selecione a moeda" />
            </SelectTrigger>
            <SelectContent>
              {currencyError ? (
                <SelectItem value="error" disabled>
                  {currencyError}
                </SelectItem>
              ) : currencies.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma opção cadastrada no banco
                </SelectItem>
              ) : (
                currencies.map((s) => (
                  <SelectItem key={s.id} value={s.code}>
                    {s.label} ({s.symbol})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate">Taxa</Label>
          <Input
            id="rate"
            required
            value={formData.rate}
            onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
            placeholder="Ex: CDI + 2% a.a."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="term">Prazo</Label>
          <Input
            id="term"
            required
            value={formData.term}
            onChange={(e) => setFormData({ ...formData, term: e.target.value })}
            placeholder="Ex: 24 meses"
          />
        </div>

        <div className="col-span-1 space-y-2 md:col-span-2">
          <Label htmlFor="min_investment">Investimento Mínimo (R$)</Label>
          <Input
            id="min_investment"
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.min_investment}
            onChange={(e) => setFormData({ ...formData, min_investment: Number(e.target.value) })}
          />
        </div>
      </div>
      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Produto
        </Button>
      </DialogFooter>
    </form>
  )
}
