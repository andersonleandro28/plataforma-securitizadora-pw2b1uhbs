import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { onlyDigits } from '@/lib/cpf-cnpj'

export interface KnownSacado {
  name: string
  document: string
  cleanDocument: string
  email: string
  phone: string
  source: 'credit_operations' | 'profiles'
  lastUsedAt?: string
}

/** Normaliza strings para busca sem acentos e em minúsculas */
export const normalizeText = (text: string = ''): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export function useSacadoSuggestions() {
  const [knownSacados, setKnownSacados] = useState<KnownSacado[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const loadKnownSacados = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Buscar histórico de sacados em credit_operations (mais recente primeiro)
      const { data: operations, error: opError } = await supabase
        .from('credit_operations')
        .select('sacado, sacado_document, sacado_email, sacado_phone, created_at')
        .order('created_at', { ascending: false })
        .limit(300)

      if (opError) {
        console.warn('Erro ao carregar sacados de credit_operations:', opError)
      }

      // 2. Buscar clientes/perfis da base para complementar
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select(
          'full_name, pj_company_name, pj_trade_name, document_number, email, phone, created_at',
        )
        .not('document_number', 'is', null)
        .limit(200)

      if (profError) {
        console.warn('Erro ao carregar perfis para sacados:', profError)
      }

      const mapByDoc = new Map<string, KnownSacado>()
      const mapByName = new Map<string, KnownSacado>()

      // Preenche primeiro com credit_operations (pois reflete exatamente os sacados de operações anteriores)
      if (operations) {
        for (const op of operations) {
          const name = (op.sacado || '').trim()
          const doc = (op.sacado_document || '').trim()
          const cleanDoc = onlyDigits(doc)
          const email = (op.sacado_email || '').trim()
          const phone = (op.sacado_phone || '').trim()

          if (!name && !cleanDoc) continue

          const item: KnownSacado = {
            name: name || doc,
            document: doc,
            cleanDocument: cleanDoc,
            email,
            phone,
            source: 'credit_operations',
            lastUsedAt: op.created_at,
          }

          if (cleanDoc && !mapByDoc.has(cleanDoc)) {
            mapByDoc.set(cleanDoc, item)
          }

          const normName = normalizeText(name)
          if (normName && !mapByName.has(normName)) {
            mapByName.set(normName, item)
          }
        }
      }

      // Complementa com perfis se não estiver no mapa
      if (profiles) {
        for (const prof of profiles) {
          const name = (prof.pj_company_name || prof.pj_trade_name || prof.full_name || '').trim()
          const doc = (prof.document_number || '').trim()
          const cleanDoc = onlyDigits(doc)
          const email = (prof.email || '').trim()
          const phone = (prof.phone || '').trim()

          if (!name && !cleanDoc) continue

          const item: KnownSacado = {
            name: name || doc,
            document: doc,
            cleanDocument: cleanDoc,
            email,
            phone,
            source: 'profiles',
            lastUsedAt: prof.created_at,
          }

          if (cleanDoc && !mapByDoc.has(cleanDoc)) {
            mapByDoc.set(cleanDoc, item)
          }

          const normName = normalizeText(name)
          if (normName && !mapByName.has(normName)) {
            mapByName.set(normName, item)
          }
        }
      }

      // Lista única consolidada
      const allUnique = Array.from(
        new Map(
          [...Array.from(mapByDoc.values()), ...Array.from(mapByName.values())].map((item) => [
            item.cleanDocument ? `doc:${item.cleanDocument}` : `name:${normalizeText(item.name)}`,
            item,
          ]),
        ).values(),
      )

      setKnownSacados(allUnique)
    } catch (err) {
      console.error('Falha ao processar sugestões de sacados:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKnownSacados()
  }, [loadKnownSacados])

  /** Busca por documento exato (normalizado sem pontuação, CPF com 11 dígitos ou CNPJ com 14 dígitos) */
  const findByExactDocument = useCallback(
    (inputDoc: string): KnownSacado | null => {
      const clean = onlyDigits(inputDoc)
      if (!clean || (clean.length !== 11 && clean.length !== 14)) return null
      return knownSacados.find((s) => s.cleanDocument === clean) || null
    },
    [knownSacados],
  )

  /** Busca por nome exato (normalizado sem acentos e case-insensitive) */
  const findByExactName = useCallback(
    (inputName: string): KnownSacado | null => {
      const norm = normalizeText(inputName)
      if (!norm || norm.length < 3) return null
      return knownSacados.find((s) => normalizeText(s.name) === norm) || null
    },
    [knownSacados],
  )

  /**
   * Filtra sugestões para autocompletion baseado no texto digitado (busca em nome ou documento).
   * Retorna até 6 sugestões mais relevantes.
   */
  const searchSuggestions = useCallback(
    (query: string): KnownSacado[] => {
      const trimmed = query.trim()
      if (!trimmed || trimmed.length < 2) return []

      const norm = normalizeText(trimmed)
      const clean = onlyDigits(trimmed)

      return knownSacados
        .filter((item) => {
          const matchName = normalizeText(item.name).includes(norm)
          const matchDoc = clean.length >= 2 && item.cleanDocument.includes(clean)
          return matchName || matchDoc
        })
        .slice(0, 6)
    },
    [knownSacados],
  )

  return {
    knownSacados,
    loading,
    findByExactDocument,
    findByExactName,
    searchSuggestions,
    reload: loadKnownSacados,
  }
}
