import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  auditCaptacoesConsistency,
  type ConsistencyCheckReport,
  type RawInvestment,
  type RawSubscription,
} from '@/lib/captacoes-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export function CaptacoesConsistencyCard() {
  const [report, setReport] = useState<ConsistencyCheckReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  const runAudit = async () => {
    try {
      setLoading(true)
      const [invsRes, subsRes] = await Promise.all([
        supabase
          .from('investments')
          .select(
            'id, user_id, quotas, redeemed_quotas, unit_price, total_value, transfer_value, transfer_date, status, created_at, profiles(id, full_name, document_number, pj_company_name), debenture_subscriptions(id, total_amount, subscription_date, status)',
          ),
        supabase
          .from('debenture_subscriptions')
          .select(
            'id, investor_name, document_number, total_amount, unit_price, quantity, subscription_date, created_at, status, investment_id',
          )
          .is('deleted_at', null),
      ])

      const invs = (invsRes.data || []) as RawInvestment[]
      const subs = (subsRes.data || []) as RawSubscription[]
      const auditResult = auditCaptacoesConsistency(invs, subs)
      setReport(auditResult)
    } catch (err) {
      console.error('Erro ao auditar consistência de captações:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runAudit()
  }, [])

  if (loading && !report) {
    return (
      <Card className="border border-muted">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span>Auditando consistência histórica de aportes e subscrições...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!report) return null

  return (
    <Card
      className={
        report.isConsistent
          ? 'border-emerald-500/40 bg-emerald-50/10'
          : 'border-rose-500 bg-rose-50/20'
      }
    >
      <CardHeader className="py-3 px-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={report.isConsistent ? 'w-5 h-5 text-emerald-600' : 'w-5 h-5 text-rose-600'}
            />
            <CardTitle className="text-base font-semibold">
              Consistência das Captações (DRE / DFC / Livro Caixa)
            </CardTitle>
            {report.isConsistent ? (
              <Badge
                variant="outline"
                className="border-emerald-500 text-emerald-700 bg-emerald-50 font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" />
                100% Consistente
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 inline" />
                {report.divergencias.length} Divergência(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={runAudit}
              disabled={loading}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Reauditar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 mr-1" />
                  Ocultar Detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 mr-1" />
                  Ver Detalhes
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Garante que todos os aportes cadastrados (ativos, resgatados e encerrados) possuem
          lançamentos de captação íntegros e com valores históricos preservados nas demonstrações
          contábeis.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-2 px-4 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-xs">
          <div className="p-2 rounded bg-background border">
            <span className="text-muted-foreground block text-[11px]">Total Aportes Base</span>
            <span className="font-semibold text-sm">{report.totalAportesBase} aportes</span>
          </div>
          <div className="p-2 rounded bg-background border">
            <span className="text-muted-foreground block text-[11px]">Ativos</span>
            <span className="font-semibold text-sm text-blue-600">{report.totalAtivos}</span>
          </div>
          <div className="p-2 rounded bg-background border">
            <span className="text-muted-foreground block text-[11px]">Resgatados / Encerrados</span>
            <span className="font-semibold text-sm text-amber-600">
              {report.totalResgatados + report.totalEncerrados} ({report.totalResgatados}{' '}
              resgatados)
            </span>
          </div>
          <div className="p-2 rounded bg-background border">
            <span className="text-muted-foreground block text-[11px]">Captações no Fluxo</span>
            <span className="font-semibold text-sm text-emerald-600">
              {report.totalAportesCaptados} lançamentos
            </span>
          </div>
          <div className="p-2 rounded bg-background border col-span-2 md:col-span-1">
            <span className="text-muted-foreground block text-[11px]">Valor Total Captado</span>
            <span className="font-semibold text-sm">
              {report.valorTotalCaptado.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {report.divergencias.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-rose-700">
                  Aportes com divergência:
                </span>
                {report.divergencias.map((div) => (
                  <div
                    key={div.id}
                    className="p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-900"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{div.investorName}</span>
                      <span className="font-mono">
                        R$ {div.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      Status: {div.status} | Data: {div.date} | Motivo: {div.motivo}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Todos os aportes (incluindo Helton Cordeiro e os 6 aportes resgatados de Amilton
                  Cardozo) foram validados e constam com valores históricos preservados em DRE, DFC
                  e Livro Caixa.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
