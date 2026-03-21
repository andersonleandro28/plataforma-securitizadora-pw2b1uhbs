import { useEffect, useState } from 'react'
import { ShieldCheck, TrendingUp, PiggyBank, ArrowRight, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase/client'

export default function Investments() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('investment_products')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setProducts(data)
      setLoading(false)
    }
    fetchProducts()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

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
              className="flex flex-col hover:border-primary/50 transition-colors shadow-sm"
            >
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
                <CardTitle className="text-xl">{product.title}</CardTitle>
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
                <Button className="w-full gap-2 group">
                  Investir Agora{' '}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
