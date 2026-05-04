import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Download, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react'

export function SubscriptionsTab() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(false)
    const { data: subs, error: err } = await supabase
      .from('debenture_subscriptions')
      .select(`
        id, investor_name, document_number, total_amount, subscription_date, status,
        debenture_series ( series_number, rate ),
        investments ( investment_products ( title, term ) )
      `)
      .order('subscription_date', { ascending: false })

    if (err) {
      console.error(err)
      setError(true)
    } else if (subs) {
      setData(subs)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('debenture_subscriptions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debenture_subscriptions' },
        () => {
          loadData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    return data.filter(
      (d) =>
        d.investor_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.document_number?.includes(search),
    )
  }, [data, search])

  const { activeCount, activeTotal, redeemedCount, redeemedTotal } = useMemo(() => {
    let aCount = 0
    let aTotal = 0
    let rCount = 0
    let rTotal = 0

    filtered.forEach((d) => {
      const status = d.status?.toLowerCase() || ''
      if (status === 'ativo') {
        aCount++
        aTotal += Number(d.total_amount || 0)
      } else if (status === 'resgatado' || status === 'encerrado') {
        rCount++
        rTotal += Number(d.total_amount || 0)
      }
    })

    return {
      activeCount: aCount,
      activeTotal: aTotal,
      redeemedCount: rCount,
      redeemedTotal: rTotal,
    }
  }, [filtered])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handleExport = () => {
    const csvData = filtered.map((d) => ({
      'Nome do Investidor': d.investor_name,
      'CPF/CNPJ': d.document_number,
      Série: d.debenture_series?.series_number,
      Produto: d.investments?.investment_products?.title || '',
      'Valor Aportado': d.total_amount,
      'Taxa Contratada': `${d.debenture_series?.rate}%`,
      'Data de Início': d.subscription_date
        ? new Date(d.subscription_date).toLocaleDateString('pt-BR')
        : '',
      Status: d.status,
    }))
    exportToCSV(csvData, 'subscricoes.csv')
  }

  return (
    <div className="space-y-4">
      {/* TOTALIZADORES */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-full dark:bg-green-900/20 dark:text-green-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Subscrições Ativas</p>
                {loading ? (
                  <Skeleton className="h-8 w-1/2 mt-1" />
                ) : error ? (
                  <div className="flex items-center space-x-2 mt-1 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Erro ao carregar</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 ml-2" onClick={loadData}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">{formatCurrency(activeTotal)}</h2>
                    <p className="text-xs text-muted-foreground">
                      {activeCount} subscrições ativas
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full dark:bg-red-900/20 dark:text-red-400">
                <TrendingDown className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Subscrições Resgatadas</p>
                {loading ? (
                  <Skeleton className="h-8 w-1/2 mt-1" />
                ) : error ? (
                  <div className="flex items-center space-x-2 mt-1 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Erro ao carregar</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 ml-2" onClick={loadData}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">{formatCurrency(redeemedTotal)}</h2>
                    <p className="text-xs text-muted-foreground">
                      {redeemedCount} subscrições resgatadas
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABELA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Relatório de Subscrições</CardTitle>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={loading || error || filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por investidor ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
            disabled={loading || error}
          />
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investidor</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Valor Aportado</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-[220px]" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-destructive">
                      Erro ao carregar dados. Tente novamente mais tarde.
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.investor_name}</TableCell>
                      <TableCell>{item.document_number}</TableCell>
                      <TableCell>{formatCurrency(item.total_amount)}</TableCell>
                      <TableCell>{item.debenture_series?.rate}%</TableCell>
                      <TableCell>
                        {item.subscription_date
                          ? new Date(item.subscription_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell>{item.status}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
