import { Building2, UploadCloud, BrainCircuit, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

const entities = [
  {
    id: '1',
    name: 'Agropecuária Sul S/A',
    type: 'Cedente',
    cnpj: '12.345.678/0001-90',
    status: 'Aprovado',
  },
  {
    id: '2',
    name: 'Indústrias Metalmax',
    type: 'Sacado',
    cnpj: '98.765.432/0001-10',
    status: 'Pendente',
  },
  {
    id: '3',
    name: 'Varejão Logística',
    type: 'Cedente',
    cnpj: '45.123.987/0001-55',
    status: 'Bloqueado',
  },
]

export default function Onboarding() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance & KYC</h1>
        <p className="text-muted-foreground">Gestão de Cedentes, Sacados e análise de risco.</p>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="directory">Diretório</TabsTrigger>
          <TabsTrigger value="upload">Upload Center</TabsTrigger>
          <TabsTrigger value="risk">Análise IA</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Entidades Cadastradas</CardTitle>
              <CardDescription>
                Gerencie os participantes do fundo e seus limites de crédito.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status KYC</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {entity.name}
                      </TableCell>
                      <TableCell>{entity.type}</TableCell>
                      <TableCell className="font-mono text-xs">{entity.cnpj}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entity.status === 'Aprovado'
                              ? 'default'
                              : entity.status === 'Bloqueado'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className={
                            entity.status === 'Aprovado'
                              ? 'bg-secondary hover:bg-secondary/80 text-white'
                              : ''
                          }
                        >
                          {entity.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Dossiê
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-4 animate-fade-in">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-muted-foreground/25 rounded-lg mt-6 bg-muted/10">
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Arraste documentos KYC aqui</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Suporta Contrato Social, Balanços Financeiros e Certidões Negativas (PDF, ZIP).
              </p>
              <Button>Procurar Arquivos</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4 space-y-4 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent" />
                  Score de Bureau (Serasa/Boa Vista)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Agropecuária Sul S/A</span>
                    <span className="font-bold">850/1000</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Indústrias Metalmax</span>
                    <span className="font-bold">420/1000</span>
                  </div>
                  <Progress value={42} className="h-2 [&>div]:bg-warning" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary-foreground">
                  <BrainCircuit className="h-5 w-5" />
                  Sentimento Jurídico IA
                </CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Análise automatizada de 1.402 processos judiciais recentes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-md bg-white/10 backdrop-blur-sm border border-white/20">
                  <h4 className="font-semibold text-warning mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-warning animate-pulse"></span>
                    Alerta de Padrão
                  </h4>
                  <p className="text-sm leading-relaxed opacity-90">
                    Foi identificado um padrão incomum de processos tributários em Varas Federais de
                    SP contra a entidade{' '}
                    <span className="font-mono bg-black/30 px-1 rounded">Varejão Logística</span>. O
                    modelo sugere passivo oculto não provisionado no balanço de 2024. Recomendada
                    retenção de garantias adicionais.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
