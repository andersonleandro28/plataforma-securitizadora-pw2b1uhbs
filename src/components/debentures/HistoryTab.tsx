import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
  Loader2,
  Trash2,
  Printer,
  PlusCircle,
} from 'lucide-react'
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
import { AddSeriesDialog } from './AddSeriesDialog'
import { formatDate } from '@/lib/utils'

interface HistoryTabProps {
  debentures: any[]
  loading: boolean
  formatCurrency: (val: number) => string
  onRefresh: () => void
}

export function HistoryTab({ debentures, loading, formatCurrency, onRefresh }: HistoryTabProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingSeriesFor, setAddingSeriesFor] = useState<any>(null)

  const toggleRow = (id: string) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase.from('debentures').delete().eq('id', id)
      if (error) throw error
      toast.success('Documento e séries excluídos com sucesso!')
      onRefresh()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao excluir o registro.')
    } finally {
      setDeletingId(null)
    }
  }

  const generatePDF = (deb: any) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error(
        'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.',
      )
      return
    }

    const html = `
      <html>
        <head>
          <title>Escritura - ${deb.issuer_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; max-width: 900px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
            .meta { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background-color: #f1f5f9; color: #475569; font-weight: 600; }
            .section { margin-top: 40px; }
            .right { text-align: right; }
            .series-card { margin-bottom: 30px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; page-break-inside: avoid; }
            .series-card h3 { margin-top: 0; color: #1e293b; font-size: 18px; }
            .empty { color: #64748b; font-style: italic; font-size: 13px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Espelho de Escritura de Debêntures</h1>
          <div class="meta">
            <p><strong>Emissor:</strong> ${deb.issuer_name}</p>
            <p><strong>Data de Emissão:</strong> ${formatDate(deb.issue_date)}</p>
            <p><strong>Volume Total da Emissão:</strong> R$ ${deb.total_volume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Gerado em:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          
          <div class="section">
            <h2 style="font-size: 20px; color: #0f172a;">Detalhamento das Séries e Subscrições</h2>
            ${(deb.series || [])
              .map(
                (s: any) => `
              <div class="series-card">
                <h3>Série ${s.series_number}</h3>
                <div style="display: flex; gap: 20px; margin-bottom: 15px; font-size: 14px;">
                  <div><strong>Indexador:</strong> ${s.indexer} + ${s.rate}% a.a.</div>
                  <div><strong>Volume:</strong> R$ ${s.volume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div><strong>Vencimento:</strong> ${formatDate(s.maturity_date)}</div>
                </div>
                
                <h4 style="margin-bottom: 10px; font-size: 15px;">Subscrições Realizadas</h4>
                ${
                  s.debenture_subscriptions && s.debenture_subscriptions.length > 0
                    ? `
                  <table>
                    <thead>
                      <tr>
                        <th>Investidor</th>
                        <th>CPF/CNPJ</th>
                        <th class="right">Qtd.</th>
                        <th class="right">PU (R$)</th>
                        <th class="right">Total (R$)</th>
                        <th>Data Subs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${s.debenture_subscriptions
                        .map(
                          (sub: any) => `
                        <tr>
                          <td>${sub.investor_name}</td>
                          <td>${sub.document_number || '-'}</td>
                          <td class="right">${sub.quantity}</td>
                          <td class="right">${sub.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td class="right">${sub.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td>${formatDate(sub.subscription_date)}</td>
                        </tr>
                      `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
                    : '<p class="empty">Nenhuma subscrição cadastrada nesta série até o momento.</p>'
                }
              </div>
            `,
              )
              .join('')}
            ${!deb.series || deb.series.length === 0 ? '<p class="empty">Nenhuma série cadastrada.</p>' : ''}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Uploads e Documentos</CardTitle>
        <CardDescription>
          Visualização de todas as escrituras processadas e exportação em formato PDF.
        </CardDescription>
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
              <TableHead className="text-center w-[150px]">Ações</TableHead>
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
                      {formatDate(deb.issue_date)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(deb.total_volume)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded text-xs font-semibold">
                        {deb.series?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-center space-x-1 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setAddingSeriesFor(deb)}
                        title="Adicionar Série"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => generatePDF(deb)}
                        title="Gerar Espelho (PDF)"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === deb.id}
                            title="Excluir Escritura"
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
                              ação removerá todas as séries e subscrições associadas e não pode ser
                              desfeita.
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

                if (expandedRows[deb.id]) {
                  rows.push(
                    <TableRow key={`${deb.id}-expanded`} className="bg-muted/5 hover:bg-muted/5">
                      <TableCell colSpan={7} className="p-0 border-b">
                        <div className="p-4 pl-14 animate-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <ListFilter className="h-4 w-4 text-primary" /> Detalhamento das
                              Séries
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 bg-background"
                              onClick={() => setAddingSeriesFor(deb)}
                            >
                              <PlusCircle className="h-3.5 w-3.5" /> Adicionar Série
                            </Button>
                          </div>

                          {deb.series && deb.series.length > 0 ? (
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
                                        {formatDate(s.maturity_date)}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-xs py-2">
                                        {formatCurrency(s.volume)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-sm text-muted-foreground bg-background border rounded-md border-dashed">
                              Nenhuma série vinculada a esta escritura ainda.
                            </div>
                          )}
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

      <AddSeriesDialog
        debenture={addingSeriesFor}
        open={!!addingSeriesFor}
        onOpenChange={(op) => {
          if (!op) setAddingSeriesFor(null)
        }}
        onSuccess={() => {
          onRefresh()
          setAddingSeriesFor(null)
        }}
      />
    </Card>
  )
}
