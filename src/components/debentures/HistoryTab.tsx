import { useState } from 'react'
import { ChevronDown, ChevronRight, ListFilter, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface HistoryTabProps {
  debentures: any[]
  loading: boolean
  formatCurrency: (val: number) => string
  onDeleteSuccess: () => void
}

export function HistoryTab({
  debentures,
  loading,
  formatCurrency,
  onDeleteSuccess,
}: HistoryTabProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('debentures').delete().eq('id', id)
      if (error) throw error
      toast.success('Documento e séries excluídos com sucesso!')
      onDeleteSuccess()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir o registro.')
    } finally {
      setDeletingId(null)
    }
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
              <TableHead className="text-center w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : debentures.length > 0 ? (
              debentures.map((deb) => {
                const rows = [
                  <TableRow
                    key={deb.id}
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
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === deb.id}
                          >
                            {deletingId === deb.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o processamento da escritura de{' '}
                              <strong className="text-foreground">{deb.issuer_name}</strong>? Esta
                              ação removerá todas as {deb.series?.length || 0} séries associadas e
                              não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault()
                                handleDelete(deb.id)
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Sim, Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>,
                ]

                if (expandedRows[deb.id] && deb.series && deb.series.length > 0) {
                  rows.push(
                    <TableRow key={`${deb.id}-expanded`} className="bg-muted/5 hover:bg-muted/5">
                      <TableCell colSpan={7} className="p-0 border-b">
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
                    </TableRow>,
                  )
                }

                return rows
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
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
