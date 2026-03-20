import { ShieldCheck, TrendingUp, PiggyBank, ArrowRight, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const products = [
  {
    id: 1,
    title: 'CRI Agro Sustentável',
    type: 'CRI',
    rate: 'CDI + 3.5% a.a.',
    term: '36 meses',
    minInvestment: 'R$ 10.000',
    risk: 'Baixo',
    progress: 75,
    status: 'Captação Aberta',
  },
  {
    id: 2,
    title: 'Debênture Infra Logística',
    type: 'Debênture',
    rate: 'IPCA + 7.2% a.a.',
    term: '48 meses',
    minInvestment: 'R$ 5.000',
    risk: 'Médio',
    progress: 40,
    status: 'Captação Aberta',
  },
  {
    id: 3,
    title: 'FIDC Recebíveis Industriais',
    type: 'Cota Sênior',
    rate: '115% do CDI',
    term: '24 meses',
    minInvestment: 'R$ 25.000',
    risk: 'Baixo',
    progress: 95,
    status: 'Últimas Cotas',
  },
]

export default function Investments() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Oportunidades de Investimento</h1>
        <p className="text-muted-foreground">
          Explore e invista nos melhores produtos de securitização com rentabilidade atrativa.
        </p>
      </div>

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
                  <p className="font-semibold">{product.minInvestment}</p>
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
                Investir Agora
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
