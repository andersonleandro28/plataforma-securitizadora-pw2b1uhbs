import { useState } from 'react'
import { Search, Loader2, Users, Edit2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ManageSubscriptionsDialog } from './ManageSubscriptionsDialog'
import { EditSeriesDialog } from './EditSeriesDialog'

interface SeriesListTabProps {
  debentures: any[]
  loading: boolean
  formatCurrency: (val: number) => string
  onRefresh: () => void
}

const formatDateStr = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function SeriesListTab({
  debentures,
  loading,
  formatCurrency,
  onRefresh,
}: SeriesListTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [indexerFilter, setIndexerFilter] = useState('all')
  const [manageSeriesId, setManageSeriesId] = useState<string | null>(null)
  const [editSeriesId, setEditSeriesId] = useState<string | null>(null)

  const allSeries = debentures.flatMap((d) =>
    (d.series || []).map((s: any) => ({
      ...s,
      issuer_name: d.issuer_name,
      issue_date: d.issue_date,
      debenture_id: d.id,
    })),
  )

  const filteredSeries = allSeries.filter((s) => {
    const matchesSearch =
      String(s.series_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.issuer_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesIndexer = indexerFilter === 'all' || s.indexer === indexerFilter
    return matchesSearch && matchesIndexer
  })

  const uniqueIndexers = Array.from(new Set(allSeries.map((s) => s.indexer))).filter(
    Boolean,
  ) as string[]

  const manageSeries = allSeries.find((s) => s.id === manageSeriesId) || null
  const editSeries = allSeries.find((s) => s.id === editSeriesId) || null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão Granular de Séries</CardTitle>
        <CardDescription>
          Visualize e filtre todas as séries cadastradas nas escrituras de forma independente e
          gerencie as subscrições diretamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por emissor ou número da série..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={indexerFilter} onValueChange={setIndexerFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos os Indexadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Indexadores</SelectItem>
              {uniqueIndexers.map((idx) => (
                <SelectItem key={idx} value={idx}>
                  {idx}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-auto max-h-[600px] relative">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead>Série</TableHead>
                <TableHead>Emissor</TableHead>
                <TableHead>Indexador e Taxa</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Volume (R$)</TableHead>
                <TableHead className="text-center w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredSeries.length > 0 ? (
                filteredSeries.map((s, idx) => (
                  <TableRow key={`${s.debenture_id}-${s.id}-${idx}`}>
                    <TableCell className="font-medium">{s.series_number}</TableCell>
                    <TableCell>{s.issuer_name}</TableCell>
                    <TableCell>
                      <span className="bg-secondary px-2 py-0.5 rounded text-xs font-medium">
                        {s.indexer} + {s.rate}%
                      </span>
                    </TableCell>
                    <TableCell>{formatDateStr(s.maturity_date)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(s.volume)}
                    </TableCell>
                    <TableCell className="text-center space-x-1 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => setManageSeriesId(s.id)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Subs ({s.debenture_subscriptions?.length || 0})
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setEditSeriesId(s.id)}
                        title="Editar Série"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                    Nenhuma série encontrada para os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <ManageSubscriptionsDialog
        series={manageSeries}
        open={!!manageSeriesId}
        onOpenChange={(op: boolean) => {
          if (!op) setManageSeriesId(null)
        }}
        onSuccess={onRefresh}
      />

      <EditSeriesDialog
        series={editSeries}
        debentures={debentures}
        open={!!editSeriesId}
        onOpenChange={(op: boolean) => {
          if (!op) setEditSeriesId(null)
        }}
        onSuccess={onRefresh}
      />
    </Card>
  )
}
