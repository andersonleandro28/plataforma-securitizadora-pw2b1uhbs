import { useState, useEffect } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Receipt, AlertCircle, Download, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { generatePixPayload } from '@/lib/pix'

export default function MyCcbInstallments() {
  const { user } = useAuth()
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [finParams, setFinParams] = useState<any>({})
  const [selectedBoleto, setSelectedBoleto] = useState<any>(null)
  const [isPixModalOpen, setIsPixModalOpen] = useState(false)
  const [generatingPixId, setGeneratingPixId] = useState<string | null>(null)
  const [pixData, setPixData] = useState<{
    payload: string
    total: number
    isOverdue: boolean
  } | null>(null)

  useEffect(() => {
    if (!user) return
    fetchInstallments()

    const channel = supabase
      .channel('recebiveis_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () => {
        fetchInstallments() // Auto refresh on changes
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchInstallments = async () => {
    setLoading(true)

    // Fetch financial params for penalty/interest calculation
    const { data: paramsData } = await supabase.from('financial_parameters').select('*')
    const paramsMap: any = {}
    paramsData?.forEach((p) => {
      paramsMap[p.receivable_type] = p
    })
    setFinParams(paramsMap)

    const { data: ccbs } = await supabase
      .from('ccb_solicitacoes')
      .select('id')
      .eq('user_id', user!.id)
    if (ccbs && ccbs.length > 0) {
      const ccbIds = ccbs.map((c) => c.id)
      const { data: p } = await supabase.from('recebiveis_ccb').select('*').in('ccb_id', ccbIds)
      setPurchases(p || [])
    } else {
      setPurchases([])
    }
    setLoading(false)
  }

  const handleViewPdf = async (url: string) => {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (!res.ok) {
        toast.error('O documento não foi encontrado no servidor (Bucket/Arquivo inexistente).')
        return
      }
      window.open(url, '_blank')
    } catch (err) {
      window.open(url, '_blank') // Fallback if CORS prevents HEAD
    }
  }

  const calculateUpdatedValue = (baseValue: number, dueDate: string) => {
    if (!dueDate)
      return {
        baseValue,
        penalty: 0,
        interest: 0,
        total: baseValue,
        daysOverdue: 0,
        isOverdue: false,
      }

    const [year, month, day] = dueDate.split('T')[0].split('-').map(Number)
    const due = new Date(year, month - 1, day).getTime()

    const today = new Date()
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    const diffTime = now - due
    const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))

    const params = finParams['CCB'] || finParams['global'] || {}
    const gracePeriod = params.grace_period_days || 0
    const penaltyRate = params.penalty_rate || 0
    const defaultInterestRate = params.default_interest_rate || 0

    let penalty = 0
    let interest = 0

    if (daysOverdue > gracePeriod) {
      penalty = baseValue * (penaltyRate / 100)
      interest = baseValue * (defaultInterestRate / 100 / 30) * daysOverdue
    }

    return {
      baseValue,
      penalty,
      interest,
      total: baseValue + penalty + interest,
      daysOverdue,
      isOverdue: daysOverdue > gracePeriod,
    }
  }

  const handleGeneratePix = async (purchase: any, boleto: any, idx: number) => {
    const idStr = `${purchase.id}-${idx}`
    setGeneratingPixId(idStr)

    try {
      // Simulate API loading
      await new Promise((resolve) => setTimeout(resolve, 800))

      const { data: accounts } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('is_active', true)
        .limit(1)

      const account = accounts?.[0] || {
        bank_code: '000',
        bank_name: 'Securitizadora S/A',
        branch: '0001',
        account_number: '12345-6',
        owner_name: 'Securitizadora S/A',
        owner_document: '00.000.000/0001-00',
        pix_key: 'contato@securitizadora.local',
      }

      const calc = calculateUpdatedValue(Number(boleto.unit_value), boleto.due_date)
      const txid = `CCB${purchase.id.substring(0, 8).toUpperCase()}${idx + 1}`
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 25)

      const payload = generatePixPayload(
        account.pix_key,
        calc.total,
        account.owner_name || 'Securitizadora',
        'Sao Paulo',
        txid,
        `Parcela ${idx + 1}`,
      )

      setSelectedBoleto({ ...boleto, idx, purchaseId: purchase.id })
      setPixData({ payload, total: calc.total, isOverdue: calc.isOverdue })
      setIsPixModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao gerar código PIX. Tente novamente.')
    } finally {
      setGeneratingPixId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minhas Parcelas CCB</h1>
        <p className="text-muted-foreground">
          Acompanhe seus vencimentos e realize pagamentos via PIX ou Boleto.
        </p>
      </div>

      {loading && purchases.length === 0 ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : purchases.length === 0 ? (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-4 opacity-50" />
            <p>Nenhuma parcela ou contrato ativo encontrado no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {purchases.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex justify-between items-center">
                  <span>Contrato CCB #{p.ccb_id.substring(0, 8).toUpperCase()}</span>
                  <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                    Valor Total: R${' '}
                    {(p.boleto_count * p.boleto_unit_value).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </CardTitle>
                <CardDescription>
                  Emitido em {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(p.boletos || []).map((b: any, idx: number) => {
                        const calc = calculateUpdatedValue(Number(b.unit_value), b.due_date)
                        const isOverdue = calc.isOverdue && b.status !== 'Pago'
                        const isGenerating = generatingPixId === `${p.id}-${idx}`

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {idx + 1} de {p.boleto_count}
                            </TableCell>
                            <TableCell
                              className={
                                isOverdue
                                  ? 'text-rose-600 font-medium whitespace-nowrap'
                                  : 'whitespace-nowrap'
                              }
                            >
                              {b.due_date
                                ? new Date(
                                    b.due_date.split('T')[0] + 'T12:00:00',
                                  ).toLocaleDateString('pt-BR')
                                : '-'}
                              {isOverdue && ' (Vencido)'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col whitespace-nowrap">
                                {b.status === 'Pago' ? (
                                  <span
                                    className="text-emerald-600 font-bold"
                                    title={`Pago em ${b.payment_date ? new Date(b.payment_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}`}
                                  >
                                    R${' '}
                                    {(
                                      Number(b.unit_value) +
                                      Number(b.interest_applied || 0) +
                                      Number(b.penalty_applied || 0)
                                    ).toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                ) : (
                                  <>
                                    <span
                                      className={
                                        isOverdue
                                          ? 'line-through text-muted-foreground text-xs'
                                          : ''
                                      }
                                    >
                                      R${' '}
                                      {Number(b.unit_value).toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                    {isOverdue && (
                                      <span
                                        title={`Principal: R$ ${calc.baseValue.toFixed(2)} + Multa: R$ ${calc.penalty.toFixed(2)} + Juros: R$ ${calc.interest.toFixed(2)}`}
                                        className="text-rose-600 font-bold"
                                      >
                                        R${' '}
                                        {calc.total.toLocaleString('pt-BR', {
                                          minimumFractionDigits: 2,
                                        })}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${b.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}
                              >
                                {b.status === 'Pago'
                                  ? 'Pago'
                                  : isOverdue
                                    ? 'Vencido'
                                    : b.status || 'Pendente'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {b.file_url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleViewPdf(b.file_url)}
                                  >
                                    <Download className="w-4 h-4" /> Boleto
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-2"
                                  disabled={b.status === 'Pago' || isGenerating}
                                  onClick={() => handleGeneratePix(p, b, idx)}
                                >
                                  {isGenerating ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" /> Gerando...
                                    </>
                                  ) : (
                                    <>
                                      <Receipt className="w-4 h-4" /> Código PIX
                                    </>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isPixModalOpen} onOpenChange={setIsPixModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>
              Pagamento via PIX - Parcela #
              {selectedBoleto?.idx !== undefined ? selectedBoleto.idx + 1 : ''}
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo ou utilize o código Copia e Cola no app do seu banco.
            </DialogDescription>
          </DialogHeader>

          {pixData && (
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-md text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Valor a pagar {pixData.isOverdue ? '(atualizado com juros e multa)' : ''}:
                </p>
                <p className="text-3xl font-bold text-emerald-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    pixData.total,
                  )}
                </p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixData.payload)}`}
                    alt="QR Code PIX"
                    className="w-[200px] h-[200px]"
                  />
                </div>
                <div className="w-full space-y-2">
                  <Label>PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pixData.payload}
                      readOnly
                      className="font-mono text-xs bg-muted"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.payload)
                        toast.success('Código PIX copiado com sucesso!')
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
