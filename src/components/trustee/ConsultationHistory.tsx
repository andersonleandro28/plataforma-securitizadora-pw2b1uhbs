import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, History } from 'lucide-react'
import type { SerasaConsultationRecord } from '@/services/serasa'
import { toast } from 'sonner'

const maskDoc = (doc: string) => {
  const clean = doc.replace(/\D/g, '')
  if (clean.length === 11) return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`
  if (clean.length === 14) return `**.*${clean.substring(2, 5)}.${clean.substring(5, 8)}/****-**`
  return '***'
}

const exportPDF = (record: SerasaConsultationRecord) => {
  try {
    const printWindow = window.open('', '_blank')
    if (!printWindow) throw new Error('Bloqueador de pop-ups ativo')

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Serasa - ${record.document_number}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #0f172a; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 32px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
            .item { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9; }
            .label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
            .value { font-size: 20px; font-weight: 500; margin-top: 8px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 500; margin-top: 8px; }
            .badge-baixo { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .badge-médio { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }
            .badge-alto { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
            .disclaimer { margin-top: 48px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 24px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>Plataforma Securitizadora<br><span style="font-size: 18px; color: #64748b; font-weight: normal;">Relatório Oficial de Análise de Crédito</span></h1>
          <div class="grid">
            <div class="item">
              <div class="label">Data da Consulta</div>
              <div class="value">${new Date(record.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div class="item">
              <div class="label">Documento Analisado</div>
              <div class="value">${record.document_number}</div>
            </div>
            <div class="item">
              <div class="label">Score Serasa</div>
              <div class="value">${record.score} <span style="font-size: 14px; color: #94a3b8;">/ 1000</span></div>
            </div>
            <div class="item">
              <div class="label">Classificação de Risco</div>
              <div class="badge badge-${record.risk_level.toLowerCase()}">Risco ${record.risk_level}</div>
            </div>
          </div>
          <div class="disclaimer">
            <strong>Aviso de Confidencialidade:</strong> Este relatório é gerado automaticamente e destinado exclusivamente para uso interno e processos de auditoria.
            Os dados refletem a análise no momento da consulta e não constituem recomendação, endosso ou garantia de aprovação de crédito.
          </div>
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
    toast.success('Relatório PDF gerado com sucesso.')
  } catch (err) {
    toast.error(
      'Não foi possível gerar o PDF. Verifique se há um bloqueador de pop-ups ativo no seu navegador.',
    )
  }
}

export function ConsultationHistory({ history }: { history: SerasaConsultationRecord[] }) {
  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Histórico de Consultas
        </CardTitle>
        <CardDescription>Registro persistente das análises realizadas</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg text-muted-foreground">
            Nenhuma consulta registrada no histórico ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(record.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-mono">{maskDoc(record.document_number)}</TableCell>
                  <TableCell className="font-medium">{record.score}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        record.risk_level === 'Alto'
                          ? 'destructive'
                          : record.risk_level === 'Médio'
                            ? 'secondary'
                            : 'default'
                      }
                    >
                      {record.risk_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => exportPDF(record)}>
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" /> Exportar PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
