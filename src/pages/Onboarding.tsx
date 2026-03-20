import { useEffect, useState } from 'react'
import { Building2, User as UserIcon, Eye, Search, ShieldCheck, FileText } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Onboarding() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadProfiles = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, kyc_status, entity_type, document_number, phone')
      .neq('role', 'admin')
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
      toast.error('Erro ao atualizar status KYC do cliente.')
    } else {
      toast.success('Parecer de Compliance atualizado com sucesso.')
      setProfiles(profiles.map((p) => (p.id === id ? { ...p, kyc_status: status } : p)))
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Aprovado</Badge>
      case 'rejected':
        return <Badge variant="destructive">Ajustes Necessários</Badge>
      case 'under_review':
        return (
          <Badge
            variant="secondary"
            className="bg-warning text-warning-foreground hover:bg-warning/80"
          >
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
      p.document_number?.includes(search),
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compliance & KYC</h1>
        <p className="text-muted-foreground">
          Central de análise e aprovação regulatória de clientes (COAF/LGPD).
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
                  Verifique a documentação e altere o status de aprovação de novos cadastros.
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
                    <TableHead>Tipo / Papel</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Status KYC</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Carregando fila de análises...
                      </TableCell>
                    </TableRow>
                  ) : filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Nenhum registro de cliente encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium flex flex-col">
                          <div className="flex items-center gap-2">
                            {p.entity_type === 'pj' ? (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                            {p.full_name || 'Usuário Pendente'}
                          </div>
                          <span className="text-xs text-muted-foreground ml-6">{p.email}</span>
                        </TableCell>
                        <TableCell>
                          <span className="uppercase text-xs font-semibold mr-2 bg-muted px-1.5 py-0.5 rounded">
                            {p.entity_type || 'PF'}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            ({p.role})
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.document_number || '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(p.kyc_status)}</TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-2">
                                <Eye className="h-4 w-4" /> Revisar Dossiê
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Análise de Dossiê de Cliente</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-5 py-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Nome da Entidade
                                  </p>
                                  <p className="font-medium">{p.full_name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">
                                      CPF/CNPJ
                                    </p>
                                    <p className="font-mono text-sm">
                                      {p.document_number || 'N/A'}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Telefone
                                    </p>
                                    <p className="text-sm">{p.phone || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Documentos Submetidos (Storage Privado)
                                  </p>
                                  <div className="bg-muted p-3 rounded-md flex items-center justify-between text-sm border">
                                    <span className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-primary" /> RG / CNH /
                                      Contrato Social
                                    </span>
                                    <Button variant="link" size="sm" className="h-auto p-0">
                                      Download
                                    </Button>
                                  </div>
                                  <div className="bg-muted p-3 rounded-md flex items-center justify-between text-sm border">
                                    <span className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-primary" /> Comprovante de
                                      Endereço
                                    </span>
                                    <Button variant="link" size="sm" className="h-auto p-0">
                                      Download
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-4 border-t">
                                  <p className="text-sm font-medium">Parecer Final de Compliance</p>
                                  <Select
                                    value={p.kyc_status}
                                    onValueChange={(v) => handleUpdateStatus(p.id, v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pendente (Incompleto)</SelectItem>
                                      <SelectItem value="under_review">
                                        Em Análise (Aguardando)
                                      </SelectItem>
                                      <SelectItem value="approved">Aprovado (Liberado)</SelectItem>
                                      <SelectItem value="rejected">
                                        Rejeitado (Necessita Ajustes)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle>Políticas de Compliance</CardTitle>
              <CardDescription>
                Configuração de limites e exigências regulatórias globais do fundo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <h4 className="font-medium text-sm">Consulta Automática COAF</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Varredura diária e contínua de PEPs na base de clientes aprovada.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-600 border-emerald-200"
                >
                  Sistema Ativo
                </Badge>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div>
                  <h4 className="font-medium text-sm">Trilha de Auditoria LGPD</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Registra todos os aceites de termos em log imutável no banco de dados.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-600 border-emerald-200"
                >
                  Sistema Ativo
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
