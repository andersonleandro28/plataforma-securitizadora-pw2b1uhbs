import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

export function IndexerSelect({
  value,
  onValueChange,
  disabled,
}: {
  value: string | null | undefined
  onValueChange: (val: string | null) => void
  disabled?: boolean
}) {
  const selectValue = !value || value === 'Pré-fixado' || value === 'none' ? 'none' : value
  return (
    <Select
      value={selectValue}
      onValueChange={(val) => onValueChange(val === 'none' ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione o indexador" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Pré-fixado (Sem Indexador)</SelectItem>
        <SelectItem value="CDI">CDI</SelectItem>
        <SelectItem value="IPCA">IPCA</SelectItem>
        <SelectItem value="IGP-M">IGP-M</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function EscrituraSelect({
  value,
  onValueChange,
  disabled,
}: {
  value?: string | null
  onValueChange: (val: string, obj: any) => void
  disabled?: boolean
}) {
  const [debentures, setDebentures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchDebentures = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('debentures')
        .select(
          'id, issuer_name, issue_date, total_volume, created_at, series:debenture_series(volume)',
        )
        .order('created_at', { ascending: false })
      if (mounted && data) {
        setDebentures(data)
        if (value) {
          const selectedObj = data.find((d) => d.id === value)
          if (selectedObj) {
            onValueChange(value, selectedObj)
          }
        }
      }
      if (mounted) setLoading(false)
    }
    fetchDebentures()
    return () => {
      mounted = false
    }
  }, []) // Empty dependency array ensures it only fetches once

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => {
        const obj = debentures.find((d) => d.id === val)
        onValueChange(val, obj)
      }}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione a escritura'} />
      </SelectTrigger>
      <SelectContent>
        {debentures.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.issuer_name}{' '}
            {d.issue_date ? `(${formatDate(d.issue_date)})` : `(${formatDate(d.created_at)})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
