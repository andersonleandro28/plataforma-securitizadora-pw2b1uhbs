import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertCircle, Landmark } from 'lucide-react'
import { useCompanyBankAccounts, formatBankAccountLabel } from '@/hooks/use-company-bank-accounts'

interface CompanyBankAccountSelectProps {
  value?: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export function CompanyBankAccountSelect({
  value,
  onChange,
  label = 'Conta Bancária de Movimentação',
  required = true,
  disabled = false,
  className,
  id = 'bank-account-select',
}: CompanyBankAccountSelectProps) {
  const { accounts, activeAccount, loading } = useCompanyBankAccounts()

  // Auto-seleciona a conta ativa quando nenhuma conta estiver selecionada ainda
  useEffect(() => {
    if (!value && activeAccount?.id) {
      onChange(activeAccount.id)
    }
  }, [value, activeAccount, onChange])

  if (!loading && accounts.length === 0) {
    return (
      <div className={`space-y-1.5 ${className || ''}`}>
        <Label htmlFor={id} className="text-xs font-medium">
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Nenhuma conta bancária cadastrada.{' '}
            <Link
              to="/admin/bank-accounts"
              className="underline font-semibold hover:text-amber-800"
            >
              Cadastrar em Dados Bancários
            </Link>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1.5">
          <Landmark className="w-3.5 h-3.5 text-primary" />
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
        <Link
          to="/admin/bank-accounts"
          tabIndex={-1}
          className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
        >
          Gerenciar contas
        </Link>
      </div>

      <Select
        value={value || activeAccount?.id || ''}
        onValueChange={onChange}
        disabled={disabled || loading}
      >
        <SelectTrigger id={id} className="w-full text-xs">
          <SelectValue placeholder={loading ? 'Carregando contas...' : 'Selecione a conta'} />
        </SelectTrigger>
        <SelectContent className="z-[99999] relative max-w-[calc(100vw-2rem)]">
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={acc.id} className="text-xs py-2">
              <div className="flex flex-col text-left">
                <span className="font-medium text-foreground">{formatBankAccountLabel(acc)}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {acc.owner_name} • {acc.owner_document}
                  {acc.pix_key ? ` • PIX: ${acc.pix_key}` : ''}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
