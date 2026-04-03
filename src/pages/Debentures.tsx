import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, RefreshCw, Clock, History, Settings, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { ManageSubscriptionsDialog } from '@/components/debentures/ManageSubscriptionsDialog'

export default function Debentures() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const [activeSubs, setActiveSubs] = useState<any[]>([])
  const [excludedSubs, setExcludedSubs] = useState<any[]>([])
  const [series, setSeries] = useState<any[]>([])
  const [manageSeries, setManageSeries] = useState<any>(null)

  const isAdmin = profile?.role === 'admin' || profile?.is_admin

  const fetchData = useCallback(async () => {
    if (!profile) return

    try {
      if (isAdmin) {
        const { data, error } = await supabase
          .from('debenture_series')
          .select('*, debentures(issuer_name), debenture_subscriptions(*)')
          .order('created_at', { ascending: false })
        if (error) throw error
        setSeries(data || [])
        // Keep the dialog data fresh if it's open
        setManageSeries((prev: any) => (prev ? data?.find((s) => s.id === prev.id) || null : null))
      } else {
        const { data, error } = await supabase
          .from('debenture_subscriptions')
          .select('*, debenture_series(*, debentures(issuer_name))')
          .eq('document_number', profile.document_number)
          .order('created_at', { ascending: false })

        if (error) throw error

        const subs = data || []
        setActiveSubs(subs.filter((s) => s.status !== 'Excluído'))
        setExcludedSubs(subs.filter((s) => s.status === 'Excluído'))
      }
      setLastUpdated(new Date())
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [profile, isAdmin])

  useEffect(() => {
    fetchData()

    // Fallback polling for maximum reliability
    const interval = setInterval(fetchData, 15000)

    // Robust Real-time sync setup
    let channel: any
    if (profile) {
      channel = supabase
        .channel(`sync_debentures_${profile.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'debenture_subscriptions' },
          () => fetchData(),
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'debenture_series' }, () =>
          fetchData(),
        )
        .subscribe()
    }

    // Refresh instantly on focus
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      if (channel) supabase.removeChannel(channel)
    }
  }, [fetchData, profile])

  if (loading && activeSubs.length === 0 && series.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Debêntures e Aportes</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Gestão de séries e subscrições em tempo real'
              : 'Acompanhamento do seu portfólio de debêntures'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/30 px-3 py-1.5 rounded-full border">
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" /> Atualizado: {format(lastUpdated, 'HH:mm:ss')}
          </span>
          <div
            className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2"
            title="Sincronização Real-time Ativa"
          />
        </div>
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Séries Disponíveis</CardTitle>
            <CardDescription>
              Visão geral de todas as debêntures emitidas e subscrições ativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Série</TableHead>
                  <TableHead>Emissor</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Aportes Ativos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.series_number}</TableCell>
                    <TableCell>{s.debentures?.issuer_name}</TableCell>
                    <TableCell>
                      {s.indexer} + {s.rate}%
                    </TableCell>
                    <TableCell>R$ {Number(s.volume).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {s.debenture_subscriptions?.filter((sub: any) => sub.status !== 'Excluído')
                          .length || 0}{' '}
                        ativos
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setManageSeries(s)}>
                        <Settings className="h-4 w-4 mr-2" /> Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {series.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma série cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="ativos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ativos" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Meus Aportes Ativos
              <Badge variant="secondary" className="ml-1">
                {activeSubs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="excluidos" className="gap-2">
              <History className="h-4 w-4" /> Histórico Excluídos
              {excludedSubs.length > 0 && (
                <Badge variant="outline" className="ml-1">
                  {excludedSubs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativos">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Emissor / Série</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Data Aporte</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSubs.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <div className="font-medium">
                            {sub.debenture_series?.debentures?.issuer_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Série {sub.debenture_series?.series_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.debenture_series?.indexer} + {sub.debenture_series?.rate}%
                        </TableCell>
                        <TableCell>
                          {sub.subscription_date
                            ? format(new Date(sub.subscription_date), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">{sub.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-primary font-medium">
                          R${' '}
                          {Number(sub.total_amount).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200">
                            Ativo
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {activeSubs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-12 bg-muted/20 border-dashed"
                        >
                          Você não possui aportes ativos no momento.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="excluidos">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Emissor / Série</TableHead>
                      <TableHead>Data Aporte</TableHead>
                      <TableHead className="text-right">Valor Original</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Exclusão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excludedSubs.map((sub) => (
                      <TableRow key={sub.id} className="opacity-70 grayscale">
                        <TableCell>
                          <div className="font-medium">
                            {sub.debenture_series?.debentures?.issuer_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Série {sub.debenture_series?.series_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.subscription_date
                            ? format(new Date(sub.subscription_date), 'dd/MM/yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono line-through">
                          R${' '}
                          {Number(sub.total_amount).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="destructive"
                            className="bg-destructive/10 text-destructive border-destructive/20"
                          >
                            Excluído
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sub.deleted_at
                            ? format(new Date(sub.deleted_at), 'dd/MM/yyyy HH:mm')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {excludedSubs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum histórico de exclusão encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {manageSeries && (
        <ManageSubscriptionsDialog
          series={manageSeries}
          open={!!manageSeries}
          onOpenChange={(open) => !open && setManageSeries(null)}
          onSuccess={fetchData}
        />
      )}
    </div>
  )
}
