import { useState, useMemo } from 'react'
import {
  UploadCloud,
  Clock,
  Wallet,
  CalendarDays,
  ShieldAlert,
  Search,
  Download,
  Activity,
  Calculator,
  ArrowRight,
  FileCheck,
  Building,
  CheckCircle2,
  Circle,
  Filter,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

const timelineSteps = [
  { id: 1, label: 'Solicitado', status: 'completed', date: 'Hoje, 09:41' },
  { id: 2, label: 'Em Análise', status: 'completed', date: 'Hoje, 10:15' },
  { id: 3, label: 'Aguard. Assinatura', status: 'current', date: 'Pendente' },
  { id: 4, label: 'Pago', status: 'upcoming', date: '--' },
]

const operations = [
  { id: 'BOR-1042', date: '24/10/2023', gross: 45000, net: 43560, status: 'Aguardando Assinatura' },
  { id: 'BOR-1041', date: '15/09/2023', gross: 120000, net: 116160, status: 'Pago' },
  { id: 'BOR-1038', date: '02/08/2023', gross: 85000, net: 82280, status: 'Pago' },
  { id: 'BOR-1035', date: '20/07/2023', gross: 30000, net: 0, status: 'Recusado' },
]

const docs = [
  { name: 'Contrato Mãe (Cessão de Direitos)', date: '10/01/2023', type: 'PDF' },
  { name: 'Aditivo Contratual - Limite R$500k', date: '15/06/2023', type: 'PDF' },
  { name: 'Comprovante Liquidação BOR-1041', date: '16/09/2023', type: 'PDF' },
]

export default function BorrowerDashboard() {
  const [simBruto, setSimBruto] = useState<string>('')

  const brutoNum = parseFloat(simBruto.replace(/\D/g, '')) / 100 || 0

  const taxDesagio = 0.02
  const taxAdValorem = 0.005
  const taxIOF = 0.0038

  const calcSimulacao = useMemo(() => {
    if (!brutoNum) return { desagio: 0, adValorem: 0, iof: 0, liquido: 0 }
    const desagio = brutoNum * taxDesagio
    const adValorem = brutoNum * taxAdValorem
    const iof = brutoNum * taxIOF
    const liquido = brutoNum - desagio - adValorem - iof
    return { desagio, adValorem, iof, liquido }
  }, [brutoNum])

  const handleBrutoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value === '') {
      setSimBruto('')
      return
    }
    const num = parseInt(value, 10)
    const formatted = (num / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    setSimBruto(formatted)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pago':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Pago</Badge>
      case 'Aguardando Assinatura':
        return (
          <Badge
            variant="secondary"
            className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border-transparent"
          >
            Aguardando Assinatura
          </Badge>
        )
      case 'Em Análise':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Em Análise
          </Badge>
        )
      case 'Recusado':
        return <Badge variant="destructive">Recusado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

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

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Progresso da Última Solicitação</CardTitle>
              <CardDescription>
                Acompanhe em tempo real o status do seu lote BOR-1042
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-4">
              <div className="relative flex justify-between w-full mt-4 min-w-[500px] max-w-4xl mx-auto before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-0.5 before:bg-muted before:w-full before:-z-10">
                {timelineSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex flex-col items-center gap-2 bg-background px-2 relative z-10"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        step.status === 'completed'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : step.status === 'current'
                            ? 'bg-background border-primary text-primary'
                            : 'bg-muted border-muted text-muted-foreground'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : step.status === 'current' ? (
                        <Clock className="w-5 h-5 animate-pulse" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-sm font-medium ${step.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new" className="space-y-6 mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-primary" /> Envio de Borderô
                </CardTitle>
                <CardDescription>
                  Arraste suas notas fiscais (XML) e comprovantes (PDF) aqui.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg h-full min-h-[200px] flex flex-col items-center justify-center p-6 text-center hover:bg-muted/30 transition-colors cursor-pointer group">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Clique para buscar ou arraste os arquivos
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Suporta XML, PDF, JPG (Máx. 50MB)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" /> Simulador de Antecipação
                </CardTitle>
                <CardDescription>
                  Calcule os custos e o valor líquido a receber antes de enviar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Valor Bruto Total (R$)
                  </label>
                  <Input
                    placeholder="0,00"
                    value={simBruto}
                    onChange={handleBrutoChange}
                    className="text-lg font-mono"
                  />
                </div>

                <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deságio (2%)</span>
                    <span className="font-medium text-destructive">
                      -{formatCurrency(calcSimulacao.desagio)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa Ad Valorem (0.5%)</span>
                    <span className="font-medium text-destructive">
                      -{formatCurrency(calcSimulacao.adValorem)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pb-3 border-b border-border/50">
                    <span className="text-muted-foreground">IOF Estimado (0.38%)</span>
                    <span className="font-medium text-destructive">
                      -{formatCurrency(calcSimulacao.iof)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-foreground">Valor Líquido Estimado</span>
                    <span className="text-xl font-bold text-emerald-600">
                      {formatCurrency(calcSimulacao.liquido)}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full gap-2 text-md h-11" disabled={!brutoNum || brutoNum <= 0}>
                  Enviar para Análise <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle>Minhas Antecipações</CardTitle>
                <CardDescription>Histórico completo de operações e status atual.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar lote..." className="pl-9 w-full sm:w-[200px]" />
                </div>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote (ID)</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Valor Líquido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Termo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="font-medium">{op.id}</TableCell>
                      <TableCell>{op.date}</TableCell>
                      <TableCell>{formatCurrency(op.gross)}</TableCell>
                      <TableCell className={op.net > 0 ? 'text-emerald-600 font-medium' : ''}>
                        {op.net > 0 ? formatCurrency(op.net) : '--'}
                      </TableCell>
                      <TableCell>{getStatusBadge(op.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary hover:bg-primary/10"
                          disabled={op.status === 'Recusado' || op.status === 'Em Análise'}
                        >
                          <Download className="h-4 w-4 mr-2 hidden sm:inline-block" /> Baixar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
