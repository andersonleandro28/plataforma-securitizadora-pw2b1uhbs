import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { UploadCloud, Building, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { HistoryTab } from '@/components/debentures/HistoryTab'
import { SeriesListTab } from '@/components/debentures/SeriesListTab'
import { DeedUploadDialog } from '@/components/debentures/DeedUploadDialog'
import { ManualDeedDialog } from '@/components/debentures/ManualDeedDialog'

export default function Debentures() {
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [debentures, setDebentures] = useState<any[]>([])

  const [uploadOpen, setUploadOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('debentures')
        .select(`
          *,
          series:debenture_series(
            *,
            debenture_subscriptions(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDebentures(data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const interval = setInterval(fetchData, 15000)

    const channel = supabase
      .channel('sync_debentures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debentures' }, () =>
        fetchData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debenture_series' }, () =>
        fetchData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'debenture_subscriptions' },
        () => fetchData(),
      )
      .subscribe()

    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Debêntures</h1>
          <p className="text-muted-foreground">
            Gerenciamento completo de emissões, séries e subscrições
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)}>
              <Building className="h-4 w-4" /> Nova Escritura Manual
            </Button>
            <Button className="gap-2" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" /> Processar Documento IA
            </Button>
          </div>
          <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-full border">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" /> Atualizado: {format(lastUpdated, 'HH:mm:ss')}
            </span>
            <div
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1"
              title="Sincronização Real-time Ativa"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="escrituras" className="space-y-4">
        <TabsList>
          <TabsTrigger value="escrituras">Escrituras e Documentos</TabsTrigger>
          <TabsTrigger value="series">Gestão Granular de Séries</TabsTrigger>
        </TabsList>

        <TabsContent value="escrituras">
          <HistoryTab
            debentures={debentures}
            loading={loading}
            formatCurrency={formatCurrency}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="series">
          <SeriesListTab
            debentures={debentures}
            loading={loading}
            formatCurrency={formatCurrency}
            onRefresh={fetchData}
          />
        </TabsContent>
      </Tabs>

      <DeedUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={fetchData} />
      <ManualDeedDialog open={manualOpen} onOpenChange={setManualOpen} onSuccess={fetchData} />
    </div>
  )
}
