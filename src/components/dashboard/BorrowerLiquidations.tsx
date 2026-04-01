import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { generatePixPayload } from '@/lib/pix'
import { QrCode, Upload, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export function BorrowerLiquidations() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOp, setSelectedOp] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bankInfo, setBankInfo] = useState<any>(null)
  const [pixPayload, setPixPayload] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchLiquidations = async () => {
    if (!user) return
    setLoading(true)

    const { data: ops } = await supabase
      .from('credit_operations')
      .select(
        'id, status, requested_value, due_date, face_value, operation_calculations(net_value), payment_receipt_url',
      )
      .eq('borrower_id', user.id)
      .in('status', [
        'aguardando_liquidacao',
        'pagamento_recebido_pendente_analise',
        'pagamento_invalido',
      ])
      .order('due_date', { ascending: true })

    if (ops) setOperations(ops)
    setLoading(false)
  }

  useEffect(() => {
    fetchLiquidations()
  }, [user])

  const handlePayClick = async (op: any) => {
    setSelectedOp(op)

    const { data: accounts } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('is_active', true)
      .limit(1)

    // Fallback if no specific company account, fetch from user if applicable or just use mock
    const account = accounts?.[0] || {
      bank_code: '000',
      bank_name: 'Securitizadora S/A',
      branch: '0001',
      account_number: '12345-6',
      owner_name: 'Securitizadora S/A',
      owner_document: '00.000.000/0001-00',
      pix_key: 'contato@securitizadora.local',
    }
    setBankInfo(account)

    if (account?.pix_key) {
      const netValue = op.operation_calculations?.[0]?.net_value || op.face_value
      const txid = op.id.substring(0, 25).replace(/[^a-zA-Z0-9]/g, '')
      const payload = generatePixPayload(
        account.pix_key,
        netValue,
        'Securitizadora',
        'Sao Paulo',
        txid,
        `Cessao ${op.id.substring(0, 8)}`,
      )
      setPixPayload(payload)
    }

    setIsModalOpen(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedOp) return

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'O arquivo deve ter no máximo 5MB.',
        variant: 'destructive',
      })
      return
    }

    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast({
        title: 'Erro',
        description: 'Formato inválido. Envie PDF, JPG ou PNG.',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${selectedOp.id}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('comprovantes_liquidacao')
        .upload(filePath, file, { upsert: true })

      if (uploadErr) throw uploadErr

      const { error: updateErr } = await supabase
        .from('credit_operations')
        .update({
          payment_receipt_url: filePath,
          status: 'pagamento_recebido_pendente_analise',
        })
        .eq('id', selectedOp.id)

      if (updateErr) throw updateErr

      await supabase.from('operation_status_history').insert({
        operation_id: selectedOp.id,
        old_status: selectedOp.status,
        new_status: 'pagamento_recebido_pendente_analise',
        borrower_observation: 'Comprovante de pagamento enviado pelo tomador.',
      })

      toast({
        title: 'Sucesso',
        description: 'Comprovante enviado com sucesso! Aguarde a análise.',
      })
      setIsModalOpen(false)
      fetchLiquidations()
    } catch (err: any) {
      toast({
        title: 'Erro ao enviar comprovante',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const checkOverdue = (dueDate: string) => {
    const due = new Date(dueDate).getTime()
    const now = new Date().getTime()
    return now - due > 7 * 24 * 60 * 60 * 1000 // 7 dias timeout
  }

  if (loading)
    return <div className="p-8 text-center text-muted-foreground">Carregando liquidações...</div>

  if (operations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4 opacity-20" />
          <CardTitle className="mb-2">Nenhuma Liquidação Pendente</CardTitle>
          <CardDescription>
            Você não possui operações aguardando pagamento neste momento.
          </CardDescription>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {operations.map((op) => {
        const isOverdue = checkOverdue(op.due_date)
        return (
          <Card
            key={op.id}
            className={`overflow-hidden border-l-4 ${isOverdue ? 'border-l-destructive' : 'border-l-primary'}`}
          >
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">
                      Cessão #{op.id.split('-')[0].toUpperCase()}
                    </h3>
                    {op.status === 'aguardando_liquidacao' && (
                      <Badge variant="secondary">Aguardando Pagamento</Badge>
                    )}
                    {op.status === 'pagamento_recebido_pendente_analise' && (
                      <Badge className="bg-amber-500">Em Análise</Badge>
                    )}
                    {op.status === 'pagamento_invalido' && (
                      <Badge variant="destructive">Pagamento Inválido</Badge>
                    )}
                    {isOverdue && op.status === 'aguardando_liquidacao' && (
                      <Badge variant="destructive">Atrasado (+7 dias)</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:flex md:gap-8 text-sm text-muted-foreground">
                    <div>
                      <span className="block text-xs">Vencimento</span>
                      <strong className="text-foreground">
                        {new Date(op.due_date).toLocaleDateString('pt-BR')}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-xs">Valor Líquido</span>
                      <strong className="text-foreground">
                        {formatCurrency(op.operation_calculations?.[0]?.net_value || op.face_value)}
                      </strong>
                    </div>
                  </div>
                  {op.status === 'pagamento_invalido' && (
                    <p className="text-sm text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="w-4 h-4" /> O comprovante enviado foi reprovado. Por
                      favor, envie novamente.
                    </p>
                  )}
                </div>
                <div className="w-full md:w-auto">
                  {op.status === 'pagamento_recebido_pendente_analise' ? (
                    <Button variant="outline" disabled className="w-full">
                      <Clock className="w-4 h-4 mr-2" /> Em Análise
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePayClick(op)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      <QrCode className="w-4 h-4 mr-2" /> Pagar via PIX
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo ou utilize os dados bancários para realizar a liquidação.
            </DialogDescription>
          </DialogHeader>

          {selectedOp && (
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-md text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Valor a pagar{' '}
                  {checkOverdue(selectedOp.due_date) ? '(com juros e multa automáticos)' : ''}:
                </p>
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(
                    selectedOp.operation_calculations?.[0]?.net_value || selectedOp.face_value,
                  )}
                </p>
              </div>

              {pixPayload ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`}
                      alt="QR Code PIX"
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                  <div className="w-full space-y-2">
                    <Label>PIX Copia e Cola</Label>
                    <div className="flex gap-2">
                      <Input value={pixPayload} readOnly className="font-mono text-xs bg-muted" />
                      <Button
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(pixPayload)
                          toast({ title: 'Copiado!' })
                        }}
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>
                </div>
              ) : bankInfo ? (
                <div className="bg-muted/50 p-4 rounded-md space-y-2 text-sm">
                  <p>
                    <strong>Banco:</strong> {bankInfo.bank_code} - {bankInfo.bank_name}
                  </p>
                  <p>
                    <strong>Agência:</strong> {bankInfo.branch} | <strong>Conta:</strong>{' '}
                    {bankInfo.account_number}
                  </p>
                  <p>
                    <strong>Titular:</strong> {bankInfo.owner_name} | <strong>Documento:</strong>{' '}
                    {bankInfo.owner_document}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 text-amber-800 p-4 rounded-md text-sm flex gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>Dados bancários indisponíveis no momento.</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-base">Já realizou o pagamento?</Label>
                  <p className="text-sm text-muted-foreground">
                    Envie o comprovante para análise da nossa equipe.
                  </p>
                </div>

                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {uploading ? 'Enviando...' : 'Anexar Comprovante'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  PDF, JPG ou PNG. Máx: 5MB.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
