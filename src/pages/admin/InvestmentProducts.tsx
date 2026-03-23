import { useEffect, useState } from 'react'
import { Plus, Search, Archive, Copy, Edit2, ShieldCheck, EyeOff, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ProductDialog } from '@/components/admin/ProductDialog'

export default function InvestmentProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('investment_products')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (data && !error) setProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleDuplicate = (prod: any) => {
    const copy = { ...prod, id: undefined, title: `${prod.title} (Cópia)`, sold_quotas: 0 }
    setSelectedProduct(copy)
    setDialogOpen(true)
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Deseja realmente arquivar este produto? Ele sumirá da listagem principal.'))
      return
    try {
      await supabase
        .from('investment_products')
        .update({ is_archived: true, is_active: false })
        .eq('id', id)
      toast.success('Produto arquivado.')
      fetchProducts()
    } catch (e) {
      toast.error('Erro ao arquivar.')
    }
  }

  const filtered = products.filter((p) => {
    const mSearch = p.title?.toLowerCase().includes(search.toLowerCase())
    const mStatus = filterStatus === 'all' || p.status === filterStatus
    return mSearch && mStatus
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Produtos</h1>
          <p className="text-muted-foreground">
            Administre as ofertas, cotas e visibilidade da vitrine do investidor.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedProduct(null)
            setDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Catálogo Ativo
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Em Captação">Em Captação</SelectItem>
                  <SelectItem value="Esgotado">Esgotado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Produto / Série</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-center">Cotas Vendidas</TableHead>
                <TableHead className="text-center">Status / Visibilidade</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6 font-medium">
                      {p.title}
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">
                        Vol: R${' '}
                        {((p.global_quotas || 0) * (p.quota_value || 0)).toLocaleString('pt-BR')} •{' '}
                        {p.currency}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.rating || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-sm">
                          {p.sold_quotas || 0} / {p.global_quotas || 0}
                        </span>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(100, ((p.sold_quotas || 0) / (p.global_quotas || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center space-y-1">
                      <div>
                        <Badge variant={p.status === 'Esgotado' ? 'destructive' : 'secondary'}>
                          {p.status}
                        </Badge>
                      </div>
                      {!p.is_active && (
                        <div className="text-xs text-destructive flex items-center justify-center gap-1">
                          <EyeOff className="h-3 w-3" /> Oculto
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6 space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => {
                          setSelectedProduct(p)
                          setDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Duplicar"
                        onClick={() => handleDuplicate(p)}
                      >
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Arquivar"
                        onClick={() => handleArchive(p.id)}
                      >
                        <Archive className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
        onSuccess={fetchProducts}
      />
    </div>
  )
}
