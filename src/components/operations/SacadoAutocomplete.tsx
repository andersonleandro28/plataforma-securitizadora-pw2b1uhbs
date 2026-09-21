import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { KnownSacado } from '@/hooks/use-sacado-suggestions'
import { Sparkles, Building2, UserCheck, X } from 'lucide-react'

interface SacadoAutocompleteProps {
  label: string
  placeholder?: string
  value: string
  onChange: (val: string) => void
  onSelectSacado: (sacado: KnownSacado) => void
  suggestions: KnownSacado[]
  isLoading?: boolean
  autoFilled?: boolean
  onClearAutoFill?: () => void
  autoFilledSource?: string
}

export function SacadoAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelectSacado,
  suggestions,
  isLoading,
  autoFilled,
  onClearAutoFill,
  autoFilledSource,
}: SacadoAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item: KnownSacado) => {
    onSelectSacado(item)
    setIsOpen(false)
  }

  const showDropdown = isOpen && suggestions.length > 0

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {autoFilled && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-full animate-in fade-in duration-200">
            <Sparkles className="w-3 h-3 shrink-0" />
            Auto-preenchido
            {autoFilledSource && (
              <span className="text-muted-foreground text-[10px]">
                (
                {autoFilledSource === 'credit_operations'
                  ? 'operação anterior'
                  : 'base de clientes'}
                )
              </span>
            )}
            {onClearAutoFill && (
              <button
                type="button"
                onClick={onClearAutoFill}
                className="ml-1 text-muted-foreground hover:text-foreground"
                title="Desfazer preenchimento"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        )}
      </div>

      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (value && value.trim().length >= 2) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          className={autoFilled ? 'border-emerald-500/50 dark:border-emerald-500/40' : ''}
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          <div className="p-1 text-[11px] font-medium text-muted-foreground px-2 py-1 bg-muted/40 border-b flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" /> Sacados conhecidos no sistema
            </span>
            <span className="text-[10px]">Clique para preencher</span>
          </div>
          <div className="p-1">
            {suggestions.map((item, idx) => (
              <button
                key={`${item.cleanDocument || item.name}-${idx}`}
                type="button"
                className="w-full text-left px-2.5 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground text-xs flex flex-col gap-0.5 transition-colors cursor-pointer"
                onClick={() => handleSelect(item)}
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-1.5 text-foreground truncate">
                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <strong className="truncate">{item.name}</strong>
                  </span>
                  {item.document && (
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0 ml-2">
                      {item.document}
                    </span>
                  )}
                </div>
                {(item.email || item.phone) && (
                  <div className="text-[11px] text-muted-foreground truncate pl-5">
                    {item.email} {item.phone ? `• ${item.phone}` : ''}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
