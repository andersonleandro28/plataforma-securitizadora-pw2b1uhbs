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
import { UploadCloud, Loader2, CheckCircle2, FileText, Bot, Trash2, Plus } from 'lucide-react'
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
      if (uploadError)
        throw new Error(`Falha no upload para o storage seguro: ${uploadError.message}`)

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
        if (!data.series || data.series.length === 0) {
          throw new Error('Nenhuma série extraída. Verifique os dados no grid antes de prosseguir.')
        }

        const { data: debData, error: debErr } = await supabase
          .from('debentures')
          .insert({
            issuer_name: data.issuer_name || 'Emissor Não Identificado',
            total_volume: Number(data.total_volume) || 0,
            issue_date: data.issue_date || new Date().toISOString().split('T')[0],
          })
          .select('id')
          .single()

        if (debErr) throw new Error(`Erro ao registrar debênture: ${debErr.message}`)

        const seriesToInsert = data.series.map((s: any) => ({
          debenture_id: debData.id,
          series_number: String(s.series_number || '001'),
          volume: Number(s.volume || 0),
          indexer: String(s.indexer || 'CDI'),
          rate: Number(s.rate || 0),
          maturity_date: s.maturity_date ? String(s.maturity_date) : null,
        }))

        const { error: seriesErr } = await supabase.from('debenture_series').insert(seriesToInsert)
        if (seriesErr) throw new Error(`Erro ao registrar séries: ${seriesErr.message}`)

        if (data.products && data.products.length > 0) {
          const productsToInsert = data.products.map((p: any) => ({
            ...p,
            progress: Number(p.progress || 0),
            min_investment: Number(p.min_investment || 0),
          }))
          const { error: prodErr } = await supabase
            .from('investment_products')
            .insert(productsToInsert)
          if (prodErr) console.error('Erro ao registrar produto de investimento:', prodErr)
        }
      } else if (data.type === 'investors') {
        const validProfiles = data.profiles.filter(
          (p: any) => p.email && p.full_name && p.document_number,
        )

        if (validProfiles.length === 0) {
          throw new Error('Nenhum investidor válido para importar. Verifique os dados.')
        }

        const { error } = await supabase.functions.invoke('batch-import-users', {
          body: { users: validProfiles },
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

          if (borderErr) throw new Error(`Erro ao registrar borderô: ${borderErr.message}`)

          const itemsToInsert = border.items.map((i: any) => ({ border_id: borderData.id, ...i }))
          const { error: itemsErr } = await supabase.from('border_items').insert(itemsToInsert)
          if (itemsErr) throw new Error(`Erro ao registrar itens do borderô: ${itemsErr.message}`)
        }
      }

      setStep('success')
      toast.success('Documento processado e importado com sucesso!')
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar os dados.')
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

  const updateInvestor = (index: number, field: string, val: string) => {
    if (data.type !== 'investors') return
    const newProfiles = [...data.profiles]
    newProfiles[index] = { ...newProfiles[index], [field]: val }
    setData({ ...data, profiles: newProfiles })
  }

  const removeInvestor = (index: number) => {
    if (data.type !== 'investors') return
    const newProfiles = data.profiles.filter((_: any, i: number) => i !== index)
    setData({ ...data, profiles: newProfiles })
  }

  const addInvestor = () => {
    if (data.type !== 'investors') return
    const newProfiles = [
      ...data.profiles,
      { full_name: '', email: '', document_number: '', role: 'investor' },
    ]
    setData({ ...data, profiles: newProfiles })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Processamento Inteligente de Documentos
          </DialogTitle>
          <DialogDescription>
            Faça o upload do documento original. A IA fará a leitura e identificará os dados com
            base no tipo selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-[300px] flex flex-col justify-center py-2 pr-2">
          {step === 'upload' && (
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto py-6">
              <div className="space-y-2">
                <Label className="text-primary font-semibold">Qual o tipo de documento?</Label>
                <Select value={docType} onValueChange={(val: any) => setDocType(val)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Escritura de Debêntures</SelectItem>
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
                  Analisando contexto estrutural do arquivo via IA...
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
                    Os dados foram estruturados com sucesso. Você pode <strong>editar</strong> as
                    informações diretamente na tabela abaixo antes da gravação final.
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
                        value={data.issuer_name || ''}
                        onChange={(e) => setData({ ...data, issuer_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Volume Total (R$)</Label>
                      <Input
                        type="number"
                        className="h-9 font-mono"
                        value={data.total_volume || ''}
                        onChange={(e) => setData({ ...data, total_volume: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center justify-between">
                      <span>Listagem das {data.series?.length || 0} Séries</span>
                      <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                        Auditoria de Dados
                      </span>
                    </Label>
                    <div className="border rounded-md overflow-auto shadow-sm relative">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-20">Série</TableHead>
                            <TableHead className="w-28">Indexador</TableHead>
                            <TableHead className="w-24">Taxa (%)</TableHead>
                            <TableHead className="w-36">Vencimento</TableHead>
                            <TableHead className="text-right">Volume (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.series?.map((s: any, i: number) => (
                            <TableRow key={i} className="hover:bg-muted/10">
                              <TableCell className="p-2">
                                <Input
                                  className="h-8 w-20 text-xs text-center"
                                  value={s.series_number || ''}
                                  onChange={(e) => updateSeries(i, 'series_number', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  className="h-8 w-24 text-xs"
                                  value={s.indexer || ''}
                                  onChange={(e) => updateSeries(i, 'indexer', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="number"
                                  className="h-8 w-20 text-xs"
                                  value={s.rate !== undefined ? s.rate : ''}
                                  step="0.01"
                                  onChange={(e) => updateSeries(i, 'rate', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  type="date"
                                  className="h-8 w-32 text-xs"
                                  value={s.maturity_date || ''}
                                  onChange={(e) => updateSeries(i, 'maturity_date', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <Input
                                  type="number"
                                  className="h-8 w-full min-w-[100px] text-xs font-mono text-right"
                                  value={s.volume !== undefined ? s.volume : ''}
                                  onChange={(e) => updateSeries(i, 'volume', e.target.value)}
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      Listagem de {data.profiles?.length || 0} Perfis Extraídos
                    </Label>
                    <Button variant="outline" size="sm" onClick={addInvestor} className="h-8 gap-1">
                      <Plus className="h-3.5 w-3.5" /> Adicionar Manualmente
                    </Button>
                  </div>
                  <div className="border rounded-md overflow-x-auto shadow-sm relative max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="min-w-[200px]">Nome Completo</TableHead>
                          <TableHead className="min-w-[200px]">E-mail</TableHead>
                          <TableHead className="w-40">CPF / CNPJ</TableHead>
                          <TableHead className="w-36">Classificação</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.profiles?.map((p: any, i: number) => (
                          <TableRow key={i} className="hover:bg-muted/10 group">
                            <TableCell className="p-2 align-top">
                              <Input
                                className="h-8 text-xs font-medium"
                                placeholder="Nome do investidor"
                                value={p.full_name || ''}
                                onChange={(e) => updateInvestor(i, 'full_name', e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Input
                                className="h-8 text-xs"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={p.email || ''}
                                onChange={(e) => updateInvestor(i, 'email', e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Input
                                className="h-8 text-xs font-mono"
                                placeholder="000.000.000-00"
                                value={p.document_number || ''}
                                onChange={(e) =>
                                  updateInvestor(i, 'document_number', e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Select
                                value={p.role}
                                onValueChange={(v) => updateInvestor(i, 'role', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="investor">Investidor</SelectItem>
                                  <SelectItem value="borrower">Tomador</SelectItem>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-2 align-top">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeInvestor(i)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!data.profiles || data.profiles.length === 0) && (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum perfil na lista. Adicione manualmente.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {data.type === 'operations' && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold block">
                    Listagem de {data.borders?.length || 0} Operações Identificadas
                  </Label>
                  <div className="border rounded-md overflow-auto shadow-sm relative">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Lote (Borderô)</TableHead>
                          <TableHead>Cedente</TableHead>
                          <TableHead>Volume Total</TableHead>
                          <TableHead>Total de Títulos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.borders?.map((b: any, i: number) => (
                          <TableRow key={i} className="hover:bg-muted/10">
                            <TableCell className="p-3 text-xs font-mono">
                              {b.border_number}
                            </TableCell>
                            <TableCell className="p-3 text-xs">{b.cedente}</TableCell>
                            <TableCell className="p-3 text-xs font-mono text-primary">
                              R$ {Number(b.amount || 0).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="p-3 text-xs">{b.items_count}</TableCell>
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
            <div className="flex flex-col items-center justify-center space-y-4 py-8 animate-in zoom-in-95 h-full">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-xl">Importação Realizada!</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Os dados reais do documento foram validados e gravados no sistema com sucesso.
              </p>
              <Button onClick={() => handleOpenChange(false)} className="mt-6 w-32">
                Concluir
              </Button>
            </div>
          )}
        </div>

        {step === 'review' && (
          <DialogFooter className="border-t pt-4 mt-4 shrink-0">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar e Descartar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                (data.type === 'investors' && (!data.profiles || data.profiles.length === 0)) ||
                (data.type === 'subscription' && (!data.series || data.series.length === 0))
              }
              className="bg-primary text-primary-foreground"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Gravando dados...' : 'Aprovar Gravação Real'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
