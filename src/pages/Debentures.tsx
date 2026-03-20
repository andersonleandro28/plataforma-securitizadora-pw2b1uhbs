import { useState } from 'react'
import { Calculator, AlertTriangle, CalendarDays, FileUp } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeedUploadDialog } from '@/components/debentures/DeedUploadDialog'

export default function Debentures() {
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Passivos (Debêntures)</h1>
          <p className="text-muted-foreground">
            Acompanhamento de séries, cálculo de PU e amortizações.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2 shadow-sm">
          <FileUp className="h-4 w-4" />
          Upload Inteligente de Escritura
        </Button>
      </div>

      <Alert
        variant="destructive"
        className="bg-warning/10 text-warning-foreground border-warning/50"
      >
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning font-bold">Alerta ALM de Curto Prazo</AlertTitle>
        <AlertDescription className="text-foreground/80">
          O vencimento médio do lastro (45 dias) está inferior à próxima amortização da Série 1 (15
          dias). Necessário provisionar caixa na tesouraria.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-t-4 border-t-accent">
          <CardHeader>
            <CardTitle>Série 1 - Sênior</CardTitle>
            <CardDescription>Indexador: CDI + 2.5% a.a.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Volume Emitido</span>
              <span className="font-mono font-medium">R$ 50.000.000,00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">PU Atual Atualizado</span>
              <span className="font-mono font-bold text-accent">1.045,32190</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Próxima Amortização</span>
              <span className="text-sm">15/Out/2024</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Série 2 - Subordinada</CardTitle>
            <CardDescription>Indexador: IPCA + 6.0% a.a.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Volume Emitido</span>
              <span className="font-mono font-medium">R$ 15.000.000,00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">PU Atual Atualizado</span>
              <span className="font-mono font-bold text-primary">1.102,88410</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Próxima Amortização</span>
              <span className="text-sm">No Vencimento (Bullet)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Calculadora de PU
            </CardTitle>
            <CardDescription>Simulação de marcação a mercado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Data Base</Label>
              <Input type="date" defaultValue="2024-10-01" />
            </div>
            <div className="space-y-2">
              <Label>Taxa CDI Projetada (%)</Label>
              <Input type="number" defaultValue="10.5" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label>Spread Contratual (%)</Label>
              <Input type="number" defaultValue="2.5" disabled />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Simular PU</Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Cronograma de Amortização (Série 1)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Juros (Estimado)</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="opacity-50">
                  <TableCell>Pagamento #01</TableCell>
                  <TableCell>15/Jul/2024</TableCell>
                  <TableCell className="font-mono text-xs">R$ 450.000</TableCell>
                  <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                  <TableCell>Liquidado</TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Pagamento #02</TableCell>
                  <TableCell>15/Out/2024</TableCell>
                  <TableCell className="font-mono text-xs">R$ 445.000</TableCell>
                  <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                  <TableCell className="text-warning font-medium">A Vencer</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Pagamento #03</TableCell>
                  <TableCell>15/Jan/2025</TableCell>
                  <TableCell className="font-mono text-xs">R$ 430.000</TableCell>
                  <TableCell className="font-mono text-xs">R$ 1.000.000</TableCell>
                  <TableCell>Projetado</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <DeedUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
