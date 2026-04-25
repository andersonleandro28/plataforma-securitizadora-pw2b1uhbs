import { useState, useEffect } from 'react'
import { Plus, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
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
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function NewTransactionDialog({ open, onOpenChange, onSuccess }: any) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [searchCat, setSearchCat] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [isAddingCat, setIsAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const [newEntry, setNewEntry] = useState({
    type: 'out',
    amount: '',
    description: '',
    categoryId: '',
    categoryName: '',
    date: new Date().toISOString().split('T')[0],
    is_escrow: false,
  })

  useEffect(() => {
    if (open) {
      fetchCategories()
      setNewEntry({
        type: 'out',
        amount: '',
        description: '',
        categoryId: '',
        categoryName: '',
        date: new Date().toISOString().split('T')[0],
        is_escrow: false,
      })
      setIsAddingCat(false)
      setSearchCat('')
    }
  }, [open])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('*')
        .order('name')
      if (error) throw error

      const defaults = [
        { id: 'default-1', name: 'Tarifa Bancária (TED/PIX/Transferências)', type: 'out' },
        { id: 'default-2', name: 'Cesta de Serviços Bancários', type: 'out' },
        { id: 'default-3', name: 'Tarifa de Emissão de Boletos', type: 'out' },
        { id: 'default-4', name: 'Multa', type: 'out' },
        { id: 'default-5', name: 'Juros', type: 'out' },
      ]

      if (data && data.length > 0) {
        const merged = [...data]
        defaults.forEach((def) => {
          if (!merged.find((c) => c.name.toLowerCase() === def.name.toLowerCase())) {
            merged.push(def)
          }
        })
        setCategories(merged.sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        setCategories(defaults)
      }
    } catch (e) {
      setCategories([
        { id: 'default-1', name: 'Tarifa Bancária (TED/PIX/Transferências)', type: 'out' },
        { id: 'default-2', name: 'Cesta de Serviços Bancários', type: 'out' },
        { id: 'default-3', name: 'Tarifa de Emissão de Boletos', type: 'out' },
        { id: 'default-4', name: 'Multa', type: 'out' },
        { id: 'default-5', name: 'Juros', type: 'out' },
      ])
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transaction_categories')
        .insert({ name: newCatName.trim(), type: newEntry.type })
        .select()
        .single()

      if (error) throw error

      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewEntry({ ...newEntry, categoryId: data.id, categoryName: data.name })
      setIsAddingCat(false)
      setNewCatName('')
      setPopoverOpen(false)
      toast.success('Categoria criada com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao criar categoria: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!newEntry.categoryId || !newEntry.amount || !newEntry.description) {
      toast.error('Preencha todos os campos obrigatórios (Valor, Descrição e Categoria).')
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let finalCategoryId = newEntry.categoryId

      if (finalCategoryId.startsWith('default-')) {
        const { data: newCat, error: catErr } = await supabase
          .from('transaction_categories')
          .insert({ name: newEntry.categoryName, type: newEntry.type })
          .select()
          .single()

        if (!catErr && newCat) {
          finalCategoryId = newCat.id
        } else {
          finalCategoryId = ''
        }
      }

      const payload: any = {
        type: newEntry.type,
        amount: Number(newEntry.amount),
        description: newEntry.description,
        date: newEntry.date,
        is_escrow: newEntry.is_escrow,
        category: newEntry.categoryName,
        created_by: user?.id,
      }

      if (finalCategoryId) {
        payload.category_id = finalCategoryId
      }

      const { error } = await supabase.from('treasury_transactions').insert(payload)

      if (error) throw error

      toast.success('Lançamento registrado com sucesso!')
      onOpenChange(false)
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
          <DialogTitle>Novo Lançamento Manual</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={newEntry.type}
                onValueChange={(v) => setNewEntry({ ...newEntry, type: v })}
              >
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
                value={newEntry.date}
                onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={newEntry.amount}
              onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={newEntry.description}
              onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              placeholder="Ex: Pagamento de fornecedor"
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <PopoverPrimitive.Root
              modal={true}
              open={popoverOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setIsAddingCat(false)
                  setNewCatName('')
                }
                setPopoverOpen(open)
              }}
            >
              <PopoverPrimitive.Trigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal"
                  onClick={(e) => {
                    e.preventDefault()
                    setPopoverOpen(!popoverOpen)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setPopoverOpen(!popoverOpen)
                    }
                  }}
                >
                  <span className="truncate">
                    {newEntry.categoryName || 'Selecione uma categoria...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverPrimitive.Trigger>
              <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                  className="z-[100] w-[var(--radix-popover-trigger-width)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
                  align="start"
                  sideOffset={4}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                  }}
                >
                  {!isAddingCat ? (
                    <div className="flex flex-col gap-1">
                      <div className="px-2 py-1.5">
                        <Input
                          placeholder="Buscar categoria..."
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
                              type="button"
                              key={cat.id}
                              variant="ghost"
                              className={cn(
                                'justify-start font-normal h-8 px-2',
                                newEntry.categoryId === cat.id && 'bg-accent',
                              )}
                              onClick={(e) => {
                                e.preventDefault()
                                setNewEntry({
                                  ...newEntry,
                                  categoryId: cat.id,
                                  categoryName: cat.name,
                                })
                                setPopoverOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4 shrink-0',
                                  newEntry.categoryId === cat.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <span className="truncate">{cat.name}</span>
                            </Button>
                          ))}
                        {categories.filter((c) =>
                          c.name.toLowerCase().includes(searchCat.toLowerCase()),
                        ).length === 0 && (
                          <p className="text-xs text-muted-foreground p-3 text-center">
                            Nenhuma categoria encontrada.
                          </p>
                        )}
                      </div>
                      <div className="h-px bg-border my-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        className="justify-start text-primary h-9 px-2"
                        onClick={(e) => {
                          e.preventDefault()
                          setIsAddingCat(true)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" /> + Cadastrar Nova Categoria
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 p-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">
                        Nova Categoria
                      </Label>
                      <Input
                        placeholder="Nome da categoria"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        autoFocus
                        className="h-8"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={(e) => {
                            e.preventDefault()
                            setIsAddingCat(false)
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.preventDefault()
                            handleAddCategory()
                          }}
                          disabled={loading || !newCatName.trim()}
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverPrimitive.Content>
              </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="escrow"
              checked={newEntry.is_escrow}
              onCheckedChange={(c) => setNewEntry({ ...newEntry, is_escrow: !!c })}
            />
            <Label htmlFor="escrow" className="cursor-pointer font-normal">
              Vincular ao Saldo Escrow (Terceiros)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
