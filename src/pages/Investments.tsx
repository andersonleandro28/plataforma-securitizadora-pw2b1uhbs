import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  ArrowRight,
  Clock,
  Loader2,
  Edit,
  CheckSquare,
  FileText,
  AlertCircle,
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function Investments() {
  const { profile, activeRole } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seriesList, setSeriesList] = useState<any[]>([])

  const [editProduct, setEditProduct] = useState<any>(null)
  const [investProduct, setInvestProduct] = useState<any>(null)
  const [investAmount, setInvestAmount] = useState<number>(0)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [saving, setSaving] = useState(false)

  const isAdmin = activeRole === 'admin' || activeRole === 'staff'

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('investment_products')
      .select('*, debenture_series(id, rate, indexer, maturity_date)')
      .order('created_at', { ascending: false })
    if (data) setProducts(data)
    setLoading(false)
  }

  const fetchSeries = async () => {
    const { data } = await supabase.from('debenture_series').select('*, debentures(issuer_name)')
    if (data) setSeriesList(data)
  }

  useEffect(() => {
    fetchProducts()
    if (isAdmin) fetchSeries()
  }, [isAdmin])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('investment_products')
        .update({
          series_id: editProduct.series_id || null,
          description: editProduct.description,
          redemption_rules: editProduct.redemption_rules,
          ir_rules: editProduct.ir_rules,
        })
        .eq('id', editProduct.id)

      if (error) throw error
      toast.success('Produto atualizado com sucesso!')
      setEditProduct(null)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  const handleInvest = async () => {
    if (!investAmount || investAmount < investProduct.min_investment) {
      return toast.error(`A aplicação mínima é de ${formatCurrency(investProduct.min_investment)}`)
    }
    if (!acceptedTerms) {
      return toast.error('Você precisa aceitar os termos do contrato.')
    }
    if (!profile?.document_number) {
      return toast.error('Complete seu cadastro (CPF/CNPJ) no perfil antes de investir.')
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('debenture_subscriptions').insert({
        series_id: investProduct.series_id,
        investor_name: profile.full_name || profile.email || 'Investidor',
        document_number: profile.document_number,
        quantity: 1,
        unit_price: investAmount,
        total_amount: investAmount,
        subscription_date: new Date().toISOString().split('T')[0],
      })

      if (error) throw error

      toast.success('Parabéns! Investimento realizado com sucesso.')
      setInvestProduct(null)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar o investimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Oportunidades de Investimento</h1>
        <p className="text-muted-foreground">
          Explore e invista nos melhores produtos de securitização extraídos diretamente do seu
          catálogo.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 px-6 text-muted-foreground bg-muted/20 border border-dashed border-muted-foreground/30 rounded-lg">
          <p className="text-lg font-medium mb-2">Nenhum produto cadastrado.</p>
          <p className="text-sm">
            Processe uma <strong>Listagem de Subscrição</strong> na aba de Debêntures para popular
            seu catálogo com os ativos reais.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className="flex flex-col hover:border-primary/50 transition-colors shadow-sm relative group"
            >
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8"
                  onClick={() =>
                    setEditProduct({
                      ...product,
                      description: product.description || '',
                      redemption_rules:
                        product.redemption_rules ||
                        'Liquidez no vencimento. Não há possibilidade de resgate antecipado sem penalidade, sujeito a marcação a mercado.',
                      ir_rules:
                        product.ir_rules ||
                        'Imposto de Renda retido na fonte seguindo a tabela regressiva de Renda Fixa:\n- Até 180 dias: 22,5%\n- De 181 a 360 dias: 20%\n- De 361 a 720 dias: 17,5%\n- Acima de 720 dias: 15%',
                    })
                  }
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}

              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge
                    variant={product.status === 'Últimas Cotas' ? 'destructive' : 'secondary'}
                    className={
                      product.status !== 'Últimas Cotas'
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : ''
                    }
                  >
                    {product.status}
                  </Badge>
                  <Badge variant="outline">{product.type}</Badge>
                </div>
                <CardTitle className="text-xl pr-6">{product.title}</CardTitle>
                {product.series_id && product.debenture_series && (
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Indexador Real: {product.debenture_series.indexer} +{' '}
                    {product.debenture_series.rate}%
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Rentabilidade
                    </span>
                    <p className="font-semibold text-emerald-600">{product.rate}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Prazo
                    </span>
                    <p className="font-semibold">{product.term}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <PiggyBank className="h-3 w-3" /> Aplicação Mín.
                    </span>
                    <p className="font-semibold">{formatCurrency(product.min_investment)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Risco
                    </span>
                    <p className="font-semibold">{product.risk}</p>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Volume Captado ({product.progress}%)</span>
                  </div>
                  <Progress value={product.progress} className="h-2" />
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t">
                <Button
                  className="w-full gap-2 group/btn"
                  onClick={() => {
                    if (!product.series_id) {
                      toast.info(
                        'Este produto ainda está em fase de estruturação e não pode receber aportes.',
                      )
                      return
                    }
                    setInvestProduct(product)
                    setInvestAmount(product.min_investment)
                    setAcceptedTerms(false)
                  }}
                >
                  Investir Agora{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Product Dialog for Admins */}
      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estruturar Produto de Investimento</DialogTitle>
            <DialogDescription>
              Vincule este produto a uma série real e defina as regras de resgate e tributação
              visíveis ao investidor.
            </DialogDescription>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label>Vincular a uma Série (Real)</Label>
                <Select
                  value={editProduct.series_id || ''}
                  onValueChange={(val) => setEditProduct({ ...editProduct, series_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a série correspondente" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.debentures?.issuer_name} - Série {s.series_number} ({s.indexer} +{' '}
                        {s.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição / Resumo do Ativo</Label>
                <Textarea
                  value={editProduct.description}
                  onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
                  placeholder="Detalhes adicionais sobre o lastro..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Regras de Resgate e Liquidez</Label>
                <Textarea
                  value={editProduct.redemption_rules}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, redemption_rules: e.target.value })
                  }
                  className="h-20"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Regras de Imposto de Renda</Label>
                <Textarea
                  value={editProduct.ir_rules}
                  onChange={(e) => setEditProduct({ ...editProduct, ir_rules: e.target.value })}
                  className="h-28"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Estrutura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invest Flow Dialog */}
      <Dialog open={!!investProduct} onOpenChange={(open) => !open && setInvestProduct(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Termo de Subscrição
            </DialogTitle>
            <DialogDescription>
              Você está prestes a realizar um aporte em <strong>{investProduct?.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          {investProduct && (
            <div className="space-y-6 py-4">
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Rentabilidade Alvo</p>
                    <p className="font-semibold text-emerald-600">
                      {investProduct.debenture_series?.indexer} +{' '}
                      {investProduct.debenture_series?.rate}% a.a.
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-semibold">
                      {investProduct.debenture_series?.maturity_date
                        ? new Date(investProduct.debenture_series.maturity_date).toLocaleDateString(
                            'pt-BR',
                          )
                        : investProduct.term}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-border/50">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Resgate e Liquidez
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {investProduct.redemption_rules || 'Liquidez no vencimento.'}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-border/50">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Tributação (IR)
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {investProduct.ir_rules || 'Tabela regressiva padrão.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">Valor do Aporte (R$)</Label>
                <div className="flex gap-4 items-center">
                  <Input
                    type="number"
                    className="text-lg font-mono h-12"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(Number(e.target.value))}
                    min={investProduct.min_investment}
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Aplicação mínima:{' '}
                  {formatCurrency(investProduct.min_investment)}
                </p>
              </div>

              <div className="flex items-start space-x-3 bg-primary/5 p-4 rounded-md border border-primary/20">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(c) => setAcceptedTerms(c as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Li e concordo com as Regras de Negócio
                  </label>
                  <p className="text-xs text-muted-foreground pt-1">
                    Declaro ciência sobre os prazos de liquidez, riscos do emissor e incidência de
                    tributação aplicável a este ativo.
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
