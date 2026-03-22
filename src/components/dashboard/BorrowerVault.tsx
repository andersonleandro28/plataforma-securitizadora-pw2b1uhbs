import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase/client'
import { FileText, Download, ShieldAlert, FolderLock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export function BorrowerVault() {
  const { user, profile } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDocs = async () => {
      if (!user) return
      setLoading(true)
      // Query documents linked to this user's operations
      const { data } = await supabase
        .from('operation_documents')
        .select('*, credit_operations!inner(id, status)')
        .eq('credit_operations.borrower_id', user.id)
        .order('uploaded_at', { ascending: false })

      if (data) setDocs(data)
      setLoading(false)
    }

    fetchDocs()
  }, [user])

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage.from('operation-docs').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('Erro ao acessar documento.')
  }

  const kycExpired = profile?.kyc_status === 'rejected' || profile?.kyc_status === 'pending'

  return (
    <div className="space-y-6">
      {kycExpired && (
        <Card className="border-warning bg-warning/5 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-warning">Atenção ao seu Cadastro Corporativo</h3>
                <p className="text-sm text-muted-foreground">
                  Existem pendências ou documentos vencidos no seu KYC.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-warning text-warning hover:bg-warning/10"
              asChild
            >
              <Link to="/kyc">Regularizar Cadastro</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderLock className="h-5 w-5 text-primary" /> Vault de Documentos
          </CardTitle>
          <CardDescription>
            Acesso self-service aos seus contratos, aditivos, notas fiscais e comprovantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed text-muted-foreground">
              Nenhum documento encontrado no seu cofre.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors gap-4"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-6 w-6 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-sm text-foreground break-all line-clamp-1">
                        {doc.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Op. #{doc.operation_id.split('-')[0].toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0 sm:self-center"
                    onClick={() => handleDownload(doc.file_path)}
                  >
                    <Download className="h-4 w-4" /> Baixar Arquivo
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
