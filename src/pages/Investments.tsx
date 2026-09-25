import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  ArrowRight,
  Clock,
  Loader2,
  AlertCircle,
  Layers,
  FileText,
  FileSignature,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductDialog } from '@/components/admin/ProductDialog'
import { useCompanySettings } from '@/hooks/use-company-settings'
import { buildSecuritizadoraPreambulo } from '@/services/company-settings'

export default function Investments() {
  const { settings: companySettings } = useCompanySettings()
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [investProduct, setInvestProduct] = useState<any>(null)
  const [detailsProduct, setDetailsProduct] = useState<any>(null)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [quotasToBuy, setQuotasToBuy] = useState<number>(1)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeBank, setActiveBank] = useState<any>(null)
  const [subscriptionStep, setSubscriptionStep] = useState<1 | 2>(1)

  const isAllowed = profile
    ? profile.role === 'investor' ||
      profile.role === 'admin' ||
      profile.role === 'staff' ||
      profile.is_admin ||
      profile.is_staff
    : null
  const canEdit =
    profile?.role === 'admin' || profile?.role === 'staff' || profile?.is_admin || profile?.is_staff

  const fetchData = async () => {
    setLoading(true)
    const [prodRes, bankRes] = await Promise.all([
      supabase
        .from('investment_products')
        .select('*, debenture_series(id, indexer)')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('is_highlighted', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('company_bank_accounts').select('*').eq('is_active', true).maybeSingle(),
    ])
    if (prodRes.data) setProducts(prodRes.data)
    if (bankRes.data) setActiveBank(bankRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  const handleInvest = async () => {
    if (!acceptedTerms) return toast.error('Você precisa aceitar o termo de subscrição.')
    if (!profile?.document_number || !user)
      return toast.error('Complete seu cadastro antes de investir.')

    setSaving(true)
    try {
      const qValue = investProduct.quota_value || investProduct.min_investment || 1000
      const totalAmount = quotasToBuy * qValue

      const { data: inv, error: subErr } = await supabase
        .from('investments')
        .insert({
          user_id: user.id,
          product_id: investProduct.id,
          bank_account_id: activeBank?.id || null,
          quotas: quotasToBuy,
          unit_price: qValue,
          total_value: totalAmount,
          status: 'pending_transfer',
        })
        .select()
        .single()

      if (subErr) throw subErr

      // Trigger Edge Function to generate and email PDF
      await supabase.functions.invoke('generate-subscription-term', {
        body: { investmentId: inv.id, ipAddress: 'Registrado via Plataforma' },
      })

      toast.success('Termo assinado digitalmente! Redirecionando para pagamento...')
      navigate(`/investments/checkout/${inv.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar a assinatura.')
      setSaving(false)
    }
  }

  const openInvestModal = (p: any) => {
    setInvestProduct(p)
    setQuotasToBuy(p.min_quotas_per_investor || 1)
    setAcceptedTerms(false)
    setSubscriptionStep(1)
  }

  if (isAllowed === null) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isAllowed === false) return null

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Oportunidades de Investimento</h1>
        <p className="text-muted-foreground">
          Explore o catálogo e invista nos melhores produtos estruturados.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <p className="text-lg font-medium">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => {
            const isSoldOut =
              product.status === 'Esgotado' ||
              (product.sold_quotas >= product.global_quotas && product.global_quotas > 0)
            const progress =
              product.global_quotas > 0 ? (product.sold_quotas / product.global_quotas) * 100 : 0

            return (
              <Card
                key={product.id}
                className={`flex flex-col hover:border-primary/50 transition-colors shadow-sm relative ${isSoldOut ? 'opacity-80 grayscale-[30%]' : ''}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    {isSoldOut ? (
                      <Badge variant="destructive">Esgotado</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {product.status}
                      </Badge>
                    )}
                    {product.is_highlighted && !isSoldOut && (
                      <Badge className="bg-amber-500 hover:bg-amber-600">Destaque</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl pr-6">{product.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {product.manager || 'Gestão Interna'} • {product.rating}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Rentabilidade
                      </span>
                      <p className="font-semibold text-emerald-600">
                        {product.rate || '-'}
                        <span className="text-[11px] font-normal text-muted-foreground ml-1">
                          ({product.interest_type === 'composto' ? 'Juro Composto' : 'Juro Simples'}
                          )
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Prazo
                      </span>
                      <p className="font-semibold">{product.term || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PiggyBank className="h-3 w-3" /> Valor da Cota
                      </span>
                      <p className="font-semibold">
                        {formatCurrency(product.quota_value || product.min_investment)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Moeda
                      </span>
                      <p className="font-semibold">{product.currency || 'BRL'}</p>
                    </div>
                  </div>
                  {product.global_quotas > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Captação ({progress.toFixed(0)}%)</span>
                        <span>
                          {product.sold_quotas} de {product.global_quotas} cotas
                        </span>
                      </div>
                      <Progress value={Math.min(100, progress)} className="h-2" />
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDetailsProduct(product)}
                  >
                    Detalhes
                  </Button>
                  <Button
                    className="flex-1 gap-2 group/btn"
                    disabled={isSoldOut}
                    onClick={() => openInvestModal(product)}
                  >
                    {isSoldOut ? 'Esgotado' : 'Investir'}
                    {!isSoldOut && (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={!!detailsProduct} onOpenChange={(v) => !v && setDetailsProduct(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto z-[2000]">
          <DialogHeader>
            <DialogTitle>{detailsProduct?.title}</DialogTitle>
            <DialogDescription>
              {detailsProduct?.type} - Emissão Sea Connection Investimentos S.A.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="resgate">Resgate</TabsTrigger>
                <TabsTrigger value="tributacao">Tributação</TabsTrigger>
                <TabsTrigger value="gestao">Gestão</TabsTrigger>
              </TabsList>
              <TabsContent value="geral" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detailsProduct?.description || 'Descrição não informada pelo administrador.'}
                </p>
              </TabsContent>
              <TabsContent value="resgate" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detailsProduct?.redemption_rules || 'Regras de resgate não informadas.'}
                </p>
              </TabsContent>
              <TabsContent value="tributacao" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detailsProduct?.ir_rules || 'Regras de tributação não informadas.'}
                </p>
              </TabsContent>
              <TabsContent value="gestao" className="space-y-4 pt-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground mb-1">Gestor</h4>
                  <p className="text-sm font-medium">
                    {detailsProduct?.manager || 'Gestão Interna'}
                  </p>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold text-xs text-muted-foreground mb-1">
                    Política de Gestão
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detailsProduct?.management_policy || 'Política não informada.'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border mt-6">
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">Rentabilidade Alvo</h4>
                <p className="text-sm font-medium text-emerald-600">
                  {detailsProduct?.rate}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    (
                    {detailsProduct?.interest_type === 'composto'
                      ? 'Juro Composto'
                      : 'Juro Simples'}
                    )
                  </span>
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">Prazo / Vencimento</h4>
                <p className="text-sm font-medium">{detailsProduct?.term}</p>
              </div>
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">
                  Carência para Resgate
                </h4>
                <p className="text-sm font-medium">
                  {detailsProduct?.min_grace_period_months || 0} meses
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">Tipo de Garantia</h4>
                <p className="text-sm font-medium">
                  {detailsProduct?.risk === 'Baixo'
                    ? 'Garantia Real / Alienação Fiduciária'
                    : detailsProduct?.risk === 'Médio'
                      ? 'Quirografária'
                      : 'Subordinada'}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">
                  Valor Nominal Unitário (PU)
                </h4>
                <p className="text-sm font-medium">
                  {formatCurrency(detailsProduct?.quota_value || detailsProduct?.min_investment)}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground">Investimento Mínimo</h4>
                <p className="text-sm font-medium">
                  {detailsProduct?.min_quotas_per_investor || 1} cota(s)
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Documentos Anexos</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Escritura em fase de formalização pela CVM.')}
                  className="justify-start"
                >
                  <FileText className="h-4 w-4 mr-2 text-primary" /> Escritura de Emissão
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Lâmina em atualização.')}
                  className="justify-start"
                >
                  <FileText className="h-4 w-4 mr-2 text-primary" /> Lâmina de Informações
                  Essenciais
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-between items-center w-full">
            <div className="flex w-full sm:w-auto">
              {canEdit && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const p = detailsProduct
                    setDetailsProduct(null)
                    setTimeout(() => setEditProduct(p), 100)
                  }}
                >
                  Editar Produto
                </Button>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setDetailsProduct(null)}
              >
                Fechar
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => {
                  const p = detailsProduct
                  setDetailsProduct(null)
                  setTimeout(() => openInvestModal(p), 100)
                }}
              >
                Investir Neste Produto
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      {editProduct && (
        <ProductDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          product={editProduct}
          onSuccess={() => {
            setEditProduct(null)
            fetchData()
          }}
        />
      )}

      {/* Subscription Flow Modal */}
      <Dialog open={!!investProduct} onOpenChange={(open) => !open && setInvestProduct(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col z-[2000]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Fluxo de Subscrição Digital
            </DialogTitle>
            <DialogDescription>
              {subscriptionStep === 1
                ? 'Etapa 1 de 2: Definição de Valores'
                : 'Etapa 2 de 2: Assinatura do Termo de Investimento'}
            </DialogDescription>
          </DialogHeader>

          {investProduct && (
            <div className="flex-1 overflow-y-auto py-2 pr-2">
              {subscriptionStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Produto Selecionado</p>
                        <p className="font-semibold">{investProduct.title}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rentabilidade</p>
                        <p className="font-semibold text-emerald-600">
                          {investProduct.rate}{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            (
                            {investProduct.interest_type === 'composto'
                              ? 'Juro Composto'
                              : 'Juro Simples'}
                            )
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Quantidade de Cotas a Subscrever
                    </Label>
                    <div className="flex gap-4 items-center">
                      <Input
                        type="number"
                        className="text-lg font-mono h-12 w-32"
                        value={quotasToBuy}
                        onChange={(e) => {
                          let val = Number(e.target.value)
                          const max = investProduct.max_quotas_per_investor || 9999
                          if (val > max) val = max
                          setQuotasToBuy(val)
                        }}
                        min={investProduct.min_quotas_per_investor || 1}
                        max={investProduct.max_quotas_per_investor || 9999}
                      />
                      <div className="flex-1 bg-primary/10 rounded-md p-3 border border-primary/20 text-center">
                        <p className="text-xs text-primary font-medium mb-1">
                          Valor Total a Integralizar
                        </p>
                        <p className="text-xl font-bold font-mono text-primary">
                          {formatCurrency(
                            quotasToBuy *
                              (investProduct.quota_value || investProduct.min_investment || 1000),
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Mínimo:{' '}
                      {investProduct.min_quotas_per_investor || 1} | Máximo:{' '}
                      {investProduct.max_quotas_per_investor || 'Sem limite'}
                    </p>
                  </div>
                </div>
              )}

              {subscriptionStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <ScrollArea className="h-[40vh] w-full rounded-md border p-4 bg-muted/10">
                    <div className="space-y-4 text-sm text-foreground/90">
                      <h3 className="font-bold text-center text-base uppercase">
                        TERMO DE INVESTIMENTO EM DEBÊNTURES
                      </h3>

                      <div className="bg-primary/5 p-3 border border-primary/20 rounded text-xs space-y-1">
                        <p className="font-bold text-primary">
                          ESCRITURA DE EMISSÃO:{' '}
                          <span className="font-normal text-foreground">
                            {companySettings?.debenture_numero_escritura_padrao ||
                              '1ª Escritura de Emissão Pública de Debêntures'}
                          </span>
                        </p>
                        <p className="font-bold text-primary">
                          SÉRIE:{' '}
                          <span className="font-normal text-foreground">
                            {investProduct.debenture_series?.series_number
                              ? `Série ${investProduct.debenture_series.series_number}`
                              : companySettings?.debenture_serie_padrao || '1ª Série'}
                          </span>
                        </p>
                      </div>

                      <div className="space-y-1 bg-white dark:bg-card p-3 border rounded shadow-sm text-xs">
                        <p className="text-justify leading-relaxed">
                          <strong>EMISSORA:</strong>{' '}
                          {buildSecuritizadoraPreambulo(companySettings, 'EMISSORA')}
                        </p>
                        <p className="text-justify leading-relaxed pt-2">
                          <strong>INVESTIDOR/DEBENTURISTA:</strong>{' '}
                          {(profile as any)?.full_name ||
                            (profile as any)?.pj_company_name ||
                            'Investidor'}
                          , inscrito no CPF/CNPJ nº {(profile as any)?.document_number || 'N/A'},
                          com endereço em {(profile as any)?.address_street || 'Conforme cadastro'},
                          nº {(profile as any)?.address_number || 'S/N'},{' '}
                          {(profile as any)?.address_city || ''}/
                          {(profile as any)?.address_state || ''}, e-mail{' '}
                          {(profile as any)?.email || 'N/A'}.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 1 - DO OBJETO E DA SUBSCRIÇÃO
                        </h4>
                        <p className="text-xs text-justify">
                          O presente instrumento tem por objeto a subscrição, pelo INVESTIDOR, de{' '}
                          {quotasToBuy} ({quotasToBuy === 1 ? 'uma cota' : quotasToBuy + ' cotas'})
                          debênture(s) privada(s), nominativa(s) e escritural(is) vinculada(s) à{' '}
                          {investProduct.debenture_series?.series_number
                            ? `Série ${investProduct.debenture_series.series_number}`
                            : companySettings?.debenture_serie_padrao || '1ª Série'}{' '}
                          da{' '}
                          {companySettings?.debenture_numero_escritura_padrao ||
                            '1ª Escritura de Emissão Pública de Debêntures'}
                          , emitida sob a denominação de &quot;{investProduct.title}&quot;, com
                          valor nominal unitário de{' '}
                          {formatCurrency(
                            investProduct.quota_value || investProduct.min_investment,
                          )}
                          , perfazendo o montante total de{' '}
                          {formatCurrency(
                            quotasToBuy *
                              (investProduct.quota_value || investProduct.min_investment),
                          )}
                          .
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">CLÁUSULA 2 - DA INTEGRALIZAÇÃO</h4>
                        <p className="text-xs text-justify">
                          O INVESTIDOR compromete-se a integralizar o valor total de{' '}
                          {formatCurrency(
                            quotasToBuy *
                              (investProduct.quota_value || investProduct.min_investment),
                          )}{' '}
                          em moeda corrente nacional via transferência bancária (PIX/TED) para a
                          conta corrente de titularidade da EMISSORA, sob pena de cancelamento
                          automático do presente termo caso os fundos não sejam compensados no prazo
                          estipulado.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 3 - DA REMUNERAÇÃO E REGIME DE JUROS
                        </h4>
                        <p className="text-xs text-justify">
                          Sobre o valor subscrito incidirá a remuneração contratada correspondente à
                          taxa de {investProduct.rate} (
                          {investProduct.debenture_series?.indexer || 'Pré-fixado'}), apurada a
                          partir da data de integralização do aporte. O regime de capitalização
                          aplicável é{' '}
                          {investProduct.interest_type === 'composto'
                            ? 'Juros Compostos'
                            : 'Juros Simples'}
                          , calculado pro rata die.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 4 - DO PRAZO, CARÊNCIA E RESGATE
                        </h4>
                        <p className="text-xs text-justify">
                          O prazo de vigência desta debênture é fixado para {investProduct.term}.
                          Aplica-se o prazo de carência mínima obrigatória de{' '}
                          {investProduct.min_grace_period_months || 0} meses. Decorrida a carência,
                          o investidor poderá solicitar resgate através da plataforma, observadas as
                          regras de liquidação e eventuais deságios estabelecidos no regulamento da
                          emissão.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 5 - DA ESCRITURA E LEGISLAÇÃO APLICÁVEL
                        </h4>
                        <p className="text-xs text-justify">
                          A presente subscrição sujeita-se às condições da respectiva Escritura de
                          Emissão e subordina-se à Lei Federal nº 6.404/76 (arts. 52 e ss.), à Lei
                          Federal nº 6.385/76 (normas CVM) e ao marco securitizatório brasileiro. Os
                          debenturistas gozam de todas as garantias e direitos previstos em lei.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 6 - DA TRIBUTAÇÃO (IRRF)
                        </h4>
                        <p className="text-xs text-justify">
                          Os rendimentos estão sujeitos à incidência do Imposto de Renda Retido na
                          Fonte (IRRF) pela tabela regressiva de renda fixa (Lei 11.033/2004),
                          retido na fonte no momento de cada resgate. As rentabilidades contratadas
                          são informadas em valores brutos.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 7 - DA CIÊNCIA DE RISCOS
                        </h4>
                        <p className="text-xs text-justify">
                          O INVESTIDOR declara expressa ciência de que o investimento em debêntures
                          privadas constitui aplicação de renda fixa emitida por securitizadora, não
                          contando com cobertura do Fundo Garantidor de Créditos (FGC).
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-primary">
                          CLÁUSULA 8 - DA PROTEÇÃO DE DADOS (LGPD) E FORO
                        </h4>
                        <p className="text-xs text-justify">
                          As partes autorizam reciprocamente o tratamento de dados pessoais conforme
                          a Lei 13.709/2018 (LGPD) e elegem o Foro da Comarca de{' '}
                          {companySettings?.endereco_cidade || 'Criciúma'}, Estado de{' '}
                          {companySettings?.endereco_uf || 'SC'}, para dirimir quaisquer
                          controvérsias decorrentes deste Instrumento.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-dashed mt-4 text-xs text-muted-foreground">
                        <p>
                          Assinatura Eletrônica vinculada ao acesso autenticado na Plataforma
                          Securitizadora.
                        </p>
                        <p>Endereço IP Registrado: Capturado via sistema no momento do aceite.</p>
                        <p>
                          Data/Hora do Aceite:{' '}
                          {new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="flex items-start space-x-3 bg-primary/5 p-4 rounded-md border border-primary/20">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(c) => setAcceptedTerms(c as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1 leading-none">
                      <label htmlFor="terms" className="text-sm font-semibold cursor-pointer">
                        Li, compreendo os riscos e aceito as condições do Termo de Subscrição.
                      </label>
                      <p className="text-xs text-muted-foreground pt-1">
                        Ao confirmar, sua assinatura digital será vinculada e o documento PDF gerado
                        será enviado ao seu e-mail e arquivado na plataforma.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t">
            {subscriptionStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setInvestProduct(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const min = investProduct?.min_quotas_per_investor || 1
                    if (quotasToBuy < min)
                      return toast.error(`A aplicação mínima é de ${min} cotas.`)
                    setSubscriptionStep(2)
                  }}
                >
                  Continuar para Assinatura <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setSubscriptionStep(1)} disabled={saving}>
                  Voltar
                </Button>
                <Button onClick={handleInvest} disabled={saving || !acceptedTerms}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileSignature className="h-4 w-4 mr-2" />
                  )}
                  Assinar e Confirmar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
