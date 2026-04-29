import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { Download } from 'lucide-react'

export function SubscriptionsTab() {
  const [data, setData] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadData() {
      const { data: subs } = await supabase
        .from('debenture_subscriptions')
        .select(`
          id, investor_name, document_number, total_amount, subscription_date, status,
          debenture_series ( series_number, rate ),
          investments ( investment_products ( title, term ) )
        `)
        .order('subscription_date', { ascending: false })
      if (subs) setData(subs)
    }
    loadData()
  }, [])

  const filtered = data.filter(
    (d) =>
      d.investor_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.document_number?.includes(search),
  )

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Subscrição de Debêntures</CardTitle>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar por investidor ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
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
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.investor_name}</TableCell>
                  <TableCell>{item.document_number}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      item.total_amount,
                    )}
                  </TableCell>
                  <TableCell>{item.debenture_series?.rate}%</TableCell>
                  <TableCell>
                    {item.subscription_date
                      ? new Date(item.subscription_date).toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Nenhum registro encontrado
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
