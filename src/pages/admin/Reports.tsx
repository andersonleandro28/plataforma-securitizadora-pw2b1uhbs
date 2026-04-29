import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardTab } from '@/components/reports/DashboardTab'
import { SubscriptionsTab } from '@/components/reports/SubscriptionsTab'
import { AcquisitionsTab } from '@/components/reports/AcquisitionsTab'
import { ResultsTab } from '@/components/reports/ResultsTab'
import { ExtractTab } from '@/components/reports/ExtractTab'
import { useAuth } from '@/hooks/use-auth'

export default function Reports() {
  const { activeRole } = useAuth()

  const isAdminOrStaff =
    activeRole === 'admin' || activeRole === 'staff' || activeRole === 'accountant'

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Relatórios e Inteligência</h2>
      </div>
      <Tabs defaultValue={isAdminOrStaff ? 'dashboard' : 'extract'} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-2">
          {isAdminOrStaff && <TabsTrigger value="dashboard">Resumo de Carteira</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="subscriptions">Subscrições</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="acquisitions">Aquisições (CCBs/Rec.)</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="results">Resultado e Receita</TabsTrigger>}
          <TabsTrigger value="extract">Extrato Detalhado</TabsTrigger>
        </TabsList>

        {isAdminOrStaff && (
          <>
            <TabsContent value="dashboard" className="space-y-4">
              <DashboardTab />
            </TabsContent>
            <TabsContent value="subscriptions" className="space-y-4">
              <SubscriptionsTab />
            </TabsContent>
            <TabsContent value="acquisitions" className="space-y-4">
              <AcquisitionsTab />
            </TabsContent>
            <TabsContent value="results" className="space-y-4">
              <ResultsTab />
            </TabsContent>
          </>
        )}
        <TabsContent value="extract" className="space-y-4">
          <ExtractTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
