import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
import { useAuth } from '@/hooks/use-auth'
import { FileText, Printer, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function AccessLogs() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('access_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setLogs(data)
        setLoading(false)
      })
  }, [user])

  const exportCSV = () => {
    if (!logs.length) return toast.error('Nenhum log para exportar.')
    const headers = ['Data', 'Hora', 'Evento']
    const rows = logs.map((l) => {
      const d = new Date(l.created_at)
      return [d.toLocaleDateString('pt-BR'), d.toLocaleTimeString('pt-BR'), 'Login detectado']
    })
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `auditoria_acessos_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Logs exportados em CSV.')
  }

  const exportPDF = () => {
    if (!logs.length) return toast.error('Nenhum log para exportar.')
    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return toast.error('Permita pop-ups para gerar o PDF.')

    const html = `
      <html><head><title>Relatório de Acessos</title>
      <style>body{font-family:sans-serif;padding:20px;color:#333}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f5f5f5}</style>
      </head><body>
      <h2>Relatório de Auditoria de Acessos</h2>
      <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
      <table><thead><tr><th>Data</th><th>Hora</th><th>Evento</th></tr></thead><tbody>
      ${logs
        .map((l) => {
          const d = new Date(l.created_at)
          return `<tr><td>${d.toLocaleDateString('pt-BR')}</td><td>${d.toLocaleTimeString('pt-BR')}</td><td>Login detectado</td></tr>`
        })
        .join('')}
      </tbody></table>
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </body></html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Auditoria e Segurança
        </CardTitle>
        <CardDescription>Visualize e exporte seu histórico recente de acessos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 mb-4">
          <Button onClick={exportCSV} variant="outline" size="sm" disabled={loading}>
            <FileText className="mr-2 h-4 w-4" /> Exportar Logs (CSV)
          </Button>
          <Button onClick={exportPDF} variant="outline" size="sm" disabled={loading}>
            <Printer className="mr-2 h-4 w-4" /> Exportar Logs (PDF)
          </Button>
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                logs.map((log) => {
                  const d = new Date(log.created_at)
                  return (
                    <TableRow key={log.id}>
                      <TableCell>{d.toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{d.toLocaleTimeString('pt-BR')}</TableCell>
                      <TableCell>Login detectado</TableCell>
                    </TableRow>
                  )
                })}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Nenhum acesso registrado.
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
