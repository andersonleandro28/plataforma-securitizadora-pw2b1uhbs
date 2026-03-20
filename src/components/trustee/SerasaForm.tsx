import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'
import { getSerasaScore, saveSerasaConsultation, type SerasaScoreResponse } from '@/services/serasa'
import { toast } from 'sonner'

export function SerasaForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth()
  const [doc, setDoc] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SerasaScoreResponse | null>(null)

  const handleScore = async () => {
    if (!doc) return toast.warning('Por favor, digite um CPF ou CNPJ.')
    setLoading(true)
    setData(null)

    try {
      const result = await getSerasaScore(doc)
      setData(result)

      if (user) {
        await saveSerasaConsultation(user.id, result)
        toast.success(`Score para ${doc} obtido e salvo no histórico com sucesso.`)
        onSaved()
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro na consulta do Serasa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/20 shadow-sm animate-fade-in-up">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" /> Nova Análise Serasa
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
            {loading ? 'Consultando...' : 'Solicitar Score'}
          </Button>
        </div>

        {data && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <Card className="bg-muted/10 border-transparent">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Score Serasa</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {data.score}{' '}
                  <span className="text-sm text-muted-foreground font-normal">/ 1000</span>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-muted/10 border-transparent">
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
            <Card className="bg-muted/10 border-transparent">
              <CardContent className="pt-6">
                <p className="text-sm font-medium text-muted-foreground">Prob. Default</p>
                <p className="text-2xl font-semibold mt-1">{data.probabilityOfDefault}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/10 border-transparent">
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
  )
}
