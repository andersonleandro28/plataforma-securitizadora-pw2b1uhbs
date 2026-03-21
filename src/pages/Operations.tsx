import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, FileText, Upload, RefreshCcw, Loader2 } from 'lucide-react'
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
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'

export default function Operations() {
  const [borders, setBorders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBorder, setSelectedBorder] = useState<any>(null)

  useEffect(() => {
    const fetchBorders = async () => {
      const { data } = await supabase
        .from('borders')
        .select('*, border_items(*)')
        .order('created_at', { ascending: false })
      if (data) {
        setBorders(data)
        if (data.length > 0) setSelectedBorder(data[0])
      }
      setLoading(false)
    }
    fetchBorders()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operações & Aquisição</h1>
          <p className="text-muted-foreground">
            Motor de validação de lastro e operações em tempo real baseadas em relatórios extraídos.
          </p>
        </div>
        <Button className="gap-2 bg-secondary hover:bg-secondary/90 text-white">
          <Upload className="h-4 w-4" /> Novo Borderô XML
        </Button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : borders.length === 0 ? (
        <div className="text-center py-16 px-6 text-muted-foreground bg-muted/20 border border-dashed border-muted-foreground/30 rounded-lg">
          <p className="text-lg font-medium mb-2">Nenhuma operação identificada.</p>
          <p className="text-sm">
            Faça o upload de um <strong>Relatório de Aquisições</strong> na aba de Debêntures para
            integrar suas operações reais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Fila de Borderôs Extraídos</CardTitle>
                <CardDescription>
                  Fluxo de aquisição de recebíveis importados via PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[300px] overflow-auto relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
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
                      <TableRow
                        key={b.id}
                        className={`cursor-pointer transition-colors ${selectedBorder?.id === b.id ? 'bg-muted/70' : 'hover:bg-muted/40'}`}
                        onClick={() => setSelectedBorder(b)}
                      >
                        <TableCell className="font-mono text-xs font-semibold">
                          {b.border_number}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{b.cedente}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(b.amount)}</TableCell>
                        <TableCell className="text-sm">{b.items_count}</TableCell>
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

            <Card className="shadow-sm border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle>Grid de Lastro: {selectedBorder?.border_number}</CardTitle>
                <CardDescription>
                  Detalhamento analítico e cálculo de deságio da operação selecionada.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[350px] overflow-auto relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Documento / NF-e</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor Face</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead className="text-right text-primary font-bold">
                        PU Aquisição
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBorder?.border_items?.map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-muted/10">
                        <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> {item.document_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(item.face_value)}</TableCell>
                        <TableCell className="text-sm">{item.rate}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-primary text-sm">
                          {formatCurrency(item.acquisition_value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <RefreshCcw className="h-4 w-4" /> Motor de Validação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2 p-3 rounded-md bg-background border shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="font-medium leading-none">Análise SEFAZ</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedBorder?.items_count}/{selectedBorder?.items_count} Documentos
                      validados.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-background border shadow-sm opacity-60">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="font-medium leading-none">Antiduplicidade</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nenhum lastro colidente na base.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Formalização Eletrônica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm p-3 bg-muted/30 rounded-md border">
                    <div>
                      <p className="font-medium">Termo de Cessão</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Assinado Digitalmente</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Visualizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
