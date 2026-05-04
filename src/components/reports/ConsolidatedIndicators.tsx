import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, DollarSign, RotateCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase/client'

export function ConsolidatedIndicators() {
  const [treasuryData, setTreasuryData] = useState<any[]>([])
  const [loadingTreasury, setLoadingTreasury] = useState(true)
  const [errorTreasury, setErrorTreasury] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  const loadTreasuryData = async () => {
    setLoadingTreasury(true)
    setErrorTreasury(false)
    try {
      const { data, error } = await supabase
        .from('treasury_transactions')
        .select('type, amount, date')
      if (error) throw error
      setTreasuryData(data || [])

      const months = Array.from(new Set((data || []).map((d) => d.date.substring(0, 7))))
        .sort()
        .reverse()
      setAvailableMonths(months)

      setSelectedMonth((prev) => {
        if (prev && months.includes(prev)) return prev
        return months.length > 0 ? months[0] : new Date().toISOString().substring(0, 7)
      })
    } catch (e) {
      setErrorTreasury(true)
    } finally {
      setLoadingTreasury(false)
    }
  }

  useEffect(() => {
    loadTreasuryData()
    const channel = supabase
      .channel('indicators_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_transactions' },
        () => {
          loadTreasuryData()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totals = useMemo(() => {
    if (!selectedMonth) return { in: 0, out: 0, net: 0 }
    const filtered = treasuryData.filter((d) => d.date.startsWith(selectedMonth))
    const totalIn = filtered
      .filter((d) => d.type === 'in')
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    const totalOut = filtered
      .filter((d) => d.type === 'out')
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    return {
      in: totalIn,
      out: totalOut,
      net: totalIn - totalOut,
    }
  }, [treasuryData, selectedMonth])

  const formatMonth = (yyyyMM: string) => {
    if (!yyyyMM) return ''
    const [y, m] = yyyMM.split('-')
    const date = new Date(Number(y), Number(m) - 1, 1, 12, 0, 0)
    const str = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Indicadores Consolidados</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <select
            className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {availableMonths.length > 0 ? (
              availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))
            ) : (
              <option value={selectedMonth || new Date().toISOString().substring(0, 7)}>
                {formatMonth(selectedMonth || new Date().toISOString().substring(0, 7))}
              </option>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between space-x-2">
              <p className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              {loadingTreasury ? (
                <Skeleton className="h-8 w-32" />
              ) : errorTreasury ? (
                <div className="flex items-center text-sm text-red-500">
                  Erro ao carregar{' '}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadTreasuryData}
                    className="ml-2 h-6 w-6"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totals.in)}</h2>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mês de {formatMonth(selectedMonth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between space-x-2">
              <p className="text-sm font-medium text-muted-foreground">Despesas Totais</p>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              {loadingTreasury ? (
                <Skeleton className="h-8 w-32" />
              ) : errorTreasury ? (
                <div className="flex items-center text-sm text-red-500">
                  Erro ao carregar{' '}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadTreasuryData}
                    className="ml-2 h-6 w-6"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totals.out)}</h2>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mês de {formatMonth(selectedMonth)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col justify-center">
            <div className="flex items-center justify-between space-x-2">
              <p className="text-sm font-medium text-muted-foreground">Resultado Líquido</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 flex items-baseline space-x-2">
              {loadingTreasury ? (
                <Skeleton className="h-8 w-32" />
              ) : errorTreasury ? (
                <div className="flex items-center text-sm text-red-500">
                  Erro ao carregar{' '}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadTreasuryData}
                    className="ml-2 h-6 w-6"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2
                  className={`text-3xl font-bold tracking-tight ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatCurrency(totals.net)}
                </h2>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mês de {formatMonth(selectedMonth)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
