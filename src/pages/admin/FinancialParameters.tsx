import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CcbParametersForm } from '@/components/admin/CcbParametersForm'
import { GlobalParametersForm } from '@/components/admin/GlobalParametersForm'
import { CompanySettingsForm } from '@/components/admin/CompanySettingsForm'
import { Landmark, FileText, Building2 } from 'lucide-react'

export default function FinancialParameters() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      <div>
        <h1 className="text-3xl font-bold">Parâmetros & Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie os dados cadastrais da securitizadora, taxas, custos e configurações de todas as
          operações da plataforma.
        </p>
      </div>

      <Tabs defaultValue="empresa" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="empresa" className="gap-2">
            <Building2 className="h-4 w-4" /> Dados da Securitizadora
          </TabsTrigger>
          <TabsTrigger value="ccb" className="gap-2">
            <FileText className="h-4 w-4" /> Configuração de CCB
          </TabsTrigger>
          <TabsTrigger value="gerais" className="gap-2">
            <Landmark className="h-4 w-4" /> Parâmetros Gerais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-0 focus-visible:outline-none">
          <CompanySettingsForm />
        </TabsContent>

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
