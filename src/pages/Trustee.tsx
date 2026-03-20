import { useState } from 'react'
import { ShieldCheck, History, XOctagon, Loader2, Search, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getSerasaScore, type SerasaScoreResponse } from '@/services/serasa'

export default function Trustee() {
  const { toast } = useToast()
  const [doc, setDoc] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SerasaScoreResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScore = async () => {
    if (!doc) {
      return toast({
        title: 'Obrigatório',
        description: 'Digite um CPF/CNPJ.',
        variant: 'destructive',
      })
    }
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const result = await getSerasaScore(doc)
      setData(result)
      toast({ title: 'Sucesso', description: `Score para ${doc} obtido com sucesso.` })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Erro de API Serasa')
      toast({ title: 'Erro', description: 'Falha na consulta do Score.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trustee Corner</h1>
        <p className="text-muted-foreground">Análise de Risco, Covenants e Auditoria Fiduciária.</p>
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" /> Análise Serasa
          </CardTitle>
          <CardDescription>
            Consulte o score de crédito e risco de inadimplência (Sandbox).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <Input
              placeholder="Digite o CPF ou CNPJ"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleScore} disabled={loading} className="sm:w-40">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? 'Consultando' : 'Solicitar Score'}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="animate-fade-in max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro na consulta</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {data && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
              <Card className="bg-muted/10">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Score Serasa</p>
                  <p className="text-3xl font-bold text-primary mt-1">
                    {data.score}{' '}
                    <span className="text-sm text-muted-foreground font-normal">/ 1000</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-muted/10">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Classificação</p>
                  <Badge
                    variant={
                      data.riskClassification === 'Alto'
                        ? 'destructive'
                        : data.riskClassification === 'Médio'
                          ? 'secondary'
                          : 'default'
                    }
                    className="mt-2 text-sm"
                  >
                    Risco {data.riskClassification}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="bg-muted/10">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Prob. Default</p>
                  <p className="text-2xl font-semibold mt-1">{data.probabilityOfDefault}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/10">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground">Apontamentos</p>
                  <p className="text-2xl font-semibold mt-1 text-destructive">
                    {data.negativeRecords}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-secondary" /> Covenants
            </CardTitle>
            <CardDescription>Monitoramento de limites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between p-3 border rounded-lg bg-card">
              <div>
                <p className="font-medium text-sm">Liquidez</p>
                <p className="text-xs text-muted-foreground">&gt; 1.20x</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm">1.45x</span>
                <Badge className="bg-secondary text-secondary-foreground">OK</Badge>
              </div>
            </div>
            <div className="flex justify-between p-3 border rounded-lg bg-card">
              <div>
                <p className="font-medium text-sm">PDL &gt; 30d</p>
                <p className="text-xs text-muted-foreground">&lt; 5.0%</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm">2.4%</span>
                <Badge className="bg-secondary text-secondary-foreground">OK</Badge>
              </div>
            </div>
            <div className="flex justify-between p-3 border border-destructive/50 rounded-lg bg-destructive/5">
              <div>
                <p className="font-medium text-sm text-destructive">Maior Devedor</p>
                <p className="text-xs text-muted-foreground">&lt; 15%</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-destructive">18.2%</span>
                <Badge variant="destructive">Breach</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" /> Log Validação
            </CardTitle>
            <CardDescription>Auditoria das aprovações.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="relative border-l ml-3 space-y-6 pb-4 border-muted">
                <div className="relative pl-6">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-background"></span>
                  <p className="text-sm font-medium">Borderô #2091</p>
                  <p className="text-xs text-muted-foreground">Hoje, 14:30 - Automático</p>
                </div>
                <div className="relative pl-6">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-destructive ring-4 ring-background"></span>
                  <p className="text-sm font-medium flex items-center gap-1">
                    Borderô #2090 <XOctagon className="h-3 w-3 text-destructive" />
                  </p>
                  <p className="text-xs text-muted-foreground">Ontem, 16:45 - Manual</p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
