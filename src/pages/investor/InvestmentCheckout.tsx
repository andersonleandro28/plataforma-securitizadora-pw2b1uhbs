import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileUpload } from '@/components/operations/FileUpload'
import { ArrowLeft, Landmark, Loader2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'

export default function InvestmentCheckout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [investment, setInvestment] = useState<any>(null)

  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [transferValue, setTransferValue] = useState('')
  const [files, setFiles] = useState<File[]>([])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const { data } = await supabase
        .from('investments')
        .select('*, investment_products(title), company_bank_accounts(*)')
        .eq('id', id)
        .single()
      if (data) {
        setInvestment(data)
        setTransferValue(data.total_value.toString())
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSubmit = async () => {
    if (files.length === 0) return toast.error('Anexe o comprovante de transferência.')
    if (!transferValue) return toast.error('Informe o valor exato transferido.')
    setSaving(true)

    try {
      const file = files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${user?.id}/${id}_${Date.now()}.${fileExt}`

      const { error: uploadErr } = await supabase.storage
        .from('investment-proofs')
        .upload(filePath, file)
      if (uploadErr) throw uploadErr

      await supabase
        .from('investment_proofs')
        .insert({
          investment_id: id,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        })

      const { error } = await supabase
        .from('investments')
        .update({
          status: 'awaiting_review',
          transfer_date: transferDate,
          transfer_value: Number(transferValue),
        })
        .eq('id', id)
      if (error) throw error

      toast.success('Comprovante enviado! Aguarde nossa conferência.')
      navigate('/')
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  if (!investment) return <div className="text-center py-20">Investimento não encontrado.</div>

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  const bank = investment.company_bank_accounts

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 -ml-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Confirme seu Depósito</h1>
        <p className="text-muted-foreground">
          Envie o comprovante para finalizar seu aporte em{' '}
          <strong>{investment.investment_products?.title}</strong>.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5 text-primary" /> Dados para Transferência
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {bank ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground">Banco</p>
                <p className="font-semibold">{bank.bank_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Agência / Conta</p>
                <p className="font-semibold">
                  {bank.branch} / {bank.account_number}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Titular</p>
                <p className="font-semibold">
                  {bank.owner_name} - CNPJ: {bank.owner_document}
                </p>
              </div>
              {bank.pix_key && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Chave PIX</p>
                  <p className="font-mono font-semibold text-primary">{bank.pix_key}</p>
                </div>
              )}
              {bank.notes && (
                <div className="sm:col-span-2 pt-2">
                  <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-primary/10">
                    {bank.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-destructive font-medium">Dados bancários indisponíveis.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Envio de Comprovante</CardTitle>
          <CardDescription>
            Total esperado: {formatCurrency(investment.total_value)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da Transferência</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Efetivo Transferido</Label>
              <Input
                type="number"
                step="0.01"
                value={transferValue}
                onChange={(e) => setTransferValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Comprovante (PDF ou Imagem)</Label>
            <FileUpload
              files={files}
              setFiles={setFiles}
              maxSizeMB={10}
              allowedTypes={['.pdf', '.jpg', '.jpeg', '.png']}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end bg-muted/10 border-t pt-4">
          <Button
            onClick={handleSubmit}
            disabled={saving || files.length === 0}
            size="lg"
            className="min-w-[150px] gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{' '}
            Enviar para Conferência
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
