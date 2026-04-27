import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function EditTransactionDialog({ open, onOpenChange, transaction, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [searchCat, setSearchCat] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isClosedPeriod, setIsClosedPeriod] = useState(false)

  const [entry, setEntry] = useState({
    type: 'out',
    amount: '',
    description: '',
    categoryId: '',
    categoryName: '',
    date: '',
    is_escrow: false,
  })

  useEffect(() => {
    if (open && transaction) {
      fetchCategories()
      setEntry({
        type: transaction.type,
        amount: transaction.amount.toString(),
        description: transaction.description,
        categoryId: transaction.categoryId || '',
        categoryName: transaction.category || '',
        date: transaction.date,
        is_escrow: transaction.is_escrow,
      })
      setSearchCat('')

      const txDate = new Date(transaction.date + 'T12:00:00Z')
      const now = new Date()
      setIsClosedPeriod(
        txDate.getFullYear() < now.getFullYear() ||
          (txDate.getFullYear() === now.getFullYear() && txDate.getMonth() < now.getMonth()),
      )
    }
  }, [open, transaction])

  const fetchCategories = async () => {
    const { data } = await supabase.from('transaction_categories').select('*').order('name')
    if (data) setCategories(data)
  }

  const handleSave = async () => {
    if (isClosedPeriod || !entry.amount || !entry.description || !entry.categoryName) return

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const changes = []
      if (Number(entry.amount) !== transaction.amount) {
        changes.push(`Valor alterado de R$ ${transaction.amount} para R$ ${entry.amount}`)
      }
      if (entry.date !== transaction.date) {
        changes.push(`Data alterada de ${transaction.date} para ${entry.date}`)
      }
      if (entry.categoryName !== transaction.category) {
        changes.push(`Categoria alterada de '${transaction.category}' para '${entry.categoryName}'`)
      }
      if (entry.description !== transaction.description) {
        changes.push(
          `Descrição alterada de '${transaction.description}' para '${entry.description}'`,
        )
      }

      if (changes.length === 0) {
        toast.info('Nenhuma alteração detectada.')
        onOpenChange(false)
        return
      }

      const payload: any = {
        type: entry.type,
        amount: Number(entry.amount),
        description: entry.description,
        date: entry.date,
        is_escrow: entry.is_escrow,
        category: entry.categoryName,
        category_id: entry.categoryId?.startsWith('default-') ? null : entry.categoryId,
      }

      const { error } = await supabase
        .from('treasury_transactions')
        .update(payload)
        .eq('id', transaction.rawId)

      if (error) throw error

      await supabase.from('audit_logs').insert({
        entity_type: 'treasury_transactions',
        entity_id: transaction.rawId,
        action: 'admin_edited_transaction',
        user_id: user?.id,
        details: {
          message: `Lançamento editado. Alterações: ${changes.join('; ')}`,
          changes,
        },
      })

      toast.success('Lançamento atualizado com sucesso!')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Lançamento Manual</DialogTitle>
        </DialogHeader>
        {isClosedPeriod && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Edição Bloqueada</AlertTitle>
            <AlertDescription>
              Este lançamento pertence a um mês fiscal já encerrado e não pode ser alterado.
            </AlertDescription>
          </Alert>
        )}
        <div className={cn('grid gap-4 py-4', isClosedPeriod && 'opacity-50 pointer-events-none')}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={entry.type} onValueChange={(v) => setEntry({ ...entry, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada (+)</SelectItem>
                  <SelectItem value="out">Saída (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={entry.date}
                onChange={(e) => setEntry({ ...entry, date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={entry.amount}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={entry.description}
              onChange={(e) => setEntry({ ...entry, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <PopoverPrimitive.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverPrimitive.Trigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">{entry.categoryName || 'Selecione...'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content className="z-[9999] w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover p-1 shadow-md">
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Buscar..."
                      value={searchCat}
                      onChange={(e) => setSearchCat(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto flex flex-col px-1">
                    {categories
                      .filter((c) => c.name.toLowerCase().includes(searchCat.toLowerCase()))
                      .map((cat) => (
                        <Button
                          key={cat.id}
                          variant="ghost"
                          className="justify-start h-8 px-2"
                          onClick={() => {
                            setEntry({ ...entry, categoryId: cat.id, categoryName: cat.name })
                            setPopoverOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              entry.categoryId === cat.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="truncate">{cat.name}</span>
                        </Button>
                      ))}
                  </div>
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || isClosedPeriod}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
