import { CheckCircle2, XCircle, FileText, Upload, RefreshCcw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const borders = [
  {
    id: 'BOR-2024-001',
    cedente: 'Agropecuária Sul',
    amount: 'R$ 150.000',
    status: 'Validação Sefaz',
    items: 12,
  },
  {
    id: 'BOR-2024-002',
    cedente: 'Indústrias Metalmax',
    amount: 'R$ 85.400',
    status: 'Assinatura',
    items: 3,
  },
  {
    id: 'BOR-2024-003',
    cedente: 'Tech Solutions',
    amount: 'R$ 320.000',
    status: 'Concluído',
    items: 45,
  },
]

export default function Operations() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operações & Aquisição</h1>
          <p className="text-muted-foreground">Motor de validação de lastro, NF-e e assinaturas.</p>
        </div>
        <Button className="gap-2 bg-secondary hover:bg-secondary/90 text-white">
          <Upload className="h-4 w-4" />
          Novo Borderô XML
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fila de Borderôs</CardTitle>
              <CardDescription>Fluxo de trabalho de aquisição de recebíveis.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lote</TableHead>
                    <TableHead>Cedente</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Títulos</TableHead>
                    <TableHead>Fase Atual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {borders.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell className="font-medium">{b.cedente}</TableCell>
                      <TableCell>{b.amount}</TableCell>
                      <TableCell>{b.items}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-background">
                          {b.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grid de Lastro (Detalhado)</CardTitle>
              <CardDescription>Precificação unitária e cálculo de deságio.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NF-e / Cheque</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor Face</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead className="text-right text-accent font-bold">PU Aquisição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> 352401...55920
                    </TableCell>
                    <TableCell>15/Nov/2024</TableCell>
                    <TableCell>R$ 10.000,00</TableCell>
                    <TableCell>2.5% a.m.</TableCell>
                    <TableCell className="text-right font-mono font-medium">R$ 9.756,10</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> 352401...88102
                    </TableCell>
                    <TableCell>20/Nov/2024</TableCell>
                    <TableCell>R$ 15.000,00</TableCell>
                    <TableCell>2.5% a.m.</TableCell>
                    <TableCell className="text-right font-mono font-medium">R$ 14.500,00</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-accent/20 bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-accent" />
                Motor de Validação (Tempo Real)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2 p-2 rounded bg-background border">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-medium leading-none">SEFAZ Autorizada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    12/12 Notas validadas na receita.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-background border">
                <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium leading-none text-destructive">
                    Antiduplicidade Falhou
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A NF-e final 55920 já consta no fundo FDIC Beta.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Assinaturas Eletrônicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">Termo de Cessão #409</p>
                    <p className="text-xs text-warning">Aguardando Avalista</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Reenviar Link
                  </Button>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">Cédula de Crédito</p>
                    <p className="text-xs text-emerald-600">Concluído via DocuSign</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                    Visualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
