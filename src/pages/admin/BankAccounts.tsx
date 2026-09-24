import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Landmark,
  Loader2,
  Plus,
  CheckCircle2,
  ArrowRightLeft,
  FileSpreadsheet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useAccounting } from '@/hooks/use-accounting'
import { fetchBankAccountBalance } from '@/services/bank-transfers'
import { BankTransferModal } from '@/components/admin/BankTransferModal'
import { BankAccountStatement } from '@/components/admin/BankAccountStatement'
import type { CompanyBankAccount } from '@/hooks/use-company-bank-accounts'

export default function BankAccounts() {
  const { user, profile, activeRole } = useAuth()
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'extrato' | 'cadastros'>('extrato')

  // Livro Caixa unificado
  const {
    data: accountingTransactions,
    loading: loadingAccounting,
    refetch: refetchAccounting,
  } = useAccounting()

  // Permissão de escrita (apenas admins e equipe autorizada; não accountant somente-leitura)
  const canWrite = useMemo(() => {
    const isSuperAdmin = profile?.email === 'andersonleandro28@gmail.com'
    const isAdmin =
      profile?.is_admin || profile?.role === 'admin' || activeRole === 'admin' || isSuperAdmin
    const isStaff = profile?.is_staff || profile?.role === 'staff' || activeRole === 'staff'
    const isAccountantOnly =
      (profile?.is_accountant || profile?.role === 'accountant' || activeRole === 'accountant') &&
      !isAdmin
    return (isAdmin || isStaff) && !isAccountantOnly
  }, [profile, activeRole])

  const [formData, setFormData] = useState({
    id: '',
    bank_code: '',
    bank_name: '',
    branch: '',
    account_number: '',
    pix_key: '',
    owner_name: '',
    owner_document: '',
    notes: '',
  })

  // Carrega contas e saldos em tempo real do Livro Caixa
  const fetchAccountsAndBalances = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setAccounts(data as CompanyBankAccount[])

        // Busca saldos de cada conta em paralelo
        const balPromises = (data as CompanyBankAccount[]).map(async (acc) => {
          const bal = await fetchBankAccountBalance(acc.id)
          return { id: acc.id, bal }
        })

        const balResults = await Promise.all(balPromises)
        const balMap: Record<string, number> = {}
        balResults.forEach((b) => {
          balMap[b.id] = b.bal
        })
        setBalances(balMap)
      }
    } catch (err) {
      console.error('Erro ao buscar contas e saldos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccountsAndBalances()
    refetchAccounting()
  }, [fetchAccountsAndBalances, refetchAccounting])

  const handleRefreshAll = () => {
    fetchAccountsAndBalances()
    refetchAccounting()
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...formData, updated_by: user?.id, updated_at: new Date().toISOString() }
      if (formData.id) {
        await supabase
          .from('company_bank_accounts')
          .update(payload as any)
          .eq('id', formData.id)
      } else {
        await supabase.from('company_bank_accounts').insert({ ...payload, id: undefined } as any)
      }
      toast.success('Conta bancária salva com sucesso.')
      setOpen(false)
      handleRefreshAll()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      await (supabase.rpc as any)('set_active_bank_account', { p_account_id: id })
      toast.success('Conta ativada com sucesso.')
      handleRefreshAll()
    } catch {
      toast.error('Erro ao ativar conta.')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
            Painel Admin &gt; Tesouraria
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">
            Extratos individuais por conta bancária, saldos em tempo real e transferências internas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button
              onClick={() => setTransferOpen(true)}
              variant="default"
              className="gap-2 bg-primary hover:bg-primary/90"
              disabled={accounts.length < 2}
              title={
                accounts.length < 2
                  ? 'É necessário ter pelo menos 2 contas cadastradas'
                  : 'Transferir saldo entre contas'
              }
            >
              <ArrowRightLeft className="h-4 w-4" /> Nova Transferência
            </Button>
          )}

          {canWrite && (
            <Button
              onClick={() => {
                setFormData({
                  id: '',
                  bank_code: '',
                  bank_name: '',
                  branch: '',
                  account_number: '',
                  pix_key: '',
                  owner_name: '',
                  owner_document: '',
                  notes: '',
                })
                setOpen(true)
              }}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Nova Conta
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="extrato" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Extrato por Conta
          </TabsTrigger>
          <TabsTrigger value="cadastros" className="gap-2">
            <Landmark className="w-4 h-4" /> Contas Cadastradas ({accounts.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: EXTRATO POR CONTA BANCÁRIA */}
        <TabsContent value="extrato" className="space-y-4">
          <BankAccountStatement
            transactions={accountingTransactions}
            accounts={accounts}
            balances={balances}
            loading={loading || loadingAccounting}
            canWrite={canWrite}
            onRefresh={handleRefreshAll}
          />
        </TabsContent>

        {/* ABA 2: GERENCIAMENTO DE CONTAS CADASTRADAS */}
        <TabsContent value="cadastros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" /> Contas Cadastradas da Securitizadora
              </CardTitle>
              <CardDescription>
                Apenas uma conta fica definida como principal para recebimentos automáticos dos
                investidores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Agência / Conta</TableHead>
                    <TableHead>Saldo em Caixa</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Titularidade</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    {canWrite && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma conta cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((acc) => {
                      const bal = balances[acc.id] ?? 0
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">
                            {acc.bank_code && (
                              <span className="text-muted-foreground mr-2 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {String(acc.bank_code).padStart(3, '0')}
                              </span>
                            )}
                            {acc.bank_name}
                          </TableCell>
                          <TableCell>
                            {acc.branch || 'S/A'} / {acc.account_number}
                          </TableCell>
                          <TableCell className="font-mono font-semibold">
                            <span className={bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(bal)}
                            </span>
                          </TableCell>
                          <TableCell>{acc.pix_key || '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{acc.owner_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {acc.owner_document}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {acc.is_active ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Principal
                              </Badge>
                            ) : (
                              <Badge variant="outline">Secundária</Badge>
                            )}
                          </TableCell>
                          {canWrite && (
                            <TableCell className="text-right space-x-2">
                              {!acc.is_active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetActive(acc.id)}
                                >
                                  Tornar Principal
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData({
                                    ...acc,
                                    bank_code: acc.bank_code || '',
                                  })
                                  setOpen(true)
                                }}
                              >
                                Editar
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{formData.id ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label>Código do Banco (COMPE/FEBRABAN)</Label>
                <Input
                  required
                  type="number"
                  min="1"
                  max="999"
                  placeholder="Ex: 001 (BB), 104 (Caixa), 547 (BNK Digital)"
                  value={formData.bank_code}
                  onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Instituição Financeira (Banco)</Label>
                <Input
                  required
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Conta Corrente</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pix_key}
                  onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Nome do Titular</Label>
                <Input
                  required
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>CNPJ/CPF do Titular</Label>
                <Input
                  required
                  value={formData.owner_document}
                  onChange={(e) => setFormData({ ...formData, owner_document: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observações de Transferência</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Transferências apenas via TED ou PIX"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE TRANSFERÊNCIA ENTRE CONTAS BANCÁRIAS */}
      <BankTransferModal
        open={transferOpen}
        onClose={setTransferOpen}
        accounts={accounts}
        balances={balances}
        onSuccess={handleRefreshAll}
      />
    </div>
  )
}
