import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CcbParametersForm } from '@/components/admin/CcbParametersForm'
import { GlobalParametersForm } from '@/components/admin/GlobalParametersForm'
import { Landmark, FileText } from 'lucide-react'

export default function FinancialParameters() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      <div>
        <h1 className="text-3xl font-bold">Parâmetros Financeiros</h1>
        <p className="text-muted-foreground">
          Gerencie as taxas, custos e configurações de todas as operações financeiras da plataforma.
        </p>
      </div>

      <Tabs defaultValue="ccb" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="ccb" className="gap-2">
            <FileText className="h-4 w-4" /> Configuração de CCB
          </TabsTrigger>
          <TabsTrigger value="gerais" className="gap-2">
            <Landmark className="h-4 w-4" /> Parâmetros Gerais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ccb" className="mt-0 focus-visible:outline-none">
          <CcbParametersForm />
        </TabsContent>

        <TabsContent value="gerais" className="mt-0 focus-visible:outline-none">
          <GlobalParametersForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
