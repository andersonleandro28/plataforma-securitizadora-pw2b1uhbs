import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { Loader2, AlertTriangle, Database, DollarSign, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export default function DataMigration() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [newBalance, setNewBalance] = useState('')
  const [openModal, setOpenModal] = useState(false)
  const [progress, setProgress] = useState(0)
  const [totalExpected] = useState(150) // Estimativa aproximada

  const navigate = useNavigate()

  useEffect(() => {
    checkExistingData()
  }, [])

  const checkExistingData = async () => {
    try {
      setChecking(true)
      const { data, error } = await supabase.from('movimentacoes_caixa').select('id').limit(1)

      if (error) throw error
      if (data && data.length > 0) {
        setHasData(true)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao verificar dados existentes')
    } finally {
      setChecking(false)
    }
  }

  const handleMigrate = async () => {
    try {
      setLoading(true)
      setProgress(0)

      // Simula progresso visual na interface enquanto o banco processa
      const interval = setInterval(() => {
        setProgress((p) => (p < totalExpected - 1 ? p + 1 : p))
      }, 80)

      const { data, error } = await supabase.rpc('migrar_dados_historicos', { p_saldo_inicial: 0 })
      clearInterval(interval)

      if (error) throw error

      setProgress(data.count || 0)
      toast.success(`Migração concluída! ${data.count || 0} registros migrados com sucesso.`)
      setTimeout(() => {
        navigate('/admin/accounting')
      }, 2000)
    } catch (err: any) {
      console.error(err)
      toast.error('Erro na migração: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdjustBalance = async () => {
    const val = parseFloat(newBalance.replace(',', '.'))
    if (isNaN(val)) {
      toast.error('Informe um valor válido')
      return
    }

    try {
      setAdjusting(true)
      const { data, error } = await supabase.rpc('recalcular_saldo_caixa', { p_saldo_inicial: val })

      if (error) throw error

      toast.success(`Saldo ajustado com sucesso. Novo saldo final: R$ ${data.saldo_final}`)
      setOpenModal(false)
      setNewBalance('')
    } catch (err: any) {
      console.error(err)
      toast.error('Erro ao ajustar saldo: ' + err.message)
    } finally {
      setAdjusting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Migração de Dados Históricos</h1>
        <p className="text-muted-foreground mt-2">
          Esta ação irá consolidar todos os dados históricos na nova página de Tesouraria. Esta ação
          é irreversível.
        </p>
      </div>

      {hasData && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dados já foram migrados</AlertTitle>
          <AlertDescription>
            Já existem registros de caixa. Deseja migrar novamente? (Os registros atuais serão
            deletados e recalculados a partir do histórico).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Consolidar Histórico
          </CardTitle>
          <CardDescription>
            Buscaremos todas as subscrições, recebíveis, CCBs, despesas e fornecedores do passado,
            gerando os fluxos de caixa cronologicamente. O saldo será recalculado do zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 bg-muted p-4 rounded-md border">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <label
              htmlFor="confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirmo que desejo migrar todos os dados históricos
            </label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center bg-muted/50 py-4 border-t">
          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <DollarSign className="w-4 h-4" /> Ajustar Saldo Base
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajustar Saldo Inicial</DialogTitle>
                <DialogDescription>
                  Defina um valor base e recalcularemos todos os saldos a partir dele.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="balance">Novo saldo inicial (R$ 0.00)</Label>
                  <Input
                    id="balance"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAdjustBalance} disabled={adjusting}>
                  {adjusting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar e Recalcular
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={handleMigrate} disabled={!confirmed || loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Migrando {progress} de {totalExpected}{' '}
                registros...
              </>
            ) : (
              <>
                Iniciar Migração <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
