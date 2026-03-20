import { useEffect, useState } from 'react'
import { Building2, User as UserIcon, Eye, Search, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { DossierDialog } from '@/components/kyc/DossierDialog'

export default function Onboarding() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [userDocs, setUserDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadProfiles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('is_admin', true)
      .order('created_at', { ascending: false })
    if (!error && data) setProfiles(data)
    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('profiles').update({ kyc_status: status }).eq('id', id)
    if (error) {
      toast.error('Erro ao atualizar status KYC.')
    } else {
      toast.success('Parecer atualizado com sucesso.')
      setProfiles(profiles.map((p) => (p.id === id ? { ...p, kyc_status: status } : p)))
      setDialogOpen(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Aprovado</Badge>
      case 'rejected':
        return <Badge variant="destructive">Ajustes</Badge>
      case 'under_review':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200">
            Em Análise
          </Badge>
        )
      default:
        return <Badge variant="outline">Pendente</Badge>
    }
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.pj_company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.document_number?.includes(search) ||
      p.email?.toLowerCase().includes(search.toLowerCase()),
  )

  const openDossier = async (profile: any) => {
    setSelectedProfile(profile)
    setDialogOpen(true)
    setDocsLoading(true)
    const { data } = await supabase.from('kyc_documents').select('*').eq('user_id', profile.id)
    setUserDocs(data || [])
    setDocsLoading(false)
  }

  const handleViewDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 300)
    if (error) return toast.error('Erro ao gerar link do documento.')
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance & KYC</h1>
        <p className="text-muted-foreground">
          Central de análise e aprovação regulatória de clientes.
        </p>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="directory">Fila de Análise KYC</TabsTrigger>
          <TabsTrigger value="settings">Políticas e Termos</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4 animate-fade-in">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Dossiês Submetidos
                </CardTitle>
                <CardDescription>
                  Verifique a documentação e altere o status de aprovação.
                </CardDescription>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou documento..."
                  className="pl-9 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Status KYC</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        Nenhum cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {p.entity_type === 'pj' ? (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                            {p.full_name || p.pj_company_name || 'Usuário Pendente'}
                          </div>
                          <span className="text-xs text-muted-foreground ml-6">{p.email}</span>
                        </TableCell>
                        <TableCell>
                          <span className="uppercase text-xs font-semibold mr-2 bg-muted px-1.5 py-0.5 rounded">
                            {p.entity_type || 'PF'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.document_number || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(p.kyc_status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => openDossier(p)}
                          >
                            <Eye className="h-4 w-4" /> Revisar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Em breve</CardTitle>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>

      <DossierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={selectedProfile}
        docs={userDocs}
        docsLoading={docsLoading}
        onUpdateStatus={handleUpdateStatus}
        onViewDoc={handleViewDoc}
      />
    </div>
  )
}
