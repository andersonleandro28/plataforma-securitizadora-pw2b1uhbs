import { useState, useEffect } from 'react'
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
import { Loader2, Save, FileSignature, AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getOrGenerateSubscriptionContract } from '@/services/subscription-contract'

export interface DebentureEscritura {
  id: string
  issuer_name: string
  numero_escritura?: string | null
  numero_emissao?: string | null
  orgao_registro?: string | null
  data_registro?: string | null
  numero_arquivamento?: string | null
  total_volume?: number | null
  issue_date?: string | null
}

interface EditEscrituraDialogProps {
  debenture: DebentureEscritura | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditEscrituraDialog({
  debenture,
  open,
  onOpenChange,
  onSuccess,
}: EditEscrituraDialogProps) {
  const [saving, setSaving] = useState(false)
  const [regeneratingContracts, setRegeneratingContracts] = useState(false)
  const [shouldRegenerateAll, setShouldRegenerateAll] = useState(true)

  const [formData, setFormData] = useState({
    issuer_name: '',
    numero_escritura: '',
    numero_emissao: '',
    orgao_registro: '',
    data_registro: '',
    numero_arquivamento: '',
    total_volume: '',
    issue_date: '',
  })

  useEffect(() => {
    if (open && debenture) {
      setFormData({
        issuer_name: debenture.issuer_name || '',
        numero_escritura:
          debenture.numero_escritura || '1ª Escritura de Emissão Pública de Debêntures',
        numero_emissao: debenture.numero_emissao || '1ª Emissão',
        orgao_registro: debenture.orgao_registro || 'Junta Comercial do Estado de Santa Catarina',
        data_registro: debenture.data_registro
          ? debenture.data_registro.split('T')[0]
          : '2025-06-05',
        numero_arquivamento: debenture.numero_arquivamento || 'ED009857000',
        total_volume: debenture.total_volume != null ? String(debenture.total_volume) : '',
        issue_date: debenture.issue_date ? debenture.issue_date.split('T')[0] : '',
      })
    }
  }, [open, debenture])

  // Monta prévia dinâmica da frase normativa
  const formatDataExtenso = (dateStr: string) => {
    if (!dateStr) return '05 de junho de 2025'
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    } catch {
      return dateStr
    }
  }

  const dataExtensoPreview = formatDataExtenso(formData.data_registro)
  const previewFrase = `Escritura de Emissão registrada na ${formData.orgao_registro || '[Órgão de Registro]'}, em ${dataExtensoPreview}, nº Arquivamento: ${formData.numero_arquivamento || '[Nº Arquivamento]'} doravante denominada "Escritura de Emissão".`

  const handleSave = async () => {
    if (!debenture?.id) return

    if (!formData.issuer_name.trim()) {
      toast.error('O nome do emissor é obrigatório.')
      return
    }

    if (!formData.numero_escritura.trim()) {
      toast.error('O número da escritura é obrigatório.')
      return
    }

    if (!formData.orgao_registro.trim()) {
      toast.error('O órgão de registro (Junta Comercial) é obrigatório.')
      return
    }

    if (!formData.data_registro) {
      toast.error('A data do registro/arquivamento é obrigatória.')
      return
    }

    if (!formData.numero_arquivamento.trim()) {
      toast.error('O número de arquivamento na Junta é obrigatório.')
      return
    }

    setSaving(true)
    try {
      // 1. Atualiza registro da debênture
      const { error: updateError } = await (supabase.from('debentures') as any)
        .update({
          issuer_name: formData.issuer_name.trim(),
          numero_escritura: formData.numero_escritura.trim(),
          numero_emissao: formData.numero_emissao.trim() || '1ª Emissão',
          orgao_registro: formData.orgao_registro.trim(),
          data_registro: formData.data_registro,
          numero_arquivamento: formData.numero_arquivamento.trim(),
          total_volume: formData.total_volume ? Number(formData.total_volume) : 0,
          issue_date: formData.issue_date || null,
        })
        .eq('id', debenture.id)

      if (updateError) {
        throw new Error(`Falha ao salvar escritura: ${updateError.message}`)
      }

      // 2. Se a opção de atualizar contratos existentes estiver marcada:
      // Localiza todos os investimentos vinculados a esta debênture (via series -> investment_products -> investments)
      if (shouldRegenerateAll) {
        setRegeneratingContracts(true)
        const toastId = toast.loading(
          'Atualizando e regenerando contratos de subscrição existentes com a nova escritura...',
        )

        try {
          // Busca séries vinculadas à debênture
          const { data: seriesList } = await supabase
            .from('debenture_series')
            .select('id')
            .eq('debenture_id', debenture.id)

          const seriesIds = (seriesList || []).map((s) => s.id)

          if (seriesIds.length > 0) {
            // Busca produtos vinculados às séries
            const { data: productsList } = await supabase
              .from('investment_products')
              .select('id')
              .in('series_id', seriesIds)

            const productIds = (productsList || []).map((p) => p.id)

            if (productIds.length > 0) {
              // Busca aportes/investimentos
              const { data: investmentsList } = await supabase
                .from('investments')
                .select('id, contract_url')
                .in('product_id', productIds)

              const invs = investmentsList || []
              let regeneratedCount = 0

              // Regenera de forma idempotente em paralelo (lotes de 3 para não sobrecarregar)
              for (let i = 0; i < invs.length; i += 3) {
                const chunk = invs.slice(i, i + 3)
                await Promise.all(
                  chunk.map(async (inv) => {
                    try {
                      await getOrGenerateSubscriptionContract({
                        investmentId: inv.id,
                        forceRegenerate: true,
                        sendEmail: false,
                        openInNewTab: false,
                        downloadDirectly: false,
                      })
                      regeneratedCount++
                    } catch (e) {
                      console.warn(`Erro ao regenerar contrato do investimento ${inv.id}:`, e)
                    }
                  }),
                )
              }

              toast.dismiss(toastId)
              toast.success(
                `Escritura salva e ${regeneratedCount} contrato(s) regenerado(s) com sucesso!`,
              )
            } else {
              toast.dismiss(toastId)
              toast.success('Escritura atualizada com sucesso!')
            }
          } else {
            toast.dismiss(toastId)
            toast.success('Escritura atualizada com sucesso!')
          }
        } catch (err: any) {
          toast.dismiss(toastId)
          console.error('Erro na regeneração dos contratos:', err)
          toast.warning(
            'Escritura salva, mas alguns contratos serão atualizados na próxima visualização.',
          )
        } finally {
          setRegeneratingContracts(false)
        }
      } else {
        toast.success('Dados da escritura salvos com sucesso!')
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Erro ao salvar os dados da escritura.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b bg-muted/10">
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Editar Dados da Escritura de Emissão
          </DialogTitle>
          <DialogDescription>
            Configure os dados oficiais de registro na Junta Comercial que serão impressos na capa e
            nas cláusulas normativas dos contratos de subscrição de debêntures.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Identificação da Emissão</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Nome do Emissor / Razão Social</Label>
                <Input
                  placeholder="Ex: Sea Connection Investimentos S.A."
                  value={formData.issuer_name}
                  onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Identificação da Escritura</Label>
                <Input
                  placeholder="Ex: 1ª Escritura de Emissão Pública de Debêntures"
                  value={formData.numero_escritura}
                  onChange={(e) => setFormData({ ...formData, numero_escritura: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Número da Emissão</Label>
                <Input
                  placeholder="Ex: 1ª Emissão"
                  value={formData.numero_emissao}
                  onChange={(e) => setFormData({ ...formData, numero_emissao: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Volume Total da Emissão (R$)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="font-mono"
                  value={formData.total_volume}
                  onChange={(e) => setFormData({ ...formData, total_volume: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data da Emissão (Ata/Deliberação)</Label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2 text-primary flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> Registro na Junta Comercial (Normativa
              Contratual)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Órgão de Registro / Junta Comercial</Label>
                <Input
                  placeholder="Ex: Junta Comercial do Estado de Santa Catarina"
                  value={formData.orgao_registro}
                  onChange={(e) => setFormData({ ...formData, orgao_registro: e.target.value })}
                />
                <span className="text-xs text-muted-foreground">
                  Permite indicar qualquer junta comercial para esta ou futuras emissões (JUCESC,
                  JUCESP, JUCERJA, etc).
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Data do Registro / Arquivamento</Label>
                <Input
                  type="date"
                  value={formData.data_registro}
                  onChange={(e) => setFormData({ ...formData, data_registro: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Nº do Arquivamento na Junta</Label>
                <Input
                  placeholder="Ex: ED009857000"
                  className="font-mono uppercase"
                  value={formData.numero_arquivamento}
                  onChange={(e) =>
                    setFormData({ ...formData, numero_arquivamento: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>

            {/* Caixa de Visualização da Frase Normativa */}
            <div className="bg-muted/40 p-3.5 rounded-lg border border-primary/20 space-y-1.5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Prévia da redação no Contrato de Subscrição:
              </p>
              <p className="text-xs italic text-foreground leading-relaxed bg-background p-2.5 rounded border font-serif">
                &ldquo;{previewFrase}&rdquo;
              </p>
            </div>
          </section>

          {/* Opção de regeneração retroativa dos contratos */}
          <section className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="regenerate_contracts"
                checked={shouldRegenerateAll}
                onCheckedChange={(checked) => setShouldRegenerateAll(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <label
                  htmlFor="regenerate_contracts"
                  className="text-xs font-semibold text-amber-950 cursor-pointer block"
                >
                  Regenerar retroativamente os contratos existentes vinculados a esta escritura
                </label>
                <p className="text-xs text-amber-800 leading-normal">
                  Atualiza de imediato os PDFs já emitidos com os novos dados da Junta Comercial.
                  Caso desmarcado, o novo texto entrará automaticamente na próxima visualização ou
                  novo aporte.
                </p>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="p-6 shrink-0 border-t bg-muted/10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving || regeneratingContracts}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || regeneratingContracts}
            className="min-w-[150px] gap-2"
          >
            {saving || regeneratingContracts ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {regeneratingContracts ? 'Regenerando PDFs...' : 'Gravando...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Escritura
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
