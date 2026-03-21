import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { UploadCloud, Loader2, CheckCircle2, FileText, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Step = 'upload' | 'processing' | 'review' | 'success'

interface DeedUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeedUploadDialog({ open, onOpenChange, onSuccess }: DeedUploadDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [data, setData] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [docType, setDocType] = useState<'subscription' | 'investors' | 'operations'>(
    'subscription',
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('upload')
    setData(null)
    setSaving(false)
    setDocType('subscription')
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) reset()
    onOpenChange(isOpen)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep('processing')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('deeds').upload(fileName, file)
      if (uploadError) throw new Error('Falha no upload para o storage seguro.')

      const { data: resData, error } = await supabase.functions.invoke('extract-debenture-data', {
        body: { filePath: fileName, originalName: file.name, docType },
      })

      if (error) throw error
      if (resData?.error) throw new Error(resData.error)

      setData(resData.data)
      setStep('review')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao processar documento.')
      setStep('upload')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (data.type === 'subscription') {
        const { data: debData, error: debErr } = await supabase
          .from('debentures')
          .insert({
            issuer_name: data.issuer_name,
            total_volume: data.total_volume,
            issue_date: data.issue_date,
          })
          .select('id')
          .single()
        if (debErr) throw debErr

        const seriesToInsert = data.series.map((s: any) => ({ debenture_id: debData.id, ...s }))
        await supabase.from('debenture_series').insert(seriesToInsert)
        await supabase.from('investment_products').insert(data.products)
      } else if (data.type === 'investors') {
        const { error } = await supabase.functions.invoke('batch-import-users', {
          body: { users: data.profiles },
        })
        if (error) throw error
      } else if (data.type === 'operations') {
        for (const border of data.borders) {
          const { data: borderData, error: borderErr } = await supabase
            .from('borders')
            .insert({
              border_number: border.border_number,
              cedente: border.cedente,
              amount: border.amount,
              status: border.status,
              items_count: border.items_count,
            })
            .select('id')
            .single()
          if (borderErr) throw borderErr

          const itemsToInsert = border.items.map((i: any) => ({ border_id: borderData.id, ...i }))
          await supabase.from('border_items').insert(itemsToInsert)
        }
      }

      setStep('success')
      toast.success('Documento processado e importado com sucesso!')
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar os dados no banco.')
    } finally {
      setSaving(false)
    }
  }

  const updateSeries = (index: number, field: string, val: string | number) => {
    if (data.type !== 'subscription') return
    const newSeries = [...data.series]
    newSeries[index] = { ...newSeries[index], [field]: val }
    setData({ ...data, series: newSeries })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Processamento Inteligente de Documentos
          </DialogTitle>
          <DialogDescription>
            Faça o upload do documento original. A IA fará a leitura e identificará os dados com
            base no tipo selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px] flex flex-col justify-center">
          {step === 'upload' && (
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto py-6">
              <div className="space-y-2">
                <Label className="text-primary font-semibold">Qual o tipo de documento?</Label>
                <Select value={docType} onValueChange={(val: any) => setDocType(val)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">
                      Listagem de Subscrição (Produtos/Séries)
                    </SelectItem>
                    <SelectItem value="investors">
                      Debenturistas / Investidores (Cadastros)
                    </SelectItem>
                    <SelectItem value="operations">Relatório de Aquisições (Borderôs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                className="border-2 border-dashed border-primary/25 bg-muted/10 rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                />
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-primary">Selecione o arquivo</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Documentos em PDF ou Word (máx. 25MB)
                </p>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="relative">
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Processando e Extraindo Dados...</h3>
                <p className="text-sm text-muted-foreground animate-pulse mt-1">
                  Analisando contexto estrutural do PDF via IA...
                </p>
              </div>
            </div>
          )}

          {step === 'review' && data && (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-md flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-primary">Extração Concluída</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Os dados foram estruturados com sucesso. Valide as informações abaixo antes da
                    gravação final.
                  </p>
                </div>
              </div>

              {data.type === 'subscription' && (
                <>
                  <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Emissor</Label>
                      <Input
                        className="h-9"
                        value={data.issuer_name}
                        onChange={(e) => setData({ ...data, issuer_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Volume Total (R$)</Label>
                      <Input
                        type="number"
                        className="h-9 font-mono"
                        value={data.total_volume}
                        onChange={(e) => setData({ ...data, total_volume: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-3 flex items-center justify-between">
                      <span>Listagem das {data.series.length} Séries</span>
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                        Auditoria de Dados
                      </span>
                    </Label>
                    <div className="border rounded-md overflow-auto max-h-[250px] shadow-sm relative">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="w-16">Série</TableHead>
                            <TableHead className="w-24">Indexador</TableHead>
                            <TableHead className="w-24">Taxa (%)</TableHead>
                            <TableHead className="w-36">Vencimento</TableHead>
                            <TableHead className="text-right">Volume (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.series.map((s: any, i: number) => (
                            <TableRow key={i} className="hover:bg-muted/10">
                              <TableCell className="p-2">
                                <Input
                                  className="h-8 w-16 text-xs text-center"
                                  value={s.series_number}
                                  onChange={(e) => updateSeries(i, 'series_number', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  className="h-8 w-20 text-xs"
                                  value={s.indexer}
                                  onChange={(e) => updateSeries(i, 'indexer', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  className="h-8 w-20 text-xs"
                                  value={s.rate}
                                  step="0.01"
                                  onChange={(e) => updateSeries(i, 'rate', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="date"
                                  className="h-8 w-32 text-xs"
                                  value={s.maturity_date}
                                  onChange={(e) => updateSeries(i, 'maturity_date', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <Input
                                  type="number"
                                  className="h-8 w-full min-w-[100px] text-xs font-mono text-right"
                                  value={s.volume}
                                  onChange={(e) =>
                                    updateSeries(i, 'volume', Number(e.target.value))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {data.type === 'investors' && (
                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Listagem de {data.profiles.length} Perfis Extraídos
                  </Label>
                  <div className="border rounded-md overflow-auto max-h-[250px] shadow-sm relative">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow>
                          <TableHead>Nome Completo</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>CPF / CNPJ</TableHead>
                          <TableHead>Classificação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.profiles.map((p: any, i: number) => (
                          <TableRow key={i} className="hover:bg-muted/10">
                            <TableCell className="text-xs font-medium">{p.full_name}</TableCell>
                            <TableCell className="text-xs">{p.email}</TableCell>
                            <TableCell className="text-xs font-mono">{p.document_number}</TableCell>
                            <TableCell className="text-xs capitalize">
                              {p.role === 'investor' ? 'Investidor' : 'Tomador'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {data.type === 'operations' && (
                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Listagem de {data.borders.length} Operações Identificadas
                  </Label>
                  <div className="border rounded-md overflow-auto max-h-[250px] shadow-sm relative">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow>
                          <TableHead>Lote (Borderô)</TableHead>
                          <TableHead>Cedente</TableHead>
                          <TableHead>Volume Total</TableHead>
                          <TableHead>Total de Títulos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.borders.map((b: any, i: number) => (
                          <TableRow key={i} className="hover:bg-muted/10">
                            <TableCell className="text-xs font-mono">{b.border_number}</TableCell>
                            <TableCell className="text-xs">{b.cedente}</TableCell>
                            <TableCell className="text-xs font-mono text-primary">
                              R$ {b.amount.toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="text-xs">{b.items_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 animate-in zoom-in-95">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-xl">Importação Realizada!</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Os dados reais do documento foram gravados no sistema com sucesso.
              </p>
              <Button onClick={() => handleOpenChange(false)} className="mt-6 w-32">
                Fechar
              </Button>
            </div>
          )}
        </div>

        {step === 'review' && (
          <DialogFooter className="border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar e Descartar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Aprovar Gravação Real
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
