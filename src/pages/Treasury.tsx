import { Wallet, ArrowDownRight, ArrowUpRight, Lock, Unlock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Treasury() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tesouraria & Escrow</h1>
          <p className="text-muted-foreground">
            Conciliação bancária e gestão de contas vinculadas.
          </p>
        </div>
        <Button className="bg-primary">Exportar Relatório de Caixa</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">
              Saldo Conta Principal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">R$ 2.450.000,00</div>
            <div className="mt-4 space-y-1">
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> Entradas Hoje: R$ 150k
              </p>
              <p className="text-xs text-destructive flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Saídas Hoje: R$ 45k
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/30 bg-accent/5 md:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-accent" /> Conta Escrow (Garantias)
              </CardTitle>
              <CardDescription>
                Fundo de reserva para comissões e despesas do fundo.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2 bg-accent hover:bg-accent/90 text-white">
              <Unlock className="h-4 w-4" /> Liberar Recursos
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-accent mt-2">R$ 850.000,00</div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo bloqueado conforme regulamento (Min: R$ 500k).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Extrato Conciliado (Via API Open Finance)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">Hoje, 09:45</TableCell>
                <TableCell className="font-medium">Liq. Boleto - Sacado Ind. Metalmax</TableCell>
                <TableCell>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    Recebimento
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-600">
                  + R$ 45.000,00
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">Ontem, 16:30</TableCell>
                <TableCell className="font-medium">Pagamento Aquisição Borderô #4090</TableCell>
                <TableCell>
                  <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                    Pagamento
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">- R$ 120.500,00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs text-muted-foreground">Ontem, 10:15</TableCell>
                <TableCell className="font-medium">
                  Taxa Adm. Gestora (Transferência Escrow)
                </TableCell>
                <TableCell>
                  <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded">
                    Transferência
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-accent">- R$ 15.000,00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
