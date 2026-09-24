import { supabase } from '@/lib/supabase/client'

export interface CreditManager {
  id: string
  full_name: string
  cpf: string
  phone: string | null
  email: string | null
  commission_anticipation_pct: number
  commission_ccb_pct: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface CreditManagerFormData {
  full_name: string
  cpf: string
  phone?: string | null
  email?: string | null
  commission_anticipation_pct: number
  commission_ccb_pct: number
  is_active: boolean
}

export interface ManagerCommissionItem {
  operationId: string
  operationType: 'antecipacao' | 'ccb'
  contractOrIdentifier: string
  operationDate: string
  clientName: string
  faceValue: number
  paidValue: number
  discountValue: number
  commissionRatePct: number
  commissionAmount: number
  status: string
}

export interface ManagerCommissionSummary {
  manager: CreditManager
  totalOperations: number
  anticipationsCount: number
  ccbsCount: number
  totalDiscount: number
  anticipationsDiscount: number
  ccbDiscount: number
  totalCommission: number
  items: ManagerCommissionItem[]
}

/**
 * Busca todos os gerentes de crédito cadastrados.
 */
export async function fetchCreditManagers(activeOnly: boolean = false): Promise<CreditManager[]> {
  let query = (supabase as any)
    .from('credit_managers')
    .select('*')
    .order('full_name', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    console.error('Erro ao buscar gerentes de crédito:', error)
    throw error
  }
  return (data || []) as CreditManager[]
}

/**
 * Cria um novo gerente de crédito.
 */
export async function createCreditManager(formData: CreditManagerFormData): Promise<CreditManager> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await (supabase as any)
    .from('credit_managers')
    .insert({
      full_name: formData.full_name.trim(),
      cpf: formData.cpf.trim(),
      phone: formData.phone?.trim() || null,
      email: formData.email?.trim() || null,
      commission_anticipation_pct: Number(formData.commission_anticipation_pct) || 0,
      commission_ccb_pct: Number(formData.commission_ccb_pct) || 0,
      is_active: formData.is_active ?? true,
      created_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao cadastrar gerente de crédito:', error)
    throw error
  }
  return data as CreditManager
}

/**
 * Atualiza um gerente de crédito existente.
 */
export async function updateCreditManager(
  id: string,
  formData: Partial<CreditManagerFormData>,
): Promise<CreditManager> {
  const payload: any = {
    updated_at: new Date().toISOString(),
  }

  if (formData.full_name !== undefined) payload.full_name = formData.full_name.trim()
  if (formData.cpf !== undefined) payload.cpf = formData.cpf.trim()
  if (formData.phone !== undefined) payload.phone = formData.phone?.trim() || null
  if (formData.email !== undefined) payload.email = formData.email?.trim() || null
  if (formData.commission_anticipation_pct !== undefined) {
    payload.commission_anticipation_pct = Number(formData.commission_anticipation_pct) || 0
  }
  if (formData.commission_ccb_pct !== undefined) {
    payload.commission_ccb_pct = Number(formData.commission_ccb_pct) || 0
  }
  if (formData.is_active !== undefined) payload.is_active = formData.is_active

  const { data, error } = await (supabase as any)
    .from('credit_managers')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar gerente de crédito:', error)
    throw error
  }
  return data as CreditManager
}

/**
 * Alterna status de ativação do gerente.
 */
export async function toggleCreditManagerActive(
  id: string,
  currentStatus: boolean,
): Promise<boolean> {
  const newStatus = !currentStatus
  const { error } = await (supabase as any)
    .from('credit_managers')
    .update({ is_active: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Erro ao alterar status do gerente:', error)
    throw error
  }
  return newStatus
}

/**
 * Calcula o painel de comissões por competência (YYYY-MM).
 * Segue o padrão de apuração de operações do período:
 * - Antecipações (credit_operations): issue_date na competência, não canceladas/reprovadas/excluídas
 * - CCBs (recebiveis_ccb): created_at na competência, não canceladas/excluídas
 * - Apenas operações com manager_id vinculado
 * - Deságio da operação × % de comissão do gerente para o tipo
 */
export async function fetchCommissionsForPeriod(
  selectedMonth: string, // YYYY-MM
): Promise<{
  summaries: ManagerCommissionSummary[]
  unassignedTotals: { count: number; discount: number }
  grandTotals: { operationsCount: number; totalDiscount: number; totalCommission: number }
}> {
  // 1. Buscar todos os gerentes
  const managers = await fetchCreditManagers(false)
  const managerMap = new Map<string, CreditManager>()
  managers.forEach((m) => managerMap.set(m.id, m))

  // 2. Buscar operações de antecipação com manager_id e cálculos
  const { data: creditOpsData, error: opsErr } = await (supabase.from('credit_operations') as any)
    .select(`
      id,
      document_number,
      receivable_type,
      receivable_type_other,
      cedente,
      sacado,
      face_value,
      requested_value,
      issue_date,
      status,
      manager_id,
      profiles!credit_operations_borrower_id_fkey ( full_name, pj_company_name ),
      operation_calculations (
        net_value,
        total_discounts
      )
    `)
    .not('status', 'in', '("cancelado","excluido","reprovado")')

  if (opsErr) throw opsErr

  // 3. Buscar operações de CCB com manager_id
  const { data: ccbData, error: ccbErr } = await (supabase.from('recebiveis_ccb') as any)
    .select(`
      id,
      acquisition_value,
      boleto_count,
      boleto_unit_value,
      gross_profit,
      status,
      created_at,
      manager_id,
      ccb_solicitacoes (
        id,
        borrower_data
      ),
      profiles!recebiveis_ccb_tomador_id_fkey ( full_name, pj_company_name )
    `)
    .not('status', 'in', '("cancelado","excluido","Cancelado","Excluído")')

  if (ccbErr) throw ccbErr

  // Filtrar pela competência (YYYY-MM)
  const periodCreditOps = (creditOpsData || []).filter((op: any) => {
    if (!op.issue_date) return false
    return String(op.issue_date).substring(0, 7) === selectedMonth
  })

  const periodCcbOps = (ccbData || []).filter((c: any) => {
    if (!c.created_at) return false
    return String(c.created_at).substring(0, 7) === selectedMonth
  })

  // Agrupamento por gerente
  const managerSummariesMap = new Map<string, ManagerCommissionSummary>()

  managers.forEach((m) => {
    managerSummariesMap.set(m.id, {
      manager: m,
      totalOperations: 0,
      anticipationsCount: 0,
      ccbsCount: 0,
      totalDiscount: 0,
      anticipationsDiscount: 0,
      ccbDiscount: 0,
      totalCommission: 0,
      items: [],
    })
  })

  let unassignedCount = 0
  let unassignedDiscount = 0

  // Processar antecipações do período
  for (const op of periodCreditOps) {
    const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles
    const calc = Array.isArray(op.operation_calculations)
      ? op.operation_calculations[0]
      : op.operation_calculations

    const faceVal = Number(op.face_value || 0)
    const paidVal = Number(calc?.net_value ?? op.requested_value ?? faceVal)
    const discountVal = Number(calc?.total_discounts ?? Math.max(0, faceVal - paidVal))

    const clientName = prof?.pj_company_name || prof?.full_name || op.cedente || 'Não informado'
    const identifier = op.document_number || `OP-${op.id.substring(0, 8).toUpperCase()}`

    if (!op.manager_id || !managerMap.has(op.manager_id)) {
      unassignedCount++
      unassignedDiscount += discountVal
      continue
    }

    const mgr = managerMap.get(op.manager_id)!
    const ratePct = Number(mgr.commission_anticipation_pct || 0)
    const commAmount = (discountVal * ratePct) / 100

    const summary = managerSummariesMap.get(mgr.id)!
    summary.totalOperations += 1
    summary.anticipationsCount += 1
    summary.totalDiscount += discountVal
    summary.anticipationsDiscount += discountVal
    summary.totalCommission += commAmount
    summary.items.push({
      operationId: op.id,
      operationType: 'antecipacao',
      contractOrIdentifier: identifier,
      operationDate: op.issue_date,
      clientName,
      faceValue: faceVal,
      paidValue: paidVal,
      discountValue: discountVal,
      commissionRatePct: ratePct,
      commissionAmount: commAmount,
      status: op.status,
    })
  }

  // Processar CCBs do período
  for (const rec of periodCcbOps) {
    const prof = Array.isArray(rec.profiles) ? rec.profiles[0] : rec.profiles
    const ccbSol = Array.isArray(rec.ccb_solicitacoes)
      ? rec.ccb_solicitacoes[0]
      : rec.ccb_solicitacoes

    const count = Number(rec.boleto_count || 0)
    const unitVal = Number(rec.boleto_unit_value || 0)
    const faceVal = count * unitVal
    const paidVal = Number(rec.acquisition_value || 0)
    const discountVal = Number(rec.gross_profit ?? Math.max(0, faceVal - paidVal))

    const clientName =
      prof?.pj_company_name || prof?.full_name || ccbSol?.borrower_data?.name || 'Não informado'
    const identifier = ccbSol?.id
      ? `CCB-${ccbSol.id.substring(0, 8).toUpperCase()}`
      : `AQC-${rec.id.substring(0, 8).toUpperCase()}`
    const rawDate = rec.created_at ? rec.created_at.split('T')[0] : ''

    if (!rec.manager_id || !managerMap.has(rec.manager_id)) {
      unassignedCount++
      unassignedDiscount += discountVal
      continue
    }

    const mgr = managerMap.get(rec.manager_id)!
    const ratePct = Number(mgr.commission_ccb_pct || 0)
    const commAmount = (discountVal * ratePct) / 100

    const summary = managerSummariesMap.get(mgr.id)!
    summary.totalOperations += 1
    summary.ccbsCount += 1
    summary.totalDiscount += discountVal
    summary.ccbDiscount += discountVal
    summary.totalCommission += commAmount
    summary.items.push({
      operationId: rec.id,
      operationType: 'ccb',
      contractOrIdentifier: identifier,
      operationDate: rawDate,
      clientName,
      faceValue: faceVal,
      paidValue: paidVal,
      discountValue: discountVal,
      commissionRatePct: ratePct,
      commissionAmount: commAmount,
      status: rec.status,
    })
  }

  const summaries = Array.from(managerSummariesMap.values())

  let grandOps = 0
  let grandDiscount = 0
  let grandCommission = 0

  summaries.forEach((s) => {
    grandOps += s.totalOperations
    grandDiscount += s.totalDiscount
    grandCommission += s.totalCommission
  })

  return {
    summaries,
    unassignedTotals: {
      count: unassignedCount,
      discount: unassignedDiscount,
    },
    grandTotals: {
      operationsCount: grandOps,
      totalDiscount: grandDiscount,
      totalCommission: grandCommission,
    },
  }
}
