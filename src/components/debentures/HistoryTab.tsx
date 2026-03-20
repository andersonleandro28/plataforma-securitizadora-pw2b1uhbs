import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight, ListFilter, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

interface HistoryTabProps {
  debentures: any[]
  loading: boolean
  formatCurrency: (val: number) => string
}

export function HistoryTab({ debentures, loading, formatCurrency }: HistoryTabProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Uploads e Documentos</CardTitle>
        <CardDescription>Visualização de todas as escrituras processadas.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Data Processamento</TableHead>
              <TableHead>Emissor</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead className="text-right">Volume Total</TableHead>
              <TableHead className="text-center">Séries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : debentures.length > 0 ? (
              debentures.map((deb) => (
                <Fragment key={deb.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleRow(deb.id)}
                  >
                    <TableCell>
                      {expandedRows[deb.id] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(deb.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">{deb.issuer_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {deb.issue_date ? format(new Date(deb.issue_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(deb.total_volume)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded text-xs font-semibold">
                        {deb.series?.length || 0}
                      </span>
                    </TableCell>
                  </TableRow>
                  {expandedRows[deb.id] && deb.series && deb.series.length > 0 && (
                    <TableRow className="bg-muted/5 hover:bg-muted/5">
                      <TableCell colSpan={6} className="p-0 border-b">
                        <div className="p-4 pl-14 animate-in slide-in-from-top-2 duration-200">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <ListFilter className="h-4 w-4 text-primary" /> Detalhamento das Séries
                          </h4>
                          <div className="border rounded-md bg-background shadow-sm overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="text-xs h-8">Série</TableHead>
                                  <TableHead className="text-xs h-8">Indexador</TableHead>
                                  <TableHead className="text-xs h-8">Taxa (%)</TableHead>
                                  <TableHead className="text-xs h-8">Vencimento</TableHead>
                                  <TableHead className="text-right text-xs h-8">
                                    Volume (R$)
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {deb.series.map((s: any) => (
                                  <TableRow key={s.id}>
                                    <TableCell className="font-medium text-xs py-2">
                                      {s.series_number}
                                    </TableCell>
                                    <TableCell className="text-xs py-2">{s.indexer}</TableCell>
                                    <TableCell className="text-xs py-2">{s.rate}</TableCell>
                                    <TableCell className="text-xs py-2">
                                      {s.maturity_date
                                        ? format(new Date(s.maturity_date), 'dd/MM/yyyy')
                                        : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs py-2">
                                      {formatCurrency(s.volume)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  Nenhum documento processado ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
