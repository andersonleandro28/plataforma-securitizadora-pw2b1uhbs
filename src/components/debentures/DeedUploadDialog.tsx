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
import { UploadCloud, Loader2, CheckCircle2, FileText } from 'lucide-react'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('upload')
    setData(null)
    setSaving(false)
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
      const { data: resData, error } = await supabase.functions.invoke('extract-debenture-data', {
        body: { filename: file.name },
      })
      if (error) throw error
      setData(resData.data)
      setStep('review')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao processar o documento. Tente novamente.')
      setStep('upload')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
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

      const seriesToInsert = data.series.map((s: any) => ({
        debenture_id: debData.id,
        series_number: s.series_number,
        volume: s.volume,
        indexer: s.indexer,
        rate: s.rate,
        maturity_date: s.maturity_date,
      }))

      const { error: seriesErr } = await supabase.from('debenture_series').insert(seriesToInsert)
      if (seriesErr) throw seriesErr

      setStep('success')
      toast.success('Escritura cadastrada com sucesso!')
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar os dados no banco.')
    } finally {
      setSaving(false)
    }
  }

  const updateSeries = (index: number, field: string, val: string | number) => {
    const newSeries = [...data.series]
    newSeries[index] = { ...newSeries[index], [field]: val }
    setData({ ...data, series: newSeries })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>Upload Inteligente de Escritura</DialogTitle>
          <DialogDescription>
            Faça o upload do documento (PDF ou Word) e nossa IA extrairá os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px] flex flex-col justify-center">
          {step === 'upload' && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
              />
              <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">Clique para selecionar o arquivo</h3>
              <p className="text-sm text-muted-foreground mt-1">PDF ou Word (máx. 10MB)</p>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h3 className="font-semibold text-lg animate-pulse">
                Analisando documento com IA...
              </h3>
            </div>
          )}

          {step === 'review' && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                <div className="space-y-1">
                  <Label>Emissor</Label>
                  <Input
                    value={data.issuer_name}
                    onChange={(e) => setData({ ...data, issuer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Volume Total (R$)</Label>
                  <Input
                    type="number"
                    value={data.total_volume}
                    onChange={(e) => setData({ ...data, total_volume: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Séries Identificadas</Label>
                <div className="border rounded-md overflow-auto max-h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Série</TableHead>
                        <TableHead>Idx</TableHead>
                        <TableHead>Taxa(%)</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Volume(R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.series.map((s: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              className="h-8 w-16"
                              value={s.series_number}
                              onChange={(e) => updateSeries(i, 'series_number', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-20"
                              value={s.indexer}
                              onChange={(e) => updateSeries(i, 'indexer', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-16"
                              value={s.rate}
                              onChange={(e) => updateSeries(i, 'rate', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              className="h-8 w-32"
                              value={s.maturity_date}
                              onChange={(e) => updateSeries(i, 'maturity_date', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="h-8 w-28 ml-auto"
                              value={s.volume}
                              onChange={(e) => updateSeries(i, 'volume', Number(e.target.value))}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-xl">Escritura Cadastrada!</h3>
              <p className="text-sm text-muted-foreground text-center">
                As séries foram registradas no sistema com sucesso.
              </p>
              <Button onClick={() => handleOpenChange(false)} className="mt-4">
                Fechar
              </Button>
            </div>
          )}
        </div>

        {step === 'review' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Confirmar e Salvar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
