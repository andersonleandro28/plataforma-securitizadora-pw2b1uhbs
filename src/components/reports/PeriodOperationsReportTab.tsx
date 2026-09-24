import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { exportToCSV } from '@/lib/export-utils'
import { formatDate, cn } from '@/lib/utils'
import {
  fetchInvestorYieldsForMonth,
  fetchDreResultForPeriod,
  calculatePeriodTaxes,
  type PeriodTaxCalculation,
} from '@/lib/period-tax-service'
import {
  Search,
  Calendar,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  TrendingDown,
  Wallet,
  Receipt,
  AlertCircle,
  FileText,
  BadgePercent,
  CheckCircle2,
  Clock,
  Landmark,
  Calculator,
  ShieldCheck,
  Scale,
  Percent,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReceivablesOperationItem {
  id: string
  contractNumber: string
  operationDate: string // issue_date
  dueDate: string // due_date
  receivableType: string
  borrowerName: string
  borrowerDocument: string
  taxRegime: string
  sacadoName: string
  sacadoDocument: string
  faceValue: number
  paidValue: number // net_value
  discountValue: number // faceValue - paidValue
  discountPct: number // (discountValue / faceValue) * 100
  effectiveRate: number // effective_cost_rate
  installmentsCount: number
  iofFixed: number
  iofDaily: number
  totalIof: number
  interestValue: number
  adValoremValue: number
  status: string
}

export interface CcbOperationItem {
  id: string
  ccbNumber: string
  operationDate: string // created_at
  tomadorName: string
  tomadorDocument: string
  taxRegime: string
  partnerBank: string
  termMonths: number
  boletoCount: number
  boletoUnitValue: number
  faceValue: number // boletoCount * boletoUnitValue
  paidValue: number // acquisition_value
  discountValue: number // faceValue - paidValue
  discountPct: number // (discountValue / faceValue) * 100
  tirEffective: number
  provisionAmount: number
  status: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)

const formatPercent = (value: number) =>
  `${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

function formatCpfCnpj(val: string | null | undefined): string {
  if (!val) return '—'
  const digits = val.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  return val
}

const formatTaxRegime = (regime: string | null | undefined) => {
  if (!regime) return 'Não informado'
  const r = regime.toLowerCase()
  if (r.includes('simples')) return 'Simples Nacional'
  if (r.includes('presumido')) return 'Lucro Presumido'
  if (r.includes('real')) return 'Lucro Real'
  if (r.includes('mei')) return 'MEI'
  return regime
}

export function PeriodOperationsReportTab() {
  const [receivablesOps, setReceivablesOps] = useState<ReceivablesOperationItem[]>([])
  const [ccbOps, setCcbOps] = useState<CcbOperationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTax, setLoadingTax] = useState(false)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')

  // Dados auxiliares da apuração tributária (despesas de captação e DRE)
  const [despesasCaptacao, setDespesasCaptacao] = useState<number>(0)
  const [dreResult, setDreResult] = useState<{
    totalReceitas: number
    totalDespesas: number
    resultado: number
  }>({
    totalReceitas: 0,
    totalDespesas: 0,
    resultado: 0,
  })

  // Competência selecionada (formato YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Lista de competências disponíveis (últimos 36 meses até 6 meses à frente)
  const availableMonths = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const now = new Date()
    // 36 meses para trás
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      const monthName = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      options.push({ value, label: `${capitalized} (${value})` })
    }
    return options
  }, [])

  /* ------------------------------------------------------------------ */
  /* Carga de Dados do Banco Real                                       */
  /* ------------------------------------------------------------------ */

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // 1. Operações de Antecipação de Recebíveis
      const { data: creditOpsData, error: opsErr } = await supabase
        .from('credit_operations')
        .select(`
          id,
          document_number,
          receivable_type,
          receivable_type_other,
          cedente,
          sacado,
          sacado_document,
          face_value,
          requested_value,
          issue_date,
          due_date,
          installments,
          status,
          profiles!credit_operations_borrower_id_fkey (
            id,
            full_name,
            document_number,
            pj_company_name,
            pj_tax_regime,
            entity_type
          ),
          operation_calculations (
            net_value,
            discount_value,
            interest_value,
            ad_valorem_value,
            iof_fixed_value,
            iof_daily_value,
            total_discounts,
            effective_cost_rate
          )
        `)
        .not('status', 'in', '("cancelado","excluido","reprovado")')
        .order('issue_date', { ascending: false })

      if (opsErr) throw opsErr

      // 2. Operações de CCBs (recebiveis_ccb)
      const { data: ccbData, error: ccbErr } = await supabase
        .from('recebiveis_ccb')
        .select(`
          id,
          acquisition_value,
          boleto_count,
          boleto_unit_value,
          gross_profit,
          tir_effective,
          provision_amount,
          status,
          created_at,
          ccb_solicitacoes (
            id,
            term_months,
            operation_data,
            borrower_data
          ),
          profiles!recebiveis_ccb_tomador_id_fkey (
            id,
            full_name,
            document_number,
            pj_company_name,
            pj_tax_regime,
            entity_type
          )
        `)
        .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")')
        .order('created_at', { ascending: false })

      if (ccbErr) throw ccbErr

      // Mapear operações de crédito
      const mappedReceivables: ReceivablesOperationItem[] = (creditOpsData || []).map((op: any) => {
        const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
        const calc = Array.isArray(op.operation_calculations)
          ? op.operation_calculations[0]
          : op.operation_calculations

        const faceVal = Number(op.face_value || 0)
        // Preço pago é o net_value calculado; se não houver cálculo, cai para requested_value
        const paidVal = Number(calc?.net_value ?? op.requested_value ?? faceVal)
        const discountVal = Number(calc?.total_discounts ?? Math.max(0, faceVal - paidVal))
        const discountPct = faceVal > 0 ? (discountVal / faceVal) * 100 : 0

        const iofFixo = Number(calc?.iof_fixed_value || 0)
        const iofDiario = Number(calc?.iof_daily_value || 0)

        const borrowerName =
          prof?.pj_company_name || prof?.full_name || op.cedente || 'Não informado'
        const borrowerDoc = prof?.document_number || ''

        const displayType =
          op.receivable_type === 'outro' && op.receivable_type_other
            ? op.receivable_type_other
            : op.receivable_type || 'Recebível'

        return {
          id: op.id,
          contractNumber: op.document_number || `OP-${op.id.substring(0, 8).toUpperCase()}`,
          operationDate: op.issue_date,
          dueDate: op.due_date,
          receivableType: displayType,
          borrowerName,
          borrowerDocument: borrowerDoc,
          taxRegime: prof?.pj_tax_regime || '',
          sacadoName: op.sacado || 'Diversos / Carteira',
          sacadoDocument: op.sacado_document || '',
          faceValue: faceVal,
          paidValue: paidVal,
          discountValue: discountVal,
          discountPct,
          effectiveRate: Number(calc?.effective_cost_rate || 0),
          installmentsCount: Number(op.installments || 1),
          iofFixed: iofFixo,
          iofDaily: iofDiario,
          totalIof: iofFixo + iofDiario,
          interestValue: Number(calc?.interest_value || 0),
          adValoremValue: Number(calc?.ad_valorem_value || 0),
          status: op.status || 'ativo',
        }
      })

      // Mapear operações de CCB
      const mappedCcb: CcbOperationItem[] = (ccbData || []).map((rec: any) => {
        const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
        const ccbSol = Array.isArray(rec.ccb_solicitacoes)
          ? rec.ccb_solicitacoes[0]
          : rec.ccb_solicitacoes

        const count = Number(rec.boleto_count || 0)
        const unitVal = Number(rec.boleto_unit_value || 0)
        const faceVal = count * unitVal
        const paidVal = Number(rec.acquisition_value || 0)
        const discountVal = Number(rec.gross_profit ?? Math.max(0, faceVal - paidVal))
        const discountPct = faceVal > 0 ? (discountVal / faceVal) * 100 : 0

        const tomadorName =
          prof?.pj_company_name || prof?.full_name || ccbSol?.borrower_data?.name || 'Não informado'
        const tomadorDoc = prof?.document_number || ccbSol?.borrower_data?.cpf || ''

        // Banco parceiro ou convênio da CCB
        const partner = ccbSol?.operation_data?.partner_bank || 'BDIGITAL'
        const termMonths = Number(ccbSol?.term_months || count || 0)

        // Data da operação extraída de created_at (formato ISO YYYY-MM-DD)
        const rawDate = rec.created_at ? rec.created_at.split('T')[0] : ''

        return {
          id: rec.id,
          ccbNumber: ccbSol?.id
            ? `CCB-${ccbSol.id.substring(0, 8).toUpperCase()}`
            : `AQC-${rec.id.substring(0, 8).toUpperCase()}`,
          operationDate: rawDate,
          tomadorName,
          tomadorDocument: tomadorDoc,
          taxRegime: prof?.pj_tax_regime || '',
          partnerBank: partner,
          termMonths,
          boletoCount: count,
          boletoUnitValue: unitVal,
          faceValue: faceVal,
          paidValue: paidVal,
          discountValue: discountVal,
          discountPct,
          tirEffective: Number(rec.tir_effective || 0),
          provisionAmount: Number(rec.provision_amount || 0),
          status: rec.status || 'Ativo',
        }
      })

      setReceivablesOps(mappedReceivables)
      setCcbOps(mappedCcb)
    } catch (e) {
      console.error('Erro ao carregar operações do período:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carregar despesas de captação (Investor Yields) e DRE para a competência selecionada
  useEffect(() => {
    let isCancelled = false
    async function loadTaxAuxiliaryData() {
      setLoadingTax(true)
      try {
        const [y, m] = selectedMonth.split('-')
        const yearNum = parseInt(y, 10)
        const monthNum = parseInt(m, 10)
        const firstDay = `${selectedMonth}-01`
        const lastDayDate = new Date(yearNum, monthNum, 0)
        const lastDay = `${selectedMonth}-${String(lastDayDate.getDate()).padStart(2, '0')}`

        const [yieldsMonth, dre] = await Promise.all([
          fetchInvestorYieldsForMonth(selectedMonth),
          fetchDreResultForPeriod(firstDay, lastDay),
        ])

        if (!isCancelled) {
          setDespesasCaptacao(yieldsMonth || 0)
          setDreResult(dre)
        }
      } catch (err) {
        console.error('Erro ao carregar dados tributários auxiliares:', err)
      } finally {
        if (!isCancelled) {
          setLoadingTax(false)
        }
      }
    }

    loadTaxAuxiliaryData()
    return () => {
      isCancelled = true
    }
  }, [selectedMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* ------------------------------------------------------------------ */
  /* Filtragem por Competência e Busca                                   */
  /* ------------------------------------------------------------------ */

  const { filteredReceivables, filteredCcbs, receivablesTotals, ccbTotals, consolidatedTotals } =
    useMemo(() => {
      const term = search.trim().toLowerCase()

      // Filtrar antecipações pela competência do selectedMonth (YYYY-MM) sobre operationDate (issue_date)
      const recList = receivablesOps.filter((op) => {
        if (!op.operationDate) return false
        const opMonth = op.operationDate.substring(0, 7) // YYYY-MM
        if (opMonth !== selectedMonth) return false

        if (!term) return true
        return (
          op.contractNumber.toLowerCase().includes(term) ||
          op.borrowerName.toLowerCase().includes(term) ||
          op.borrowerDocument.includes(term) ||
          op.sacadoName.toLowerCase().includes(term) ||
          op.sacadoDocument.includes(term) ||
          op.receivableType.toLowerCase().includes(term)
        )
      })

      // Filtrar CCBs pela competência do selectedMonth sobre operationDate (created_at)
      const ccbList = ccbOps.filter((c) => {
        if (!c.operationDate) return false
        const cMonth = c.operationDate.substring(0, 7)
        if (cMonth !== selectedMonth) return false

        if (!term) return true
        return (
          c.ccbNumber.toLowerCase().includes(term) ||
          c.tomadorName.toLowerCase().includes(term) ||
          c.tomadorDocument.includes(term) ||
          c.partnerBank.toLowerCase().includes(term)
        )
      })

      // Totais de Recebíveis
      const rTotals = recList.reduce(
        (acc, it) => {
          acc.count += 1
          acc.face += it.faceValue
          acc.paid += it.paidValue
          acc.discount += it.discountValue
          acc.iof += it.totalIof
          return acc
        },
        { count: 0, face: 0, paid: 0, discount: 0, iof: 0 },
      )

      // Totais de CCBs
      const cTotals = ccbList.reduce(
        (acc, it) => {
          acc.count += 1
          acc.face += it.faceValue
          acc.paid += it.paidValue
          acc.discount += it.discountValue
          acc.provision += it.provisionAmount
          return acc
        },
        { count: 0, face: 0, paid: 0, discount: 0, provision: 0 },
      )

      // Totais Consolidados Gerais
      const totalOps = rTotals.count + cTotals.count
      const totalFace = rTotals.face + cTotals.face
      const totalPaid = rTotals.paid + cTotals.paid
      const totalDiscount = rTotals.discount + cTotals.discount
      const avgDiscountPct = totalFace > 0 ? (totalDiscount / totalFace) * 100 : 0

      return {
        filteredReceivables: recList,
        filteredCcbs: ccbList,
        receivablesTotals: {
          ...rTotals,
          discountPct: rTotals.face > 0 ? (rTotals.discount / rTotals.face) * 100 : 0,
        },
        ccbTotals: {
          ...cTotals,
          discountPct: cTotals.face > 0 ? (cTotals.discount / cTotals.face) * 100 : 0,
        },
        consolidatedTotals: {
          count: totalOps,
          face: totalFace,
          paid: totalPaid,
          discount: totalDiscount,
          discountPct: avgDiscountPct,
          iof: rTotals.iof,
          provision: cTotals.provision,
        },
      }
    }, [receivablesOps, ccbOps, selectedMonth, search])

  const selectedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-')
    const dateObj = new Date(Number(y), Number(m) - 1, 1)
    const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [selectedMonth])

  // Apuração tributária calculada para a competência
  const taxCalculation: PeriodTaxCalculation = useMemo(() => {
    return calculatePeriodTaxes({
      receitaBrutaRecebiveis: receivablesTotals.discount,
      receitaBrutaCcbs: ccbTotals.discount,
      despesasCaptacao,
      lucroReal: dreResult.resultado,
      receitasDre: dreResult.totalReceitas,
      despesasDre: dreResult.totalDespesas,
    })
  }, [receivablesTotals.discount, ccbTotals.discount, despesasCaptacao, dreResult])

  /* ------------------------------------------------------------------ */
  /* Exportações CSV e Impressão                                        */
  /* ------------------------------------------------------------------ */

  const handleExportCSV = () => {
    const rows: Record<string, any>[] = []

    // 1. Linhas de Recebíveis
    filteredReceivables.forEach((r) => {
      rows.push({
        'Tipo Operação': `Antecipação (${r.receivableType})`,
        'Contrato / ID': r.contractNumber,
        'Data Operação': r.operationDate ? formatDate(r.operationDate) : '—',
        'Vencimento Final': r.dueDate ? formatDate(r.dueDate) : '—',
        'Cedente / Tomador': r.borrowerName,
        'CPF/CNPJ Cedente': r.borrowerDocument || '—',
        'Regime Tributário': formatTaxRegime(r.taxRegime),
        'Sacado / Devedor': r.sacadoName,
        'CPF/CNPJ Sacado': r.sacadoDocument || '—',
        Parcelas: r.installmentsCount,
        'Preço de Face (R$)': r.faceValue.toFixed(2),
        'Preço Pago / Aquisição (R$)': r.paidValue.toFixed(2),
        'Deságio Nominal (R$)': r.discountValue.toFixed(2),
        'Deságio (%)': r.discountPct.toFixed(2),
        'Taxa Efetiva / CET (%)': r.effectiveRate.toFixed(2),
        'IOF Retido (R$)': r.totalIof.toFixed(2),
        Status: r.status,
      })
    })

    // Subtotal Recebíveis
    if (filteredReceivables.length > 0) {
      rows.push({
        'Tipo Operação': 'SUBTOTAL ANTECIPAÇÃO DE RECEBÍVEIS',
        'Contrato / ID': `${receivablesTotals.count} op(s)`,
        'Data Operação': '—',
        'Vencimento Final': '—',
        'Cedente / Tomador': '—',
        'CPF/CNPJ Cedente': '—',
        'Regime Tributário': '—',
        'Sacado / Devedor': '—',
        'CPF/CNPJ Sacado': '—',
        Parcelas: '—',
        'Preço de Face (R$)': receivablesTotals.face.toFixed(2),
        'Preço Pago / Aquisição (R$)': receivablesTotals.paid.toFixed(2),
        'Deságio Nominal (R$)': receivablesTotals.discount.toFixed(2),
        'Deságio (%)': receivablesTotals.discountPct.toFixed(2),
        'Taxa Efetiva / CET (%)': '—',
        'IOF Retido (R$)': receivablesTotals.iof.toFixed(2),
        Status: '—',
      })
    }

    // 2. Linhas de CCBs
    filteredCcbs.forEach((c) => {
      rows.push({
        'Tipo Operação': 'Aquisição de CCB',
        'Contrato / ID': c.ccbNumber,
        'Data Operação': c.operationDate ? formatDate(c.operationDate) : '—',
        'Vencimento Final': `Prazo: ${c.termMonths} meses`,
        'Cedente / Tomador': c.tomadorName,
        'CPF/CNPJ Cedente': c.tomadorDocument || '—',
        'Regime Tributário': formatTaxRegime(c.taxRegime),
        'Sacado / Devedor': `Parceiro: ${c.partnerBank}`,
        'CPF/CNPJ Sacado': '—',
        Parcelas: c.boletoCount,
        'Preço de Face (R$)': c.faceValue.toFixed(2),
        'Preço Pago / Aquisição (R$)': c.paidValue.toFixed(2),
        'Deságio Nominal (R$)': c.discountValue.toFixed(2),
        'Deságio (%)': c.discountPct.toFixed(2),
        'Taxa Efetiva / CET (%)': c.tirEffective.toFixed(2),
        'IOF Retido (R$)': '—',
        Status: c.status,
      })
    })

    // Subtotal CCBs
    if (filteredCcbs.length > 0) {
      rows.push({
        'Tipo Operação': 'SUBTOTAL OPERAÇÕES DE CCBS',
        'Contrato / ID': `${ccbTotals.count} op(s)`,
        'Data Operação': '—',
        'Vencimento Final': '—',
        'Cedente / Tomador': '—',
        'CPF/CNPJ Cedente': '—',
        'Regime Tributário': '—',
        'Sacado / Devedor': '—',
        'CPF/CNPJ Sacado': '—',
        Parcelas: '—',
        'Preço de Face (R$)': ccbTotals.face.toFixed(2),
        'Preço Pago / Aquisição (R$)': ccbTotals.paid.toFixed(2),
        'Deságio Nominal (R$)': ccbTotals.discount.toFixed(2),
        'Deságio (%)': ccbTotals.discountPct.toFixed(2),
        'Taxa Efetiva / CET (%)': '—',
        'IOF Retido (R$)': '—',
        Status: '—',
      })
    }

    // Linha de Total Geral Consolidado
    rows.push({
      'Tipo Operação': 'TOTAL GERAL CONSOLIDADO DO PERÍODO',
      'Contrato / ID': `${consolidatedTotals.count} op(s)`,
      'Data Operação': '—',
      'Vencimento Final': '—',
      'Cedente / Tomador': '—',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '—',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': consolidatedTotals.face.toFixed(2),
      'Preço Pago / Aquisição (R$)': consolidatedTotals.paid.toFixed(2),
      'Deságio Nominal (R$)': consolidatedTotals.discount.toFixed(2),
      'Deságio (%)': consolidatedTotals.discountPct.toFixed(2),
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': 'Isento (R$ 0,00)',
      Status: '—',
    })

    // Separador e Seção de Apuração Tributária no CSV
    rows.push({
      'Tipo Operação': '---',
      'Contrato / ID': '---',
      'Data Operação': '---',
      'Vencimento Final': '---',
      'Cedente / Tomador': '---',
      'CPF/CNPJ Cedente': '---',
      'Regime Tributário': '---',
      'Sacado / Devedor': '---',
      'CPF/CNPJ Sacado': '---',
      Parcelas: '---',
      'Preço de Face (R$)': '---',
      'Preço Pago / Aquisição (R$)': '---',
      'Deságio Nominal (R$)': '---',
      'Deságio (%)': '---',
      'Taxa Efetiva / CET (%)': '---',
      'IOF Retido (R$)': '---',
      Status: '---',
    })

    rows.push({
      'Tipo Operação': 'APURAÇÃO TRIBUTÁRIA DA SECURITIZADORA',
      'Contrato / ID': 'Receita Bruta Total (Deságio)',
      'Data Operação': 'Base de Cálculo',
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Deságio Antecipações + CCBs',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': 'Lucro Real / Cumulativo',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.receitaBrutaTotal.toFixed(2),
      'Deságio (%)': '100.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'Calculado',
    })

    rows.push({
      'Tipo Operação': 'APURAÇÃO TRIBUTÁRIA DA SECURITIZADORA',
      'Contrato / ID': 'Despesas de Captação Dedutíveis',
      'Data Operação': 'Dedução Legal',
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Juros/Rendimentos pagos a investidores',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': 'Dedução PIS/COFINS',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': (-taxCalculation.despesasCaptacao).toFixed(2),
      'Deságio (%)': '—',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'Dedutível',
    })

    rows.push({
      'Tipo Operação': 'APURAÇÃO TRIBUTÁRIA DA SECURITIZADORA',
      'Contrato / ID': 'Base de Cálculo Efetiva PIS/COFINS',
      'Data Operação': 'Base Líquida',
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Receita Bruta − Despesas de Captação',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': 'Regime Cumulativo',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.basePisCofins.toFixed(2),
      'Deságio (%)': '—',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: taxCalculation.baseNegativaAviso ? 'Base Zerada (Negativa)' : 'Positiva',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: PIS CUMULATIVO',
      'Contrato / ID': 'PIS (0,65%)',
      'Data Operação': `Base: R$ ${taxCalculation.basePisCofins.toFixed(2)}`,
      'Vencimento Final': '—',
      'Cedente / Tomador': 'PIS Cumulativo Securitizadora',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '0,65%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.valorPis.toFixed(2),
      'Deságio (%)': '0.65',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'A Recolher',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: COFINS CUMULATIVO',
      'Contrato / ID': 'COFINS (4,00%)',
      'Data Operação': `Base: R$ ${taxCalculation.basePisCofins.toFixed(2)}`,
      'Vencimento Final': '—',
      'Cedente / Tomador': 'COFINS Cumulativo Securitizadora',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '4,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.valorCofins.toFixed(2),
      'Deságio (%)': '4.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'A Recolher',
    })

    rows.push({
      'Tipo Operação': 'APURAÇÃO TRIBUTÁRIA DA SECURITIZADORA',
      'Contrato / ID': 'Lucro Real do Período (DRE Oficial)',
      'Data Operação': 'Base IRPJ / CSLL',
      'Vencimento Final': '—',
      'Cedente / Tomador': `Receitas: R$ ${taxCalculation.receitasDre.toFixed(2)} | Despesas: R$ ${taxCalculation.despesasDre.toFixed(2)}`,
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': 'Lucro Real',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.lucroReal.toFixed(2),
      'Deságio (%)': '—',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: taxCalculation.lucroReal > 0 ? 'Lucro' : 'Prejuízo',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: IRPJ BÁSICO',
      'Contrato / ID': 'IRPJ Básico (15%)',
      'Data Operação': `Base: R$ ${Math.max(0, taxCalculation.lucroReal).toFixed(2)}`,
      'Vencimento Final': '—',
      'Cedente / Tomador': 'IRPJ sobre Lucro Real',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '15,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.valorIrpjBase.toFixed(2),
      'Deságio (%)': '15.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'A Recolher',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: ADICIONAL DE IRPJ',
      'Contrato / ID': 'Adicional IRPJ (10%)',
      'Data Operação': `Excedente > R$ 20.000: R$ ${taxCalculation.baseAdicionalIrpj.toFixed(2)}`,
      'Vencimento Final': '—',
      'Cedente / Tomador': '10% sobre excedente a R$ 20.000/mês',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '10,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.valorAdicionalIrpj.toFixed(2),
      'Deságio (%)': '10.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: taxCalculation.valorAdicionalIrpj > 0 ? 'A Recolher' : 'Não Incide',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: CSLL',
      'Contrato / ID': 'CSLL (9%)',
      'Data Operação': `Base: R$ ${Math.max(0, taxCalculation.lucroReal).toFixed(2)}`,
      'Vencimento Final': '—',
      'Cedente / Tomador': 'CSLL sobre Lucro Real',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '9,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.valorCsll.toFixed(2),
      'Deságio (%)': '9.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'A Recolher',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: IOF (ISENTO)',
      'Contrato / ID': 'IOF (Alíquota Zero)',
      'Data Operação': 'Cessão de Direitos Creditórios',
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Não constitui financiamento direto',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '0,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': '0.00',
      'Deságio (%)': '0.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': 'Isento',
      Status: 'Isento',
    })

    rows.push({
      'Tipo Operação': 'TRIBUTO: ISS (NÃO INCIDE)',
      'Contrato / ID': 'ISS (Não Incide)',
      'Data Operação': 'STJ / Recursos Próprios ou Debêntures',
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Aquisição de ativos não é prestação de serviços',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': '0,00%',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': '0.00',
      'Deságio (%)': '0.00',
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'Não Incide',
    })

    rows.push({
      'Tipo Operação': 'TOTAL CARGA TRIBUTÁRIA ESTIMADA',
      'Contrato / ID': 'PIS + COFINS + IRPJ + Adicional + CSLL',
      'Data Operação': `Alíquota Efetiva: ${taxCalculation.aliquotaEfetivaSobreReceita.toFixed(2)}% s/ Faturamento`,
      'Vencimento Final': '—',
      'Cedente / Tomador': 'Carga Fiscal Consolidada da Securitizadora',
      'CPF/CNPJ Cedente': '—',
      'Regime Tributário': 'Lucro Real',
      'Sacado / Devedor': '—',
      'CPF/CNPJ Sacado': '—',
      Parcelas: '—',
      'Preço de Face (R$)': '—',
      'Preço Pago / Aquisição (R$)': '—',
      'Deságio Nominal (R$)': taxCalculation.totalCargaTributaria.toFixed(2),
      'Deságio (%)': taxCalculation.aliquotaEfetivaSobreReceita.toFixed(2),
      'Taxa Efetiva / CET (%)': '—',
      'IOF Retido (R$)': '—',
      Status: 'Total do Período',
    })

    exportToCSV(rows, `Relatorio_Operacoes_Periodo_${selectedMonth}.csv`)
  }

  const handlePrint = () => {
    window.print()
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* Estilo embutido para impressão em PDF contínua, paginada e sem cortes */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm 8mm 10mm 8mm;
        }

        @media print {
          html, body {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            background: white !important;
            color: black !important;
          }

          body * {
            visibility: hidden;
          }

          #root,
          #root > div,
          main,
          header,
          nav,
          aside,
          [data-sidebar="inset"],
          .flex,
          .flex-1,
          .space-y-6,
          .space-y-4 {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            transform: none !important;
            animation: none !important;
          }

          #print-period-operations-report,
          #print-period-operations-report * {
            visibility: visible;
          }

          #print-period-operations-report .no-print,
          #print-period-operations-report .no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          #print-period-operations-report {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 8.5px;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
          }

          .no-print {
            display: none !important;
          }

          #print-period-operations-report .shadow-sm,
          #print-period-operations-report .shadow-md,
          #print-period-operations-report .shadow-lg,
          #print-period-operations-report .shadow {
            box-shadow: none !important;
          }

          #print-period-operations-report .overflow-x-auto,
          #print-period-operations-report .overflow-y-auto,
          #print-period-operations-report .overflow-hidden,
          #print-period-operations-report .overflow-auto,
          #print-period-operations-report div:has(> table) {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            display: block !important;
          }

          #print-period-operations-report table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          #print-period-operations-report thead {
            display: table-header-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-period-operations-report tbody {
            display: table-row-group !important;
          }

          #print-period-operations-report thead th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #print-period-operations-report tfoot {
            display: table-footer-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #print-period-operations-report tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #print-period-operations-report th,
          #print-period-operations-report td {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            padding: 3px 4px !important;
          }

          .print-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Cabeçalho de Controle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h3 className="text-xl font-bold tracking-tight">
            Operações do Período (Fiscal & Contábil)
          </h3>
          <p className="text-sm text-muted-foreground">
            Detalhamento de antecipações de recebíveis e aquisições de CCBs por competência: preço
            de face, preço pago, deságio e bases fiscais.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Baixar Planilha CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
            <Printer className="w-4 h-4 text-blue-600" /> Imprimir / Salvar PDF
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadData}
            disabled={loading}
            title="Recarregar dados"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Seletor de Mês de Referência */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Mês de Competência
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableMonths.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca textual */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Buscar Operação / Parte Envolvida
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por contrato, tomador, cedente, sacado ou CPF/CNPJ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Área Imprimível */}
      <div id="print-period-operations-report" className="space-y-6">
        {/* Cabeçalho exclusivo para o modo de impressão */}
        <div className="hidden print:block border-b pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">NEXUM SECURITY 360º</h1>
              <h2 className="text-lg font-semibold text-muted-foreground">
                Relatório de Operações do Período — Base Fiscal e Contábil
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Operações de Antecipação de Recebíveis e Aquisições de CCBs
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                Competência: <strong className="text-foreground">{selectedMonthLabel}</strong>
              </div>
              <div>
                Gerado em: {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Resumo Consolidado no Topo */}
        <div className="grid gap-4 md:grid-cols-4 print-break-inside-avoid">
          {/* Quantidade Total */}
          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Operações no Período
              </CardTitle>
              <Receipt className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold font-mono">{consolidatedTotals.count}</div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>Antecipações: {receivablesTotals.count}</span>
                <span>CCBs: {ccbTotals.count}</span>
              </div>
            </CardContent>
          </Card>

          {/* Preço de Face Total */}
          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Preço de Face (Nominal)
              </CardTitle>
              <Wallet className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-foreground">
                  {formatCurrency(consolidatedTotals.face)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Valor total dos títulos adquiridos
              </p>
            </CardContent>
          </Card>

          {/* Preço Pago Total */}
          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Preço Pago (Aquisição Líquida)
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-emerald-700">
                  {formatCurrency(consolidatedTotals.paid)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">Desembolso de caixa efetivo</p>
            </CardContent>
          </Card>

          {/* Deságio Total do Período */}
          <Card className="print-break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Deságio Total do Período
              </CardTitle>
              <BadgePercent className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold font-mono text-indigo-700">
                  {formatCurrency(consolidatedTotals.discount)}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between">
                <span>Spread médio: {formatPercent(consolidatedTotals.discountPct)}</span>
                <span
                  className="text-emerald-700 font-medium"
                  title="IOF: alíquota zero — a cessão de direitos creditórios não constitui operação de crédito"
                >
                  IOF: Isento (0%)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* SEÇÃO 1: Operações de Antecipação de Recebíveis               */}
        {/* ------------------------------------------------------------ */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  1. Operações de Antecipação de Recebíveis ({filteredReceivables.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Operações de duplicatas, cheques, notas promissórias e mútuos formalizados no mês
                  de {selectedMonthLabel}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  Deságio da Seção: {formatCurrency(receivablesTotals.discount)} (
                  {formatPercent(receivablesTotals.discountPct)})
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0 sm:p-6">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Erro ao carregar dados de antecipações.</p>
              </div>
            ) : filteredReceivables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-medium text-sm">
                  Nenhuma operação de antecipação registrada em {selectedMonthLabel}.
                </p>
                <p className="text-xs">Selecione outro mês na barra de filtros acima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs">
                      <TableHead className="min-w-[100px]">Contrato/ID</TableHead>
                      <TableHead className="min-w-[90px]">Data Emissão</TableHead>
                      <TableHead className="min-w-[100px]">Vencimento</TableHead>
                      <TableHead className="min-w-[180px]">Cedente (Tomador)</TableHead>
                      <TableHead className="min-w-[110px]">Regime Trib.</TableHead>
                      <TableHead className="min-w-[170px]">Sacado (Devedor)</TableHead>
                      <TableHead className="min-w-[80px]">Tipo</TableHead>
                      <TableHead className="text-right min-w-[110px]">Preço Face</TableHead>
                      <TableHead className="text-right min-w-[110px] text-emerald-700">
                        Preço Pago
                      </TableHead>
                      <TableHead className="text-right min-w-[110px] text-indigo-700">
                        Deságio (R$)
                      </TableHead>
                      <TableHead className="text-right min-w-[75px]">Deságio %</TableHead>
                      <TableHead className="text-right min-w-[75px]">CET/Taxa</TableHead>
                      <TableHead className="text-right min-w-[105px]">
                        <span title="IOF: alíquota zero — a cessão de direitos creditórios não constitui operação de crédito">
                          IOF (isento)
                        </span>
                      </TableHead>
                      <TableHead className="text-center min-w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceivables.map((item) => (
                      <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">
                          {item.contractNumber}
                        </TableCell>
                        <TableCell>{formatDate(item.operationDate)}</TableCell>
                        <TableCell>{formatDate(item.dueDate)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.borrowerName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {formatCpfCnpj(item.borrowerDocument)}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {formatTaxRegime(item.taxRegime)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.sacadoName}</div>
                          {item.sacadoDocument && (
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {formatCpfCnpj(item.sacadoDocument)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{item.receivableType}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(item.faceValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-700 font-medium">
                          {formatCurrency(item.paidValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-indigo-700 font-bold">
                          {formatCurrency(item.discountValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercent(item.discountPct)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.effectiveRate > 0 ? formatPercent(item.effectiveRate) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                          <span title="IOF: alíquota zero — a cessão de direitos creditórios não constitui operação de crédito">
                            Isento (R$ 0,00)
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              item.status === 'liquidado' || item.status === 'pago'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px] font-normal capitalize"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2 border-primary/20 text-xs">
                      <TableCell colSpan={7} className="uppercase tracking-wider">
                        Subtotal Antecipação de Recebíveis ({receivablesTotals.count} operações)
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(receivablesTotals.face)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">
                        {formatCurrency(receivablesTotals.paid)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-indigo-700">
                        {formatCurrency(receivablesTotals.discount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(receivablesTotals.discountPct)}
                      </TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        <span title="IOF: alíquota zero — a cessão de direitos creditórios não constitui operação de crédito">
                          Isento (R$ 0,00)
                        </span>
                      </TableCell>
                      <TableCell className="text-center">—</TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------ */}
        {/* SEÇÃO 2: Operações de CCBs                                   */}
        {/* ------------------------------------------------------------ */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  2. Operações de Aquisição de CCBs ({filteredCcbs.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cédulas de Crédito Bancário adquiridas no período com lastro em boletos
                  parcelados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  Deságio da Seção: {formatCurrency(ccbTotals.discount)} (
                  {formatPercent(ccbTotals.discountPct)})
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0 sm:p-6">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-sm font-medium">Erro ao carregar dados de CCBs.</p>
              </div>
            ) : filteredCcbs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-medium text-sm">
                  Nenhuma aquisição de CCB registrada em {selectedMonthLabel}.
                </p>
                <p className="text-xs">Selecione outro mês na barra de filtros acima.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs">
                      <TableHead className="min-w-[100px]">Nº CCB / ID</TableHead>
                      <TableHead className="min-w-[90px]">Data Operação</TableHead>
                      <TableHead className="min-w-[200px]">Tomador (Emitente)</TableHead>
                      <TableHead className="min-w-[110px]">Regime Trib.</TableHead>
                      <TableHead className="min-w-[90px]">Convênio/Banco</TableHead>
                      <TableHead className="text-center min-w-[70px]">Prazo</TableHead>
                      <TableHead className="text-center min-w-[75px]">Boletos</TableHead>
                      <TableHead className="text-right min-w-[90px]">Valor Boleto</TableHead>
                      <TableHead className="text-right min-w-[110px]">Preço Face</TableHead>
                      <TableHead className="text-right min-w-[110px] text-emerald-700">
                        Preço Pago
                      </TableHead>
                      <TableHead className="text-right min-w-[110px] text-indigo-700">
                        Deságio (R$)
                      </TableHead>
                      <TableHead className="text-right min-w-[75px]">Deságio %</TableHead>
                      <TableHead className="text-right min-w-[75px]">TIR Efetiva</TableHead>
                      <TableHead className="text-center min-w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCcbs.map((item) => (
                      <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-medium">{item.ccbNumber}</TableCell>
                        <TableCell>{formatDate(item.operationDate)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.tomadorName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {formatCpfCnpj(item.tomadorDocument)}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {formatTaxRegime(item.taxRegime)}
                        </TableCell>
                        <TableCell className="font-medium">{item.partnerBank}</TableCell>
                        <TableCell className="text-center">{item.termMonths}m</TableCell>
                        <TableCell className="text-center font-mono">{item.boletoCount}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.boletoUnitValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(item.faceValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-700 font-medium">
                          {formatCurrency(item.paidValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-indigo-700 font-bold">
                          {formatCurrency(item.discountValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPercent(item.discountPct)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.tirEffective > 0 ? formatPercent(item.tirEffective) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={item.status === 'Ativo' ? 'secondary' : 'outline'}
                            className="text-[10px] font-normal"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="bg-muted/80 font-bold border-t-2 border-primary/20 text-xs">
                      <TableCell colSpan={8} className="uppercase tracking-wider">
                        Subtotal Aquisição de CCBs ({ccbTotals.count} operações)
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(ccbTotals.face)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">
                        {formatCurrency(ccbTotals.paid)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-indigo-700">
                        {formatCurrency(ccbTotals.discount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPercent(ccbTotals.discountPct)}
                      </TableCell>
                      <TableCell className="text-right font-mono">—</TableCell>
                      <TableCell className="text-center">—</TableCell>
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------ */}
        {/* SEÇÃO 3: Consolidado Geral do Período (Fiscal / Contábil)    */}
        {/* ------------------------------------------------------------ */}
        <Card className="border-primary/30 shadow-sm print-break-inside-avoid">
          <CardHeader className="bg-primary/5 border-b pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Resumo Consolidado Geral — Competência {selectedMonthLabel}
              </span>
              <span className="text-xs font-mono font-normal bg-primary/10 px-2.5 py-1 rounded text-primary">
                {consolidatedTotals.count} operações consolidadas
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2 border-b">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                  Total Preço de Face (Valor Nominal)
                </span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {formatCurrency(consolidatedTotals.face)}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                  Total Preço Pago (Valor Aquisição)
                </span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  {formatCurrency(consolidatedTotals.paid)}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                  Deságio Total do Período (Face − Pago)
                </span>
                <span className="text-lg font-bold font-mono text-indigo-700">
                  {formatCurrency(consolidatedTotals.discount)}
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">
                  Spread Médio / Deságio Médio
                </span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {formatPercent(consolidatedTotals.discountPct)}
                </span>
              </div>
            </div>

            {/* Informações fiscais auxiliares */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div>
                  IOF nas Operações:{' '}
                  <strong className="text-emerald-700 font-mono">Isento (R$ 0,00)</strong>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    (Alíquota zero — cessão de direitos creditórios)
                  </span>
                </div>
                {consolidatedTotals.provision > 0 && (
                  <div>
                    Provisão de Risco CCB (3%):{' '}
                    <strong className="text-foreground font-mono">
                      {formatCurrency(consolidatedTotals.provision)}
                    </strong>
                  </div>
                )}
              </div>
              <div className="italic text-[11px]">
                * Demonstrativo consolidado para fins societários, fiscais e contábeis.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------------------------ */}
        {/* SEÇÃO 4: Apuração Tributária do Período (Securitizadora)     */}
        {/* ------------------------------------------------------------ */}
        <Card className="border-indigo-200 dark:border-indigo-950/50 shadow-sm print-break-inside-avoid">
          <CardHeader className="bg-gradient-to-r from-indigo-50/70 to-slate-50 border-b pb-4 dark:from-indigo-950/20 dark:to-background">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                  <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  3. Apuração Tributária do Período — Competência {selectedMonthLabel}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regime cumulativo de PIS/COFINS com dedução legal de captação e apuração de
                  IRPJ/CSLL sobre o Lucro Real.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-white/80 dark:bg-card font-mono text-xs border-indigo-300"
                >
                  Total Tributos: {formatCurrency(taxCalculation.totalCargaTributaria)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Cards de Resumo Fiscal */}
            <div className="grid gap-4 md:grid-cols-4 print-break-inside-avoid">
              {/* Card 1: Receita Bruta / Faturamento */}
              <div className="rounded-lg border bg-card p-4 space-y-1 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Receita Bruta (Faturamento)</span>
                  <BadgePercent className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-xl font-bold font-mono text-foreground">
                  {formatCurrency(taxCalculation.receitaBrutaTotal)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Deságio Antecipações ({formatCurrency(taxCalculation.receitaBrutaRecebiveis)}) +
                  CCBs ({formatCurrency(taxCalculation.receitaBrutaCcbs)})
                </div>
              </div>

              {/* Card 2: Despesas de Captação Dedutíveis */}
              <div className="rounded-lg border bg-card p-4 space-y-1 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Despesas de Captação</span>
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-700">
                  {loadingTax ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    formatCurrency(taxCalculation.despesasCaptacao)
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Juros e rendimentos pagos/auferidos aos investidores de debêntures
                </div>
              </div>

              {/* Card 3: Base Efetiva PIS/COFINS */}
              <div className="rounded-lg border bg-card p-4 space-y-1 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Base PIS / COFINS</span>
                  <Scale className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold font-mono text-blue-700">
                  {formatCurrency(taxCalculation.basePisCofins)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {taxCalculation.baseNegativaAviso
                    ? 'Receita < Despesas: base zerada legalmente'
                    : 'Receita Bruta deduzida das despesas de debêntures'}
                </div>
              </div>

              {/* Card 4: Carga Total Estimada */}
              <div className="rounded-lg border bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-1 shadow-sm border-indigo-200 dark:border-indigo-900">
                <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-semibold uppercase tracking-wider">
                  <span>Carga Tributária Total</span>
                  <Calculator className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                </div>
                <div className="text-xl font-bold font-mono text-indigo-900 dark:text-indigo-100">
                  {loadingTax ? (
                    <Skeleton className="h-7 w-28" />
                  ) : (
                    formatCurrency(taxCalculation.totalCargaTributaria)
                  )}
                </div>
                <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  Alíquota efetiva: {taxCalculation.aliquotaEfetivaSobreReceita.toFixed(2)}% sobre a
                  receita bruta
                </div>
              </div>
            </div>

            {/* Alerta se base for negativa */}
            {taxCalculation.baseNegativaAviso && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Aviso legal:</strong> No período selecionado, as despesas de captação
                  dedutíveis ({formatCurrency(taxCalculation.despesasCaptacao)}) superaram a receita
                  bruta auferida ({formatCurrency(taxCalculation.receitaBrutaTotal)}). Conforme a
                  legislação tributária das securitizadoras, a base de cálculo de PIS/COFINS não
                  pode ser negativa, tendo sido ajustada para <strong>R$ 0,00</strong>.
                </span>
              </div>
            )}

            {/* Tabela Detalhada de Tributos */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 text-xs">
                    <TableHead className="min-w-[180px]">Tributo / Obrigação Fiscal</TableHead>
                    <TableHead className="min-w-[140px]">Classificação / Regime</TableHead>
                    <TableHead className="text-right min-w-[140px]">Base de Cálculo (R$)</TableHead>
                    <TableHead className="text-center min-w-[100px]">Alíquota</TableHead>
                    <TableHead className="text-right min-w-[140px]">Valor Apurado (R$)</TableHead>
                    <TableHead className="min-w-[260px]">
                      Fundamentação Legal e Regra Específica
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {/* PIS */}
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-blue-600" /> PIS
                    </TableCell>
                    <TableCell>Cumulativo (Lucro Real)</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(taxCalculation.basePisCofins)}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">0,65%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatCurrency(taxCalculation.valorPis)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      Incide sobre a receita bruta deduzida das despesas de captação com
                      investidores de debêntures.
                    </TableCell>
                  </TableRow>

                  {/* COFINS */}
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-blue-600" /> COFINS
                    </TableCell>
                    <TableCell>Cumulativo (Lucro Real)</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(taxCalculation.basePisCofins)}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">4,00%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatCurrency(taxCalculation.valorCofins)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      Diferencial estratégico das securitizadoras: regime cumulativo mantido mesmo
                      no Lucro Real, deduzindo captações.
                    </TableCell>
                  </TableRow>

                  {/* Subtotal PIS/COFINS */}
                  <TableRow className="bg-muted/30 font-semibold border-b">
                    <TableCell
                      colSpan={2}
                      className="pl-6 uppercase tracking-wider text-[11px] text-muted-foreground"
                    >
                      Subtotal Contribuições Sociais (PIS + COFINS: 4,65%)
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(taxCalculation.basePisCofins)}
                    </TableCell>
                    <TableCell className="text-center font-mono">4,65%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-blue-700">
                      {formatCurrency(taxCalculation.totalPisCofins)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      Total de contribuições sobre faturamento líquido de captações.
                    </TableCell>
                  </TableRow>

                  {/* IRPJ Básico */}
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-indigo-600" /> IRPJ (Básico)
                    </TableCell>
                    <TableCell>Lucro Real</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Math.max(0, taxCalculation.lucroReal))}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">15,00%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatCurrency(taxCalculation.valorIrpjBase)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      15% sobre o Lucro Real apurado no DRE oficial do período (
                      {formatCurrency(taxCalculation.lucroReal)}).
                    </TableCell>
                  </TableRow>

                  {/* Adicional de IRPJ */}
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-indigo-600" /> Adicional de IRPJ
                    </TableCell>
                    <TableCell>Lucro Real Excedente</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(taxCalculation.baseAdicionalIrpj)}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">10,00%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatCurrency(taxCalculation.valorAdicionalIrpj)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      Adicional de 10% cobrado sobre a parcela do Lucro Real mensal que ultrapassar
                      o limite de R$ 20.000,00.
                    </TableCell>
                  </TableRow>

                  {/* CSLL */}
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-indigo-600" /> CSLL
                    </TableCell>
                    <TableCell>Lucro Real</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Math.max(0, taxCalculation.lucroReal))}
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">9,00%</TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatCurrency(taxCalculation.valorCsll)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      9% sobre a apuração do Lucro Real contábil do período.
                    </TableCell>
                  </TableRow>

                  {/* Subtotal IRPJ/CSLL */}
                  <TableRow className="bg-muted/30 font-semibold border-b">
                    <TableCell
                      colSpan={2}
                      className="pl-6 uppercase tracking-wider text-[11px] text-muted-foreground"
                    >
                      Subtotal Impostos sobre o Lucro (IRPJ + Adicional + CSLL)
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(Math.max(0, taxCalculation.lucroReal))}
                    </TableCell>
                    <TableCell className="text-center font-mono">—</TableCell>
                    <TableCell className="text-right font-mono font-bold text-indigo-700">
                      {formatCurrency(taxCalculation.totalIrpjCsll)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      Resultado contábil oficial apurado pelo DRE: receitas (
                      {formatCurrency(taxCalculation.receitasDre)}) − despesas (
                      {formatCurrency(taxCalculation.despesasDre)}).
                    </TableCell>
                  </TableRow>

                  {/* IOF (Isento) */}
                  <TableRow className="hover:bg-muted/30 bg-emerald-50/20 dark:bg-emerald-950/10">
                    <TableCell className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> IOF
                    </TableCell>
                    <TableCell className="text-emerald-800 dark:text-emerald-300 font-medium">
                      Isento (Alíquota Zero)
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-center font-mono font-bold text-emerald-700">
                      0,00%
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700">
                      R$ 0,00
                    </TableCell>
                    <TableCell className="text-emerald-900 dark:text-emerald-200 text-[11px]">
                      IOF: alíquota zero — a securitização é compra e venda de ativos corporativos
                      (cessão de direitos creditórios) e não operação de crédito/financiamento
                      direto.
                    </TableCell>
                  </TableRow>

                  {/* ISS (Não Incide) */}
                  <TableRow className="hover:bg-muted/30 bg-emerald-50/20 dark:bg-emerald-950/10">
                    <TableCell className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> ISS
                    </TableCell>
                    <TableCell className="text-emerald-800 dark:text-emerald-300 font-medium">
                      Não Incide
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                    <TableCell className="text-center font-mono font-bold text-emerald-700">
                      0,00%
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700">
                      R$ 0,00
                    </TableCell>
                    <TableCell className="text-emerald-900 dark:text-emerald-200 text-[11px]">
                      ISS: não incide — a aquisição de direitos creditórios com recursos próprios ou
                      via debêntures não constitui prestação de serviço (jurisprudência pacificada
                      STJ).
                    </TableCell>
                  </TableRow>
                </TableBody>
                <tfoot>
                  <TableRow className="bg-indigo-900 text-white font-bold border-t-2 text-xs hover:bg-indigo-900">
                    <TableCell colSpan={2} className="uppercase tracking-wider">
                      Carga Tributária Total Estimada do Período
                    </TableCell>
                    <TableCell className="text-right font-mono text-indigo-100">
                      Receita: {formatCurrency(taxCalculation.receitaBrutaTotal)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-indigo-200">
                      {taxCalculation.aliquotaEfetivaSobreReceita.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-300 text-sm">
                      {formatCurrency(taxCalculation.totalCargaTributaria)}
                    </TableCell>
                    <TableCell className="text-indigo-200 text-[11px] font-normal">
                      PIS ({formatCurrency(taxCalculation.valorPis)}) + COFINS (
                      {formatCurrency(taxCalculation.valorCofins)}) + IRPJ (
                      {formatCurrency(taxCalculation.valorIrpjBase)}) + Adicional (
                      {formatCurrency(taxCalculation.valorAdicionalIrpj)}) + CSLL (
                      {formatCurrency(taxCalculation.valorCsll)})
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>

            {/* Notas Fixas Regulatórias no Rodapé da Seção Fiscal */}
            <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2 text-xs text-muted-foreground print-break-inside-avoid">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Notas Explicativas da Apuração Fiscal
                da Securitizadora:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11.5px] leading-relaxed">
                <li>
                  <strong>PIS (0,65%) e COFINS (4,00%):</strong> Calculados no regime cumulativo
                  mesmo no Lucro Real, deduzindo da base de cálculo as despesas de captação (juros e
                  rendimentos de debêntures auferidos aos investidores no mês pela fonte oficial).
                  Base legal: Lei nº 9.718/1998 e regulamentação setorial.
                </li>
                <li>
                  <strong>IRPJ (15% + 10% adicional) e CSLL (9%):</strong> Apurados com base no
                  Lucro Real efetivo do período oriundo do Demonstrativo de Resultado do Exercício
                  (DRE oficial consolidado), respeitando as deduplicações vigentes (despesas pagas,
                  aportes na data real, recebimento de CCBs e exclusão de transferências internas).
                </li>
                <li>
                  <strong>IOF:</strong> Alíquota zero — como a securitização é juridicamente
                  classificada como uma compra e venda de ativos corporativos (cessão de direitos
                  creditórios) e não uma operação de crédito/financiamento direto, não sofre a
                  incidência do IOF sobre as antecipações.
                </li>
                <li>
                  <strong>ISS:</strong> Não incide — há jurisprudência pacificada (inclusive no
                  Superior Tribunal de Justiça — STJ) de que a aquisição de direitos creditórios com
                  recursos próprios ou via debêntures não constitui prestação de serviço,
                  desobrigando o pagamento do imposto municipal.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
