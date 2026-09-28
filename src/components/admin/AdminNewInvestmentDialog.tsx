import { useState, useEffect, useMemo } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  Loader2,
  FileSignature,
  CheckCircle2,
  Building,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { sendNotification } from '@/services/notifications'

interface AdminNewInvestmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface ClientOption {
  id: string
  full_name: string | null
  email: string | null
  document_number: string | null
  pj_company_name: string | null
  role: string
  is_blocked?: boolean
}

export function AdminNewInvestmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: AdminNewInvestmentDialogProps) {
  const { user } = useAuth()

  // Loading states
  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)

  // Data lists
  const [clients, setClients] = useState<ClientOption[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])

  // Selection states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBankId, setSelectedBankId] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [quotas, setQuotas] = useState<number>(1)
  const [customUnitPrice, setCustomUnitPrice] = useState<number | null>(null)

  // Duplicate check
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)

  // Step 1: Form, Step 2: Confirmation
  const [step, setStep] = useState<1 | 2>(1)

  // Reset when opening
  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setSelectedClient(null)
      setSelectedProductId('')
      setSelectedBankId('')
      setTransferDate(new Date().toLocaleDateString('en-CA'))
      setQuotas(1)
      setCustomUnitPrice(null)
      setDuplicateWarning(null)
      setConfirmedDuplicate(false)
      setStep(1)
      loadInitialData()
    }
  }, [open])

  const loadInitialData = async () => {
    setLoadingData(true)
    try {
      // 1. Clientes cadastrados (perfis existentes com role 'investor' ou marcados como is_investor/admin/staff)
      const { data: clientsData, error: clientErr } = await supabase
        .from('profiles')
        .select(
          'id, full_name, email, document_number, pj_company_name, role, is_blocked, is_investor',
        )
        .eq('is_blocked', false)
        .order('full_name', { ascending: true })

      if (clientErr) throw clientErr
      setClients(clientsData || [])

      // 2. Produtos de investimento ativos
      const { data: prodsData, error: prodsErr } = await supabase
        .from('investment_products')
        .select('*, debenture_series(*)')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (prodsErr) throw prodsErr
      setProducts(prodsData || [])

      if (prodsData && prodsData.length > 0) {
        setSelectedProductId(prodsData[0].id)
        setQuotas(prodsData[0].min_quotas_per_investor || 1)
      }

      // 3. Contas bancárias ativas da empresa
      const { data: bankData, error: bankErr } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('is_active', true)

      if (!bankErr && bankData && bankData.length > 0) {
        setBankAccounts(bankData)
        setSelectedBankId(bankData[0].id)
      }
    } catch (err: any) {
      toast.error('Erro ao carregar dados: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  // Produto selecionado
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null
  }, [products, selectedProductId])

  // Preço unitário e total
  const unitPrice = useMemo(() => {
    if (customUnitPrice !== null && customUnitPrice > 0) return customUnitPrice
    if (!selectedProduct) return 1000
    return Number(selectedProduct.quota_value || selectedProduct.min_investment || 1000)
  }, [selectedProduct, customUnitPrice])

  const totalValue = useMemo(() => {
    return (quotas || 0) * unitPrice
  }, [quotas, unitPrice])

  // Filtragem dos clientes na busca
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase().trim()
    return clients.filter((c) => {
      const name = (c.full_name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const doc = (c.document_number || '').replace(/\D/g, '')
      const comp = (c.pj_company_name || '').toLowerCase()
      const cleanTerm = term.replace(/\D/g, '')

      return (
        name.includes(term) ||
        email.includes(term) ||
        comp.includes(term) ||
        (cleanTerm.length > 2 && doc.includes(cleanTerm))
      )
    })
  }, [clients, searchTerm])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

  // Verifica duplicidade recente (mesmo cliente, produto e valor criado nos últimos 10 minutos)
  const checkForDuplicates = async () => {
    if (!selectedClient || !selectedProductId) return false

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentInvs } = await supabase
      .from('investments')
      .select('id, total_value, created_at')
      .eq('user_id', selectedClient.id)
      .eq('product_id', selectedProductId)
      .gte('created_at', tenMinutesAgo)

    if (recentInvs && recentInvs.length > 0) {
      const match = recentInvs.find((i) => Number(i.total_value) === totalValue)
      if (match) {
        return true
      }
    }
    return false
  }

  const handleNextStep = async () => {
    if (!selectedClient) {
      return toast.error('Selecione um cliente/investidor já cadastrado.')
    }
    if (!selectedProduct) {
      return toast.error('Selecione uma emissão/produto de investimento.')
    }
    if (!quotas || quotas <= 0) {
      return toast.error('Informe uma quantidade de cotas válida.')
    }
    if (!transferDate) {
      return toast.error('Informe a data do aporte.')
    }

    const minQ = selectedProduct.min_quotas_per_investor || 1
    if (quotas < minQ) {
      return toast.error(`A aplicação mínima para este produto é de ${minQ} cotas.`)
    }

    // Checar duplicidade
    const isDup = await checkForDuplicates()
    if (isDup && !confirmedDuplicate) {
      setDuplicateWarning(
        `Atenção: Já foi registrado um aporte recente deste mesmo cliente (${selectedClient.full_name || selectedClient.email}) para este mesmo produto no valor de ${formatCurrency(totalValue)} nos últimos 10 minutos. Confirme se realmente deseja prosseguir com este lançamento adicional.`,
      )
      return
    }

    setDuplicateWarning(null)
    setStep(2)
  }

  const handleConfirmInvestment = async () => {
    if (!selectedClient || !selectedProduct) return
    setSaving(true)

    try {
      // 1. Inserir o aporte na tabela investments com a indicação de lançamento interno pelo admin
      const { data: inv, error: invErr } = await supabase
        .from('investments')
        .insert({
          user_id: selectedClient.id,
          product_id: selectedProduct.id,
          bank_account_id: selectedBankId || null,
          quotas,
          unit_price: unitPrice,
          total_value: totalValue,
          status: 'awaiting_review', // entra no fluxo normal de aprovação/revisão
          transfer_date: transferDate,
          transfer_value: totalValue,
          is_internal_admin: true,
          created_by_admin: user?.id || null,
        })
        .select()
        .single()

      if (invErr) throw invErr

      // 2. Acionar a Edge Function para gerar o Termo de Subscrição com o bloco de assinatura qualificada
      // Informando IP 'Lançamento interno pelo admin'
      try {
        await supabase.functions.invoke('generate-subscription-term', {
          body: {
            investmentId: inv.id,
            ipAddress: 'Lançamento interno pelo admin',
            sendEmail: true,
            forceRegenerate: true,
          },
        })
      } catch (termErr) {
        console.warn('Falha na geração assíncrona do termo:', termErr)
      }

      // 3. Pré-gerar a Cautela de Debêntures com o mesmo registro formal
      try {
        await supabase.functions.invoke('generate-debenture-cautela', {
          body: {
            investmentId: inv.id,
            ipAddress: 'Lançamento interno pelo admin',
            forceRegenerate: true,
          },
        })
      } catch (cautelaErr) {
        console.warn('Falha na emissão da cautela:', cautelaErr)
      }

      // 4. Enviar notificação in-app ao investidor
      try {
        await sendNotification({
          userId: selectedClient.id,
          title: 'Novo Aporte Registrado pela Administração',
          message: `Um aporte de ${formatCurrency(totalValue)} (${quotas} cota(s)) em ${selectedProduct.title} foi lançado internamente pela administração em sua conta. O termo de subscrição e a cautela estão disponíveis na sua carteira.`,
          type: 'success',
          link: '/investidor',
          metadata: {
            investmentId: inv.id,
            productTitle: selectedProduct.title,
            totalValue,
            quotas,
            is_internal_admin: true,
          },
        })
      } catch (notifErr) {
        console.warn('Falha ao notificar investidor:', notifErr)
      }

      // 5. Registrar no log de auditoria
      try {
        await supabase.from('audit_logs').insert({
          entity_type: 'investments',
          entity_id: inv.id,
          action: 'admin_created_internal_investment',
          details: {
            admin_id: user?.id,
            admin_email: user?.email,
            client_id: selectedClient.id,
            client_name: selectedClient.full_name || selectedClient.pj_company_name,
            product_id: selectedProduct.id,
            product_title: selectedProduct.title,
            quotas,
            unit_price: unitPrice,
            total_value: totalValue,
            transfer_date: transferDate,
            origin: 'internal_admin_entry',
          },
        })
      } catch (auditErr) {
        console.warn('Falha ao registrar audit log:', auditErr)
      }

      toast.success(
        'Aporte interno cadastrado com sucesso! Termo de subscrição formalizado e notificação enviada.',
      )
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar investimento interno.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building className="w-5 h-5 text-primary" /> Fazer Investimento para Cliente
          </DialogTitle>
          <DialogDescription>
            Lançamento interno administrativo de debêntures para clientes previamente cadastrados. O
            aporte percorre o fluxo formal com assinatura eletrônica qualificada, contrato e
            cautela.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando dados do sistema...</p>
          </div>
        ) : step === 1 ? (
          <div className="space-y-5 py-2">
            {/* 1. SELEÇÃO DE CLIENTE JÁ CADASTRADO */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center justify-between">
                <span>1. Selecionar Cliente / Investidor</span>
                {selectedClient && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cliente Selecionado
                  </Badge>
                )}
              </Label>

              {selectedClient ? (
                <div className="bg-muted/40 p-3 rounded-lg border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedClient.full_name ||
                        selectedClient.pj_company_name ||
                        'Nome não informado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      CPF/CNPJ: {selectedClient.document_number || '-'} • E-mail:{' '}
                      {selectedClient.email || '-'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary hover:text-primary/80"
                    onClick={() => {
                      setSelectedClient(null)
                      setSearchTerm('')
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente por nome, e-mail ou CPF/CNPJ..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {searchTerm.trim().length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto divide-y bg-background shadow-sm">
                      {filteredClients.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          Nenhum cliente cadastrado encontrado com este termo. (Somente clientes
                          existentes são aceitos)
                        </div>
                      ) : (
                        filteredClients.map((client) => (
                          <div
                            key={client.id}
                            className="p-2.5 hover:bg-muted/60 cursor-pointer transition-colors flex items-center justify-between text-xs"
                            onClick={() => {
                              setSelectedClient(client)
                              setSearchTerm('')
                              setDuplicateWarning(null)
                            }}
                          >
                            <div>
                              <div className="font-semibold text-foreground">
                                {client.full_name || client.pj_company_name || 'Nome não informado'}
                              </div>
                              <div className="text-muted-foreground">
                                Doc: {client.document_number || 'Sem documento'} • {client.email}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs">
                              Selecionar
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {!searchTerm && (
                    <p className="text-[11px] text-muted-foreground">
                      Digite o nome, documento ou e-mail do cliente já cadastrado no Nexum Security.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 2. SELEÇÃO DA EMISSÃO / SÉRIE DE DEBÊNTURE */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Produto / Emissão de Debênture</Label>
              <Select value={selectedProductId} onValueChange={(val) => setSelectedProductId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto de investimento" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} • {p.rate} (PU: {formatCurrency(p.quota_value || 1000)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detalhes do Produto Selecionado */}
            {selectedProduct && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-primary/5 border border-primary/15 p-3 rounded-md text-xs">
                <div>
                  <span className="text-muted-foreground block">Rentabilidade:</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {selectedProduct.rate} (
                    {selectedProduct.interest_type === 'composto' ? 'Composto' : 'Simples'})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Prazo / Carência:</span>
                  <span className="font-medium text-foreground">
                    {selectedProduct.term} • Carência:{' '}
                    {selectedProduct.min_grace_period_months || 0} meses
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Série Vinculada:</span>
                  <span className="font-medium text-foreground">
                    {selectedProduct.debenture_series?.series_number
                      ? `Série ${selectedProduct.debenture_series.series_number}`
                      : 'Série Padrão'}
                  </span>
                </div>
              </div>
            )}

            {/* 3. PARÂMETROS DO APORTE (COTAS, VALOR, DATA) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-muted-foreground" /> Quantidade de Cotas
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={quotas}
                  onChange={(e) => {
                    const q = Math.max(1, parseInt(e.target.value, 10) || 1)
                    setQuotas(q)
                    setDuplicateWarning(null)
                  }}
                />
                {selectedProduct && (
                  <p className="text-[11px] text-muted-foreground">
                    Mínimo exigido: {selectedProduct.min_quotas_per_investor || 1} cota(s)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> Data de
                  Transferência/Início
                </Label>
                <Input
                  type="date"
                  max={new Date().toLocaleDateString('en-CA')}
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Competência e início dos rendimentos pro rata die.
                </p>
              </div>
            </div>

            {/* Conta Bancária da Empresa para Liquidação do Aporte */}
            {bankAccounts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Conta Bancária da Emissora (Destino dos Fundos)
                </Label>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Conta bancária da empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bank_name} • Ag {b.branch} / CC {b.account_number} ({b.owner_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Card de Resumo Financeiro */}
            <div className="bg-muted p-4 rounded-lg flex items-center justify-between border">
              <div>
                <span className="text-xs text-muted-foreground block">
                  Valor Nominal Unitário (PU)
                </span>
                <span className="text-sm font-semibold">{formatCurrency(unitPrice)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Total a Integralizar</span>
                <span className="text-xl font-bold font-mono text-primary">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Aviso de duplicidade acidental */}
            {duplicateWarning && (
              <Alert className="bg-amber-50 border-amber-300 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 font-semibold">
                  Possível Duplicidade
                </AlertTitle>
                <AlertDescription className="text-xs mt-1 text-amber-700">
                  {duplicateWarning}
                </AlertDescription>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white border-amber-400 text-amber-900 hover:bg-amber-100"
                    onClick={() => {
                      setConfirmedDuplicate(true)
                      setDuplicateWarning(null)
                      setStep(2)
                    }}
                  >
                    Confirmar e Prosseguir Mesmo Assim
                  </Button>
                </div>
              </Alert>
            )}
          </div>
        ) : (
          /* STEP 2: REVISÃO E CONFIRMAÇÃO */
          <div className="space-y-4 py-2 text-sm">
            <Alert className="bg-blue-50 border-blue-200 text-blue-900">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-semibold">
                Revisão do Lançamento Interno
              </AlertTitle>
              <AlertDescription className="text-xs text-blue-700 mt-1">
                Ao confirmar, o sistema registrará o aporte com o selo{' '}
                <strong>Lançamento interno</strong>, formalizará o Termo de Subscrição com o bloco
                de assinatura eletrônica qualificada, emitirá a cautela de debêntures e enviará
                notificação ao investidor.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/40 p-4 rounded-lg border space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Investidor Beneficiário:</span>
                <span className="font-semibold text-foreground">
                  {selectedClient?.full_name || selectedClient?.pj_company_name} (
                  {selectedClient?.document_number || 'Sem documento'})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">E-mail:</span>
                <span className="font-medium text-foreground">{selectedClient?.email}</span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Produto / Debênture:</span>
                <span className="font-semibold text-foreground">{selectedProduct?.title}</span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Rentabilidade Contratada:</span>
                <span className="font-semibold text-emerald-600">
                  {selectedProduct?.rate} (
                  {selectedProduct?.interest_type === 'composto' ? 'Juro Composto' : 'Juro Simples'}
                  )
                </span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Quantidade de Cotas:</span>
                <span className="font-semibold text-foreground">{quotas} cota(s)</span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Data do Aporte:</span>
                <span className="font-semibold text-foreground">{transferDate}</span>
              </div>

              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Origem do Registro:</span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Lançamento interno pelo admin
                </Badge>
              </div>

              <div className="flex justify-between pt-2 text-sm font-bold text-primary">
                <span>Valor Total do Investimento:</span>
                <span className="font-mono text-base">{formatCurrency(totalValue)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t flex items-center justify-between">
          {step === 1 ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving || loadingData}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={saving || loadingData || !selectedClient || !selectedProduct}
              >
                Revisar Aporte <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                Voltar
              </Button>
              <Button onClick={handleConfirmInvestment} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSignature className="w-4 h-4" />
                )}
                Confirmar e Emitir Contrato
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
