import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { format } from 'date-fns'

interface SeriesListTabProps {
  debentures: any[]
  loading: boolean
  formatCurrency: (val: number) => string
}

export function SeriesListTab({ debentures, loading, formatCurrency }: SeriesListTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [indexerFilter, setIndexerFilter] = useState('all')

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestão Granular de Séries</CardTitle>
        <CardDescription>
          Visualize e filtre todas as séries cadastradas nas escrituras de forma independente.
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
                <TableHead>Indexador</TableHead>
                <TableHead>Taxa (%)</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Volume (R$)</TableHead>
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
                        {s.indexer}
                      </span>
                    </TableCell>
                    <TableCell>{s.rate}</TableCell>
                    <TableCell>
                      {s.maturity_date ? format(new Date(s.maturity_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(s.volume)}
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
    </Card>
  )
}
