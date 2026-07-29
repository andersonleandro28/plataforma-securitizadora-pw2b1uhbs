import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, TrendingUp } from 'lucide-react'
import { ProductDialog } from '@/components/admin/ProductDialog'
import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function InvestmentProducts() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('investment_products')
      .select(
        `
        *,
        debenture_series ( series_number )
      `,
      )
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar produtos de investimento')
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  const handleOpenCreate = () => {
    setEditProduct(null)
    setEditDialogOpen(true)
  }

  const handleOpenEdit = (product: any) => {
    setEditProduct(product)
    setEditDialogOpen(true)
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Produtos de Investimento</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Título
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Tipo
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Série
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Status
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Risco
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Taxa
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Visível
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Nenhum produto cadastrado no banco.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 align-middle font-medium">{p.title}</td>
                    <td className="p-4 align-middle">{p.type}</td>
                    <td className="p-4 align-middle">{p.debenture_series?.series_number || '-'}</td>
                    <td className="p-4 align-middle">{p.status}</td>
                    <td className="p-4 align-middle">{p.risk}</td>
                    <td className="p-4 align-middle">{p.rate}</td>
                    <td className="p-4 align-middle">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {p.is_active ? 'Ativo' : 'Oculto'}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {p.type === 'Rendimento Variável (Forex Manual)' && (
                          <Button variant="ghost" size="sm" asChild title="Rendimentos Manuais">
                            <Link to={`/admin/products/${p.id}/yields`}>
                              <TrendingUp className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        product={editProduct}
        onSuccess={fetchProducts}
      />
    </div>
  )
}
