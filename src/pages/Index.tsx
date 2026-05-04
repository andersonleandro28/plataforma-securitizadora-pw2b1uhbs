import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

const riskConfig = {
  value: { label: 'Participação' },
}

const issuerConfig = {
  exposure: { label: 'Exposição', color: 'hsl(var(--primary))' },
}

type Status = 'loading' | 'success' | 'error' | 'empty'

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export default function Index() {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<{ recebiveis: any[]; investimentos: any[] } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const { toast } = useToast()
  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(() => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current)

    fetchTimeout.current = setTimeout(async () => {
      try {
        setStatus('loading')
        const [{ data: recebiveis, error: err1 }, { data: investimentos, error: err2 }] =
          await Promise.all([
            supabase
              .from('recebiveis_ccb')
              .select(
                '*, tomador:profiles!recebiveis_ccb_tomador_id_fkey(full_name, pj_company_name)',
              )
              .eq('status', 'Ativo'),
            supabase
              .from('investments')
              .select('total_value, status')
              .in('status', ['approved', 'Ativo']),
          ])

        if (err1) throw err1
        if (err2) throw err2

        setData({ recebiveis: recebiveis || [], investimentos: investimentos || [] })
        setStatus('success')
      } catch (error: any) {
        setStatus('error')
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Falha na comunicação com o servidor',
          variant: 'destructive',
        })
      }
    }, 300)
  }, [toast])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebiveis_ccb' }, () =>
        fetchData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, () =>
        fetchData(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const processedData = useMemo(() => {
    if (!data) return null
    const { recebiveis, investimentos } = data

    const aumRecebiveis = recebiveis.reduce(
      (acc, curr) => acc + (Number(curr.acquisition_value) || 0),
      0,
    )
    const aumInvestimentos = investimentos.reduce(
      (acc, curr) => acc + (Number(curr.total_value) || 0),
      0,
    )
    const totalAUM = aumRecebiveis + aumInvestimentos

    const receitaMensal = recebiveis.reduce((acc, curr) => {
      const val = Number(curr.acquisition_value) || 0
      const taxa = Number(curr.tir_effective) || 0
      return acc + (val * (taxa / 100)) / 12
    }, 0)

    let sumProd = 0
    let sumVal = 0
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      let maxDate = new Date()
      if (r.boletos && Array.isArray(r.boletos)) {
        const dates = r.boletos
          .map((b) => new Date(b.due_date || b.payment_date || new Date()))
          .filter((d) => !isNaN(d.getTime()))
        if (dates.length > 0) {
          maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
        }
      }
      const days = Math.max(0, (maxDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      sumProd += val * days
      sumVal += val
    })
    const pdlMonths = sumVal > 0 ? sumProd / sumVal / 30 : 0

    const totalEscrituras = recebiveis.length

    const riskMap: Record<string, number> = { AAA: 0, AA: 0, A: 0, BBB: 0, BB: 0 }
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const tir = Number(r.tir_effective) || 0
      let rating = 'BB'
      if (tir < 1.5) rating = 'AAA'
      else if (tir < 2.0) rating = 'AA'
      else if (tir < 3.0) rating = 'A'
      else if (tir < 4.0) rating = 'BBB'
      riskMap[rating] += val
    })
    const riskData = Object.entries(riskMap)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => {
        let fill = '#ef4444'
        if (name === 'AAA') fill = '#22c55e'
        if (name === 'AA') fill = '#84cc16'
        if (name === 'A') fill = '#eab308'
        if (name === 'BBB') fill = '#f97316'
        return { name, value, fill }
      })

    const emissorMap: Record<string, number> = {}
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const emissorObj = Array.isArray(r.tomador) ? r.tomador[0] : r.tomador
      const emissor = emissorObj?.pj_company_name || emissorObj?.full_name || 'Desconhecido'
      emissorMap[emissor] = (emissorMap[emissor] || 0) + val
    })
    const issuerData = Object.entries(emissorMap)
      .map(([name, exposure]) => ({ name, exposure }))
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 3)

    const upcomingBoletos: any[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next30Days = new Date(today)
    next30Days.setDate(today.getDate() + 30)

    recebiveis.forEach((r) => {
      if (r.boletos && Array.isArray(r.boletos)) {
        r.boletos.forEach((b, idx) => {
          if (!b.due_date) return
          const bDate = new Date(b.due_date)
          bDate.setHours(0, 0, 0, 0)
          const bStatus = b.status || 'Pendente'
          if (
            bStatus.toLowerCase() !== 'pago' &&
            bDate.getTime() >= today.getTime() &&
            bDate.getTime() <= next30Days.getTime()
          ) {
            const emissorObj = Array.isArray(r.tomador) ? r.tomador[0] : r.tomador
            upcomingBoletos.push({
              id: `${r.id}-${idx}`,
              date: bDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
              dateObj: bDate,
              issuer: emissorObj?.pj_company_name || emissorObj?.full_name || 'Desconhecido',
              amount: Number(b.unit_value || b.face_value || r.boleto_unit_value) || 0,
              status: bStatus,
            })
          }
        })
      }
    })
    upcomingBoletos.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

    const insights = []

    const upcoming7Days = upcomingBoletos.filter(
      (b) => b.dateObj.getTime() <= today.getTime() + 7 * 24 * 60 * 60 * 1000,
    )
    if (upcoming7Days.length > 0) {
      insights.push({
        id: 'parcelas_7d',
        type: upcoming7Days.length > 5 ? 'critical' : 'warning',
        message: `${upcoming7Days.length} parcela(s) vencem nos próximos 7 dias`,
        actionText: 'Ver parcelas',
        icon: AlertCircle,
        action: 'scrollToBoletos',
      })
    }

    const hasConcentration = Object.entries(emissorMap).some(
      ([_, val]) => totalAUM > 0 && val / totalAUM > 0.3,
    )
    if (hasConcentration) {
      insights.push({
        id: 'concentracao',
        type: 'warning',
        message: 'Concentração acima de 30% em 1 emissor',
        actionText: 'Ver emissores',
        icon: AlertTriangle,
        action: 'scrollToEmissores',
      })
    }

    if (pdlMonths > 0 && pdlMonths < 6) {
      insights.push({
        id: 'pdl_baixo',
        type: 'info',
        message: 'PDL médio abaixo de 6 meses',
        actionText: 'Ver PDL',
        icon: Info,
        action: 'scrollToCards',
      })
    }

    const ratingScores: Record<string, number> = { AAA: 5, AA: 4, A: 3, BBB: 2, BB: 1 }
    let sumRatingScores = 0
    let totalRatedValue = 0
    recebiveis.forEach((r) => {
      const val = Number(r.acquisition_value) || 0
      const tir = Number(r.tir_effective) || 0
      let rating = 'BB'
      if (tir < 1.5) rating = 'AAA'
      else if (tir < 2.0) rating = 'AA'
      else if (tir < 3.0) rating = 'A'
      else if (tir < 4.0) rating = 'BBB'
      sumRatingScores += val * ratingScores[rating]
      totalRatedValue += val
    })
    const avgRatingScore = totalRatedValue > 0 ? sumRatingScores / totalRatedValue : 0
    if (totalRatedValue > 0 && avgRatingScore < 3) {
      insights.push({
        id: 'rating_baixo',
        type: 'critical',
        message: 'Rating médio abaixo de A',
        actionText: 'Ver risco',
        icon: Activity,
        action: 'scrollToRisco',
      })
    }

    return {
      totalAUM,
      receitaMensal,
      pdlMonths,
      totalEscrituras,
      riskData,
      issuerData,
      upcomingBoletos,
      insights,
    }
  }, [data])

  const totalPages = processedData
    ? Math.ceil(processedData.upcomingBoletos.length / itemsPerPage)
    : 0
  const paginatedBoletos = processedData
    ? processedData.upcomingBoletos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      )
    : []

  const cards = processedData
    ? [
        {
          title: 'Total AUM',
          icon: DollarSign,
          value: formatCurrency(processedData.totalAUM),
          sub: 'Soma de todas as emissões',
          delay: '0ms',
        },
        {
          title: 'Receita Estimada (Fees)',
          icon: TrendingUp,
          value: `${formatCurrency(processedData.receitaMensal)}/mês`,
          sub: 'Projeção mensal baseada em taxa anual',
          delay: '50ms',
        },
        {
          title: 'PDL Médio',
          icon: Calendar,
          value: `${processedData.pdlMonths.toFixed(1).replace('.', ',')} meses`,
          sub: 'Prazo médio ponderado',
          delay: '100ms',
        },
        {
          title: 'Escrituras Base',
          icon: FileText,
          value: String(processedData.totalEscrituras),
          sub: 'Emissões ativas no fundo',
          delay: '150ms',
        },
      ]
    : []

  const isEmpty = processedData?.totalAUM === 0 && processedData?.totalEscrituras === 0

  return
  null
}
