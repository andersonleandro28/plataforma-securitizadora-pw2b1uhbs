import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardTab } from '@/components/reports/DashboardTab'
import { SubscriptionsTab } from '@/components/reports/SubscriptionsTab'
import { AcquisitionsTab } from '@/components/reports/AcquisitionsTab'
import { ResultsTab } from '@/components/reports/ResultsTab'
import { ExtractTab } from '@/components/reports/ExtractTab'
import { InvestorYieldsReportTab } from '@/components/reports/InvestorYieldsReportTab'
import { PeriodOperationsReportTab } from '@/components/reports/PeriodOperationsReportTab'
import { BankMovementExtractReportTab } from '@/components/reports/BankMovementExtractReportTab'
import { ReceivablesToReceiveReportTab } from '@/components/reports/ReceivablesToReceiveReportTab'
import { ProjectedCashflowReportTab } from '@/components/reports/ProjectedCashflowReportTab'
import { UnifiedReportTab } from '@/components/reports/UnifiedReportTab'
import { useAuth } from '@/hooks/use-auth'

export default function Reports() {
  const { activeRole } = useAuth()

  const isAdminOrStaff =
    activeRole === 'admin' || activeRole === 'staff' || activeRole === 'accountant'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relatórios e Inteligência</h2>
          <p className="text-muted-foreground text-sm">
            Demonstrativos de carteira, subscrições, rendimentos, operações, extrato bancário
            consolidado e relatório unificado.
          </p>
        </div>
      </div>
      <Tabs defaultValue={isAdminOrStaff ? 'investor-yields' : 'extract'} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-2 print:hidden">
          {' '}
          {isAdminOrStaff && (
            <TabsTrigger value="unified-report" className="font-medium text-primary font-semibold">
              Gerador Unificado
            </TabsTrigger>
          )}
          {isAdminOrStaff && (
            <TabsTrigger value="investor-yields" className="font-medium">
              Rendimentos dos Investidores
            </TabsTrigger>
          )}
          {isAdminOrStaff && (
            <TabsTrigger value="period-operations" className="font-medium">
              Operações do Período
            </TabsTrigger>
          )}
          {isAdminOrStaff && (
            <TabsTrigger value="bank-movements" className="font-medium">
              Extrato de Movimentações Bancárias
            </TabsTrigger>
          )}
          {isAdminOrStaff && (
            <TabsTrigger
              value="projected-cashflow"
              className="font-medium text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              Fluxo de Caixa Projetado
            </TabsTrigger>
          )}
          {isAdminOrStaff && (
            <TabsTrigger
              value="receivables-to-receive"
              className="font-medium text-blue-600 dark:text-blue-400 font-semibold"
            >
              Recebíveis a Receber
            </TabsTrigger>
          )}
          {isAdminOrStaff && <TabsTrigger value="dashboard">Resumo de Carteira</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="subscriptions">Subscrições</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="acquisitions">Aquisições (CCBs/Rec.)</TabsTrigger>}
          {isAdminOrStaff && <TabsTrigger value="results">Resultado e Receita</TabsTrigger>}
          <TabsTrigger value="extract">Extrato Detalhado</TabsTrigger>
        </TabsList>

        {isAdminOrStaff && (
          <>
            <TabsContent value="unified-report" className="space-y-4">
              <UnifiedReportTab />
            </TabsContent>
            <TabsContent value="investor-yields" className="space-y-4">
              <InvestorYieldsReportTab />
            </TabsContent>
            <TabsContent value="period-operations" className="space-y-4">
              <PeriodOperationsReportTab />
            </TabsContent>
            <TabsContent value="bank-movements" className="space-y-4">
              <BankMovementExtractReportTab />
            </TabsContent>
            <TabsContent value="projected-cashflow" className="space-y-4">
              <ProjectedCashflowReportTab />
            </TabsContent>
            <TabsContent value="receivables-to-receive" className="space-y-4">
              <ReceivablesToReceiveReportTab />
            </TabsContent>
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
