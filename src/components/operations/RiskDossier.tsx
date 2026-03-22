import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CreditCard,
} from 'lucide-react'
import { calculateRisk, getRiskHistory } from '@/services/risk'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface RiskDossierProps {
  operationId: string
  sacadoDocument: string
  onStatusChanged?: (status: string) => void
}

export function RiskDossier({ operationId, sacadoDocument, onStatusChanged }: RiskDossierProps) {
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [creditInfo, setCreditInfo] = useState<{
    limit: number
    used: number
    requested: number
  } | null>(null)

  const fetchHistory = async () => {
    try {
      const data = await getRiskHistory(operationId)
      setHistory(data || [])
    } catch (err) {
      console.error('Erro ao buscar histórico de risco:', err)
    }
  }

  const fetchCreditInfo = async () => {
    try {
      const { data: opData } = await supabase
        .from('credit_operations')
        .select('borrower_id, requested_value')
        .eq('id', operationId)
        .single()

      if (opData) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credit_limit')
          .eq('id', opData.borrower_id)
          .single()

        const { data: usedOps } = await supabase
          .from('credit_operations')
          .select('requested_value, id')
          .eq('borrower_id', opData.borrower_id)
          .in('status', [
            'em_analise',
            'em_triagem',
            'pendencia_documental',
            'aprovado',
            'aguardando_formalizacao',
            'pago',
          ])

        let used = 0
        usedOps?.forEach((o) => {
          if (o.id !== operationId) {
            used += Number(o.requested_value || 0)
          }
        })

        setCreditInfo({
          limit: profile?.credit_limit || 100000,
          used: used,
          requested: Number(opData.requested_value || 0),
        })
      }
    } catch (err) {
      console.error('Erro ao buscar info de crédito:', err)
    }
  }

  useEffect(() => {
    fetchHistory()
    fetchCreditInfo()
  }, [operationId])

  const handleUpdate = async () => {
    setLoading(true)
    try {
      const result = await calculateRisk(operationId, sacadoDocument)
      toast.success('Análise de risco executada com sucesso.')
      fetchHistory()
      fetchCreditInfo() // Refresh credit usage

      // Notify parent if the engine automatically reproved the operation based on a hard rule
      if (
        result?.risk_level === 'Reprovação Sugerida' &&
        result.triggers?.some((t: string) => t.includes('Automaticamente'))
      ) {
        onStatusChanged?.('reprovado')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar motor de decisão.')
    } finally {
      setLoading(false)
    }
  }

  const latest = history[0]

  return (
    <Card className="shadow-none border-primary/20 bg-muted/5 relative overflow-hidden">
      <CardHeader className="p-4 pb-2 bg-primary/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Dossiê de Crédito (SIO)
          </CardTitle>
          <CardDescription className="text-xs">Motor de Decisão em Tempo Real</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleUpdate}
          disabled={loading}
          className="h-8"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar Consulta
        </Button>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {!latest ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground bg-background rounded border border-dashed text-xs text-center">
            <ShieldAlert className="w-6 h-6 mb-2 opacity-50" />
            Nenhuma análise de risco realizada para este borderô ainda. <br />
            Clique em "Atualizar Consulta".
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-background p-3 rounded border">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Decisão Sugerida
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {latest.risk_level === 'Aprovação Sugerida' && (
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  )}
                  {latest.risk_level === 'Análise Manual' && (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                  {latest.risk_level === 'Reprovação Sugerida' && (
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                  )}

                  <span
                    className={`font-semibold ${
                      latest.risk_level === 'Aprovação Sugerida'
                        ? 'text-emerald-600'
                        : latest.risk_level === 'Análise Manual'
                          ? 'text-amber-600'
                          : 'text-destructive'
                    }`}
                  >
                    {latest.risk_level}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Score Interno (SIO)
                </p>
                <p className="text-2xl font-bold font-mono">
                  {latest.sio_score}{' '}
                  <span className="text-sm font-normal text-muted-foreground">/ 100</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border rounded bg-background">
                <p className="text-xs text-muted-foreground">Score Serasa (Sacado)</p>
                <p className="text-lg font-semibold">{latest.serasa_score}</p>
              </div>
              <div className="p-3 border rounded bg-background">
                <p className="text-xs text-muted-foreground">Data da Análise</p>
                <p className="text-sm font-medium mt-1">
                  {format(new Date(latest.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>

              {creditInfo && (
                <div className="p-3 border rounded bg-background col-span-2">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Limite de Crédito Dinâmico (Cedente)
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        R$ {creditInfo.limit.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-muted-foreground">Utilizado Total: </span>
                      <span className="font-medium text-destructive">
                        R$ {(creditInfo.used + creditInfo.requested).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden flex mt-2">
                    <div
                      className="bg-destructive/70 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (creditInfo.used / (creditInfo.limit || 1)) * 100)}%`,
                      }}
                      title={`Já Utilizado: R$ ${creditInfo.used.toLocaleString('pt-BR')}`}
                    />
                    <div
                      className="bg-amber-500 h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (creditInfo.requested / (creditInfo.limit || 1)) * 100)}%`,
                      }}
                      title={`Esta Operação: R$ ${creditInfo.requested.toLocaleString('pt-BR')}`}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-right flex items-center justify-end gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-destructive/70 inline-block"></span>{' '}
                      Operações Anteriores
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>{' '}
                      Operação Atual
                    </span>
                  </p>
                </div>
              )}
            </div>

            {latest.triggers && latest.triggers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                  Gatilhos de Risco Detectados
                </p>
                <ul className="space-y-1.5">
                  {latest.triggers.map((t: string, i: number) => (
                    <li
                      key={i}
                      className="text-xs flex items-start gap-2 bg-destructive/10 text-destructive p-2 rounded"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
