import {
  Wallet,
  Activity,
  CalendarDays,
  ShieldAlert,
  Building,
  FileCheck,
  Download,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BorrowerNewOperation } from './BorrowerNewOperation'
import { BorrowerOperationsList } from './BorrowerOperationsList'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

const docs = [
  { name: 'Contrato Mãe (Cessão de Direitos)', date: '10/01/2023', type: 'PDF' },
  { name: 'Aditivo Contratual - Limite R$500k', date: '15/06/2023', type: 'PDF' },
]

export default function BorrowerDashboard() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Portal do Tomador</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie suas antecipações, simule novas operações e acompanhe seu limite de crédito.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-muted/50 p-1 rounded-lg overflow-x-auto sm:overflow-visible">
          <TabsTrigger value="overview" className="rounded-md">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="new" className="rounded-md">
            Nova Solicitação
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-md">
            Operações
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-md">
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Antecipado
                </CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(450000)}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Acumulado no ano</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Operações em Análise
                </CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">2 Lotes</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  R$ 45.000,00 pendentes
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Próximo Vencimento
                </CardTitle>
                <CalendarDays className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(15000)}</div>
                <p className="text-xs text-amber-600 mt-1 font-medium">Vence em 05/Nov/2023</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm bg-primary text-primary-foreground">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-primary-foreground/80">
                  Limite Disponível
                </CardTitle>
                <Wallet className="h-4 w-4 text-primary-foreground/80" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(380000)}</div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-primary-foreground/80">
                    <span>24% utilizado</span>
                    <span>R$ 500k total</span>
                  </div>
                  <Progress
                    value={24}
                    className="h-1.5 bg-primary-foreground/20 [&>div]:bg-primary-foreground"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <BorrowerOperationsList />
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <BorrowerNewOperation />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <BorrowerOperationsList />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6 mt-6">
          <Alert variant="destructive">
            <ShieldAlert className="h-5 w-5" />
            <AlertTitle>Atenção: Renovação de Cadastro (KYC)</AlertTitle>
            <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span>
                Seu <strong>Contrato Social Atualizado</strong> vence em 15 dias. Atualize seus
                documentos para não ter seu limite bloqueado.
              </span>
              <Button size="sm" variant="destructive" className="shrink-0">
                Atualizar Agora
              </Button>
            </AlertDescription>
          </Alert>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" /> Vault de Documentos
              </CardTitle>
              <CardDescription>
                Repositório seguro de contratos, aditivos e termos assinados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {docs.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Gerado em {doc.date} • {doc.type}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" title="Baixar documento">
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
