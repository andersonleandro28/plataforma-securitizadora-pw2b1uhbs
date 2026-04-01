import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, FileText, CheckCircle, AlertTriangle, FileSignature, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function DossierDialog({
  open,
  onOpenChange,
  profile,
  docs,
  docsLoading,
  onUpdateStatus,
  onViewDoc,
}: any) {
  const [loadingDocusign, setLoadingDocusign] = useState(false)

  if (!profile) return null

  const isPj = profile.entity_type === 'pj'

  const handleDocuSign = async () => {
    try {
      setLoadingDocusign(true)
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
        'generate-kyc-pdf',
        { body: { userId: profile.id } },
      )
      if (pdfError) throw pdfError

      const { data: dsData, error: dsError } = await supabase.functions.invoke(
        'docusign-envelope',
        {
          body: {
            signerEmail: profile.email,
            signerName: profile.full_name || profile.pj_company_name,
            documentUrl: pdfData.url,
            type: 'kyc',
            id: profile.id,
          },
        },
      )
      if (dsError) throw dsError

      toast.success('Enviado para o DocuSign com sucesso!')
      onOpenChange(false)
    } catch (e: any) {
      toast.error('Erro ao enviar DocuSign: ' + e.message)
    } finally {
      setLoadingDocusign(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Análise de Dossiê - {profile.full_name || profile.pj_company_name || 'Cliente'}
          </DialogTitle>
          <DialogDescription>
            Visualize os dados preenchidos e documentos enviados para aprovação do cadastro.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="resumo" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="dados">{isPj ? 'Empresa / Rep' : 'Dados Pessoais'}</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Nome / Razão Social</p>
                <p className="font-medium">
                  {profile.full_name || profile.pj_company_name || 'N/A'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{profile.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">CPF / CNPJ</p>
                <p className="font-mono text-sm">{profile.document_number || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p className="text-sm">{profile.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border mt-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Risco PEP</p>
                <div className="flex items-center gap-2">
                  {profile.is_pep ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600">Sim (Atenção)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm">Não</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Termos LGPD</p>
                <div className="flex items-center gap-2">
                  {profile.lgpd_accepted ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm">Aceito</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive">Pendente</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dados" className="space-y-4 pt-4">
            {!isPj ? (
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-xs text-muted-foreground">RG</p>
                  <p className="text-sm">{profile.pf_rg || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Naturalidade / Nacionalidade</p>
                  <p className="text-sm">
                    {profile.pf_birth_city || '-'} / {profile.pf_nationality || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nome da Mãe</p>
                  <p className="text-sm">{profile.pf_mother_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nome do Pai</p>
                  <p className="text-sm">{profile.pf_father_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado Civil</p>
                  <p className="text-sm">{profile.pf_marital_status || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profissão</p>
                  <p className="text-sm">{profile.pf_occupation || '-'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-sm mb-3 border-b pb-1">Dados da Empresa</h4>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Razão Social</p>
                      <p className="text-sm">{profile.pj_company_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                      <p className="text-sm">{profile.pj_trade_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CNAE Principal</p>
                      <p className="text-sm">{profile.pj_cnae || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Regime Tributário</p>
                      <p className="text-sm capitalize">{profile.pj_tax_regime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Faturamento Anual</p>
                      <p className="text-sm">
                        {profile.pj_annual_revenue ? `R$ ${profile.pj_annual_revenue}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Fundação</p>
                      <p className="text-sm">
                        {profile.pj_foundation_date
                          ? new Date(profile.pj_foundation_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-3 border-b pb-1">Representante Legal</h4>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome Completo</p>
                      <p className="text-sm">{profile.pj_rep_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cargo</p>
                      <p className="text-sm">{profile.pj_rep_role || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="text-sm">{profile.pj_rep_cpf || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RG</p>
                      <p className="text-sm">{profile.pj_rep_rg || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Atua por Procuração?</p>
                      <p className="text-sm">{profile.pj_rep_is_procurator ? 'Sim' : 'Não'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="endereco" className="pt-4">
            <div className="text-sm bg-muted/30 p-4 rounded-md border border-border/50">
              {profile.address_street ? (
                <>
                  {profile.address_street}, {profile.address_number}{' '}
                  {profile.address_complement ? ` - ${profile.address_complement}` : ''}
                  <br />
                  {profile.address_neighborhood ? `${profile.address_neighborhood}, ` : ''}{' '}
                  {profile.address_city} - {profile.address_state}
                  <br />
                  CEP: {profile.address_zip}
                </>
              ) : (
                <span className="text-muted-foreground italic">Endereço não informado</span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4 pt-4">
            {docsLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground bg-muted/20 border rounded-md">
                Carregando documentos...
              </div>
            ) : docs.length > 0 ? (
              <div className="space-y-2">
                {docs.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="bg-background p-3 rounded-md flex items-center justify-between text-sm border shadow-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <FileText className="w-4 h-4 text-primary" />{' '}
                      {doc.document_type === 'id_document'
                        ? 'Doc. de Identificação'
                        : doc.document_type === 'proof_address'
                          ? 'Comprovante Endereço'
                          : doc.document_type === 'power_of_attorney'
                            ? 'Procuração'
                            : 'Documento'}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 gap-2"
                      onClick={() => onViewDoc(doc.file_path)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Visualizar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground bg-muted/20 border rounded-md border-dashed">
                Nenhum documento encontrado.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-6 border-t mt-4">
          <p className="text-sm font-medium">Decisão de Compliance</p>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onUpdateStatus(profile.id, 'approved')}
            >
              Aprovar Cadastro
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => onUpdateStatus(profile.id, 'rejected')}
            >
              Reprovar / Pedir Ajustes
            </Button>
            {profile.kyc_status === 'approved' && profile.kyc_signature_status !== 'assinado' && (
              <Button
                variant="outline"
                className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                onClick={handleDocuSign}
                disabled={loadingDocusign}
              >
                {loadingDocusign ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSignature className="w-4 h-4 mr-2" />
                )}
                Enviar DocuSign
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
