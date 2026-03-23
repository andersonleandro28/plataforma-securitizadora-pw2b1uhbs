import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  ArrowRight,
  Clock,
  Loader2,
  AlertCircle,
  CheckSquare,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function Investments() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [investProduct, setInvestProduct] = useState<any>(null)
  const [quotasToBuy, setQuotasToBuy] = useState<number>(1)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('investment_products')
      .select('*, debenture_series(id, indexer)')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('is_highlighted', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) setProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const handleInvest = async () => {
    const available = (investProduct.global_quotas || 999999) - (investProduct.sold_quotas || 0)
    const minQ = investProduct.min_quotas_per_investor || 1
    const maxQ = investProduct.max_quotas_per_investor || 999999

    if (!investProduct.series_id)
      return toast.error('Produto não vinculado a uma série oficial. Impossível aportar.')
    if (quotasToBuy < minQ) return toast.error(`A aplicação mínima é de ${minQ} cotas.`)
    if (quotasToBuy > maxQ) return toast.error(`A aplicação máxima é de ${maxQ} cotas.`)
    if (quotasToBuy > available)
      return toast.error(`Temos apenas ${available} cotas disponíveis no momento.`)
    if (!acceptedTerms) return toast.error('Você precisa aceitar os termos do contrato.')
    if (!profile?.document_number)
      return toast.error('Complete seu cadastro (CPF/CNPJ) no perfil antes de investir.')

    setSaving(true)
    try {
      const qValue = investProduct.quota_value || investProduct.min_investment || 1000
      const totalAmount = quotasToBuy * qValue

      // Insert subscription
      const { error: subErr } = await supabase.from('debenture_subscriptions').insert({
        series_id: investProduct.series_id,
        investor_name: profile.full_name || profile.email || 'Investidor',
        document_number: profile.document_number,
        quantity: quotasToBuy,
        unit_price: qValue,
        total_amount: totalAmount,
        subscription_date: new Date().toISOString().split('T')[0],
      })
      if (subErr) throw subErr

      // Increment sold quotas
      const { error: updErr } = await supabase
        .from('investment_products')
        .update({ sold_quotas: (investProduct.sold_quotas || 0) + quotasToBuy })
        .eq('id', investProduct.id)
      if (updErr) console.error('Error updating sold quotas:', updErr)

      toast.success('Parabéns! Investimento realizado com sucesso.')
      setInvestProduct(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar o investimento.')
    } finally {
      setSaving(false)
    }
  }

  const openInvestModal = (p: any) => {
    setInvestProduct(p)
    setQuotasToBuy(p.min_quotas_per_investor || 1)
    setAcceptedTerms(false)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Oportunidades de Investimento</h1>
        <p className="text-muted-foreground">
          Explore o catálogo e invista nos melhores produtos estruturados.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <p className="text-lg font-medium">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => {
            const isSoldOut =
              product.status === 'Esgotado' ||
              (product.sold_quotas >= product.global_quotas && product.global_quotas > 0)
            const progress =
              product.global_quotas > 0 ? (product.sold_quotas / product.global_quotas) * 100 : 0

            return (
              <Card
                key={product.id}
                className={`flex flex-col hover:border-primary/50 transition-colors shadow-sm relative ${isSoldOut ? 'opacity-80 grayscale-[30%]' : ''}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    {isSoldOut ? (
                      <Badge variant="destructive">Esgotado</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {product.status}
                      </Badge>
                    )}
                    {product.is_highlighted && !isSoldOut && (
                      <Badge className="bg-amber-500 hover:bg-amber-600">Destaque</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl pr-6">{product.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {product.manager || 'Gestão Interna'} • {product.rating}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Rentabilidade
                      </span>
                      <p className="font-semibold text-emerald-600">{product.rate || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Prazo
                      </span>
                      <p className="font-semibold">{product.term || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PiggyBank className="h-3 w-3" /> Valor da Cota
                      </span>
                      <p className="font-semibold">
                        {formatCurrency(product.quota_value || product.min_investment)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Moeda
                      </span>
                      <p className="font-semibold">{product.currency || 'BRL'}</p>
                    </div>
                  </div>

                  {product.global_quotas > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Captação ({progress.toFixed(0)}%)</span>
                        <span>
                          {product.sold_quotas} de {product.global_quotas} cotas
                        </span>
                      </div>
                      <Progress value={Math.min(100, progress)} className="h-2" />
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-4 border-t">
                  <Button
                    className="w-full gap-2 group/btn"
                    disabled={isSoldOut}
                    onClick={() => openInvestModal(product)}
                  >
                    {isSoldOut ? 'Cotas Esgotadas' : 'Investir Agora'}
                    {!isSoldOut && (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!investProduct} onOpenChange={(open) => !open && setInvestProduct(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto z-[2000]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Confirmação de Aporte
            </DialogTitle>
            <DialogDescription>
              Aporte em <strong>{investProduct?.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          {investProduct && (
            <div className="space-y-6 py-4">
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Rentabilidade</p>
                    <p className="font-semibold text-emerald-600">{investProduct.rate}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor da Cota Unitária</p>
                    <p className="font-semibold">
                      {formatCurrency(investProduct.quota_value || investProduct.min_investment)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Quantidade de Cotas a Adquirir
                </Label>
                <div className="flex gap-4 items-center">
                  <Input
                    type="number"
                    className="text-lg font-mono h-12 w-32"
                    value={quotasToBuy}
                    onChange={(e) => setQuotasToBuy(Number(e.target.value))}
                    min={investProduct.min_quotas_per_investor || 1}
                    max={investProduct.max_quotas_per_investor || 999}
                  />
                  <div className="flex-1 bg-primary/10 rounded-md p-3 border border-primary/20 text-center">
                    <p className="text-xs text-primary font-medium mb-1">Valor Total do Aporte</p>
                    <p className="text-xl font-bold font-mono text-primary">
                      {formatCurrency(
                        quotasToBuy *
                          (investProduct.quota_value || investProduct.min_investment || 1000),
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Mínimo:{' '}
                  {investProduct.min_quotas_per_investor || 1} cota(s) | Máximo:{' '}
                  {investProduct.max_quotas_per_investor || 'Sem limite'}
                </p>
              </div>

              <div className="flex items-start space-x-3 bg-muted/20 p-4 rounded-md border">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                    Li e concordo com o Termo de Subscrição
                  </label>
                  <p className="text-xs text-muted-foreground pt-1">
                    Declaro ciência sobre as regras de resgate, carência de{' '}
                    {investProduct.application_cotization_months || 0} meses e incidência de
                    tributação aplicável.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestProduct(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleInvest} disabled={saving || !acceptedTerms}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckSquare className="h-4 w-4 mr-2" />
              )}
              Confirmar Investimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
