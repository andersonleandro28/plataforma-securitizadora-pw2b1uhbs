import { ShieldCheck, History as HistoryIcon, XOctagon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export function CovenantsPanel() {
  return (
    <div className="grid md:grid-cols-2 gap-6 animate-fade-in-up">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-secondary" /> Covenants
          </CardTitle>
          <CardDescription>Monitoramento de limites operacionais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-medium text-sm">Índice de Liquidez</p>
              <p className="text-xs text-muted-foreground">Target: &gt; 1.20x</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-sm">1.45x</span>
              <Badge className="bg-secondary text-secondary-foreground">OK</Badge>
            </div>
          </div>
          <div className="flex justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-medium text-sm">PDL &gt; 30d (Inadimplência)</p>
              <p className="text-xs text-muted-foreground">Target: &lt; 5.0%</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-sm">2.4%</span>
              <Badge className="bg-secondary text-secondary-foreground">OK</Badge>
            </div>
          </div>
          <div className="flex justify-between p-3 border border-destructive/50 rounded-lg bg-destructive/5">
            <div>
              <p className="font-medium text-sm text-destructive">Concentração Maior Devedor</p>
              <p className="text-xs text-muted-foreground">Target: &lt; 15%</p>
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
            <HistoryIcon className="h-5 w-5 text-primary" /> Log Validação Operacional
          </CardTitle>
          <CardDescription>Auditoria recente das aprovações de crédito.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[220px] pr-4">
            <div className="relative border-l ml-3 space-y-6 pb-4 border-muted">
              <div className="relative pl-6">
                <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-secondary ring-4 ring-background"></span>
                <p className="text-sm font-medium">Borderô #2091</p>
                <p className="text-xs text-muted-foreground">Hoje, 14:30 - Aprovação Automática</p>
              </div>
              <div className="relative pl-6">
                <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-destructive ring-4 ring-background"></span>
                <p className="text-sm font-medium flex items-center gap-1">
                  Borderô #2090 <XOctagon className="h-3 w-3 text-destructive" />
                </p>
                <p className="text-xs text-muted-foreground">
                  Ontem, 16:45 - Rejeitado Manualmente
                </p>
              </div>
              <div className="relative pl-6">
                <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-muted-foreground ring-4 ring-background"></span>
                <p className="text-sm font-medium">Borderô #2089</p>
                <p className="text-xs text-muted-foreground">Ontem, 09:15 - Análise Pendente</p>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
