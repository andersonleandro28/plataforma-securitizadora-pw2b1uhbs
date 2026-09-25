import { useState, useEffect, useCallback } from 'react'
import {
  CompanySettings,
  CompanySettingsFormData,
  DEFAULT_COMPANY_SETTINGS,
  getCompanySettings,
  saveCompanySettings,
  buildSecuritizadoraPreambulo,
  formatCompanyAddress,
} from '@/services/company-settings'

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCompanySettings(forceRefresh)
      setSettings(data)
    } catch (err: any) {
      console.error('useCompanySettings error:', err)
      setError(err.message || 'Erro ao carregar dados da securitizadora')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (formData: CompanySettingsFormData) => {
    const updated = await saveCompanySettings(formData)
    setSettings(updated)
    return updated
  }

  const preambulo = (papel?: 'CESSIONÁRIA' | 'EMISSORA' | 'SECURITIZADORA' | 'CREDORA') => {
    return buildSecuritizadoraPreambulo(settings, papel)
  }

  const fullAddress = formatCompanyAddress(settings)

  return {
    settings,
    loading,
    error,
    refresh: () => fetchSettings(true),
    updateSettings,
    preambulo,
    fullAddress,
  }
}
