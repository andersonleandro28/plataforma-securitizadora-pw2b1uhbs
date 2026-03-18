import { ShieldCheck, History, XOctagon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Trustee() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trustee Corner</h1>
        <p className="text-muted-foreground">
          Visão do Agente Fiduciário: Covenants e auditoria de lastro.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-secondary" />
              Checklist de Covenants Financeiros
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real dos limites do regulamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div>
                <p className="font-medium">Índice de Liquidez</p>
                <p className="text-xs text-muted-foreground">Exigência: &gt; 1.20x</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">1.45x</span>
                <Badge className="bg-secondary text-white hover:bg-secondary">OK</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
              <div>
                <p className="font-medium">Inadimplência (PDL &gt; 30 dias)</p>
                <p className="text-xs text-muted-foreground">Exigência: &lt; 5.0%</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">2.4%</span>
                <Badge className="bg-secondary text-white hover:bg-secondary">OK</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-destructive/50 rounded-lg bg-destructive/5">
              <div>
                <p className="font-medium text-destructive">Concentração Maior Devedor</p>
                <p className="text-xs text-muted-foreground">Exigência: &lt; 15%</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-destructive">18.2%</span>
                <Badge variant="destructive">Breach</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log de Validação de Lastro
            </CardTitle>
            <CardDescription>Auditoria das aprovações de borderôs.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="relative border-l ml-3 space-y-6 pb-4">
                <div className="relative pl-6">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-background"></span>
                  <p className="text-sm font-medium">Borderô #2091 Aprovado</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    Hoje, 14:30 - Por Sistema Automático
                  </p>
                  <div className="text-xs p-2 bg-muted rounded border font-mono">
                    Volume: R$ 450k | Critérios Elegibilidade: 100% OK
                  </div>
                </div>

                <div className="relative pl-6">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-destructive ring-4 ring-background"></span>
                  <p className="text-sm font-medium">Borderô #2090 Rejeitado</p>
                  <p className="text-xs text-muted-foreground mb-1">
                    Ontem, 16:45 - Por Auditoria Manual
                  </p>
                  <div className="text-xs p-2 bg-destructive/10 text-destructive rounded border border-destructive/20 flex items-start gap-1">
                    <XOctagon className="h-3 w-3 mt-0.5" />
                    Título fora de praça não permitido pelo regulamento.
                  </div>
                </div>

                <div className="relative pl-6">
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-background"></span>
                  <p className="text-sm font-medium">Cessão de Direitos Assinada</p>
                  <p className="text-xs text-muted-foreground">
                    Ontem, 09:12 - Clicksign Integração
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
