import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileText,
  FileSignature,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Download,
  Info,
  Building,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { getOrGenerateSubscriptionContract } from '@/services/subscription-contract'
import {
  respondInvestmentAuthorization,
  getClientPublicIp,
} from '@/services/investor-authorization'

interface InvestorAuthorizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investment: any | null
  onSuccess: () => void
}

export function InvestorAuthorizationDialog({
  open,
  onOpenChange,
  investment,
  onSuccess,
}: InvestorAuthorizationDialogProps) {
  const [mode, setMode] = useState<'accept' | 'revision'>('accept')
  const [agreed, setAgreed] = useState(false)
  const [revisionNote, setRevisionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientIp, setClientIp] = useState<string>('')
  const [loadingContract, setLoadingContract] = useState(false)

  useEffect(() => {
    if (open) {
      setMode('accept')
      setAgreed(false)
      setRevisionNote('')
      // Captura IP antecipadamente
      getClientPublicIp()
        .then((ip) => setClientIp(ip))
        .catch(() => setClientIp('Conexão Autenticada via Plataforma Web/SSL'))
    }
  }, [open, investment?.id])

  if (!investment) return null

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const product = investment.investment_products || {}
  const totalValue =
    Number(investment.total_value) ||
    Number(investment.quotas || 1) * Number(investment.unit_price || 1000)

  const handleOpenContract = async (downloadDirectly = false) => {
    setLoadingContract(true)
    try {
      await getOrGenerateSubscriptionContract({
        investmentId: investment.id,
        existingUrl: investment.contract_url,
        forceRegenerate: false,
        openInNewTab: !downloadDirectly,
        downloadDirectly,
      })
    } catch {
      // toast disparado no service
    } finally {
      setLoadingContract(false)
    }
  }

  const handleSubmitAccept = async () => {
    if (!agreed) {
      toast.error('Você precisa marcar a declaração de ciência e aceite dos termos.')
      return
    }

    setSubmitting(true)
    try {
      const res = await respondInvestmentAuthorization({
        investmentId: investment.id,
        action: 'accept',
        clientIp,
      })

      toast.success(res.message || 'Investimento confirmado com sucesso!')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar autorização.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitRevision = async () => {
    if (!revisionNote.trim()) {
      toast.error('Por favor, descreva o motivo da revisão para a administração.')
      return
    }

    setSubmitting(true)
    try {
      const res = await respondInvestmentAuthorization({
        investmentId: investment.id,
        action: 'request_revision',
        clientIp,
        note: revisionNote.trim(),
      })

      toast.success(
        res.message || 'Solicitação de revisão enviada. A administração foi notificada.',
      )
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar solicitação de revisão.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSignature className="w-5 h-5 text-primary" />
            {mode === 'accept'
              ? 'Autorização de Investimento Lançado'
              : 'Solicitar Revisão de Aporte'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'accept'
              ? 'Este investimento em debêntures foi registrado internamente pela administração. Confira os termos contratuais e confirme o seu aceite.'
              : 'Caso não reconheça os parâmetros deste aporte ou deseje retificação, registre uma solicitação de revisão formal para o comitê.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo do Aporte */}
          <div className="bg-muted/40 p-3.5 rounded-lg border space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Building className="w-4 h-4 text-primary" />
                {product.title || 'Debênture Estruturada'}
              </span>
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-300 font-normal"
              >
                Lançamento Interno
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-muted-foreground block">Valor Total:</span>
                <span className="font-bold text-foreground text-sm font-mono text-primary">
                  {formatCurrency(totalValue)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cotas / PU:</span>
                <span className="font-medium text-foreground">
                  {investment.quotas} cota(s) a {formatCurrency(investment.unit_price || 1000)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Rentabilidade:</span>
                <span className="font-semibold text-emerald-600">
                  {product.rate || 'Taxa contratual'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Início dos Rendimentos:</span>
                <span className="font-medium text-foreground">
                  {formatDate(investment.transfer_date || investment.created_at)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Prazo / Vencimento:</span>
                <span className="font-medium text-foreground">{product.term || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Carência Mínima:</span>
                <span className="font-medium text-foreground">
                  {product.min_grace_period_months || 0} meses
                </span>
              </div>
            </div>
          </div>

          {/* Botão para ler o contrato ANTES de autorizar */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                Termo de Subscrição de Debêntures
              </span>
              <p className="text-[11px] text-muted-foreground">
                Leia o contrato completo emitido para este aporte antes de formalizar seu aceite.
              </p>
            </div>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 flex-1 sm:flex-none border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => handleOpenContract(false)}
                disabled={loadingContract}
              >
                {loadingContract ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                Ver Contrato (PDF)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                onClick={() => handleOpenContract(true)}
                disabled={loadingContract}
                title="Baixar Contrato em PDF"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {mode === 'accept' ? (
            <div className="space-y-4 pt-1">
              <Alert className="bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  Consentimento e Assinatura Eletrônica Qualificada
                </AlertTitle>
                <AlertDescription className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                  Ao confirmar, seu aceite expresso será vinculado a este investimento, registrando
                  o carimbo temporal oficial e seu endereço de conexão (
                  {clientIp || 'capturando...'}), conforme a MP nº 2.200-2/2001 e a Lei nº
                  14.063/2020.
                </AlertDescription>
              </Alert>

              <div className="flex items-start space-x-2.5 rounded-md border p-3 bg-background">
                <Checkbox
                  id="agree-checkbox"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(!!checked)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="agree-checkbox"
                  className="text-xs leading-relaxed text-foreground cursor-pointer font-normal"
                >
                  Declaro que li, compreendi e concordo integralmente com os termos e condições do{' '}
                  <strong>Termo de Subscrição de Debêntures</strong> e da respectiva Escritura de
                  Emissão, autorizando a efetivação e os rendimentos deste investimento em minha
                  conta.
                </Label>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-xs text-muted-foreground hover:text-amber-700 h-auto p-0"
                  onClick={() => setMode('revision')}
                >
                  Não reconhece este investimento ou deseja retificação? Solicitar revisão.
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <Alert className="bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/20 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Solicitação de Revisão à Administração
                </AlertTitle>
                <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                  Esta ação não cancela nem estorna saldos automaticamente. Ela registrará uma
                  notificação prioritária para a equipe administrativa revisar os dados deste aporte
                  junto a você.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="revision-note" className="text-xs font-medium">
                  Motivo ou Observação da Revisão <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="revision-note"
                  placeholder="Explique o que precisa ser ajustado (ex.: quantidade de cotas incorreta, produto divergente, aporte não contratado)..."
                  rows={4}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-xs text-muted-foreground hover:text-primary h-auto p-0"
                  onClick={() => setMode('accept')}
                >
                  Voltar para o fluxo de autorização e aceite
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 pt-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Fechar
          </Button>

          {mode === 'accept' ? (
            <Button
              type="button"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmitAccept}
              disabled={submitting || !agreed}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Confirmar Aceite e Autorizar
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={handleSubmitRevision}
              disabled={submitting || !revisionNote.trim()}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              Enviar Solicitação de Revisão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
