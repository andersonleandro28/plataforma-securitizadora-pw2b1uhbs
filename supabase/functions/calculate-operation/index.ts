import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { operation_id, simulate_data, override_params } = await req.json()

    let opData = simulate_data
    if (operation_id && !simulate_data) {
      const { data, error } = await supabase
        .from('credit_operations')
        .select('*')
        .eq('id', operation_id)
        .single()
      if (error) throw error
      opData = data
    }

    if (!opData) throw new Error('No operation data provided')

    // Fetch parameters - Priority for specific asset type, fallback to global
    const { data: paramsData } = await supabase.from('financial_parameters').select('*')
    let params =
      paramsData?.find((p: any) => p.receivable_type === opData.receivable_type) ||
      paramsData?.find((p: any) => p.receivable_type === 'global') ||
      {}

    if (override_params) {
      params = { ...params, ...override_params }
    }

    // Requested Formula Mappings
    const discount_rate = Number(params.discount_rate_monthly || 0)
    const interest_rate = Number(params.interest_rate_monthly || 0)
    const ad_valorem_rate = Number(params.ad_valorem_rate || 0)
    const structuring_fee = Number(params.structuring_fee || 0)
    const analysis_fee = Number(params.analysis_fee || 0)

    // Fallbacks specific to the prompt requirements if DB is empty
    const iof_fixed_rate = Number(params.iof_fixed_rate) || 0.38
    const iof_daily_rate = Number(params.iof_daily_rate) || 0.0041

    const faceValue = Number(opData.face_value || opData.faceValue || 0)
    const reqValue = Number(opData.requested_value || opData.requestedValue || 0)

    // Base date for interest/term calculation:
    // If a base_date / issue_date / issueDate is provided (e.g. retroactive operation),
    // calculate the term from this base date up to the due date.
    // If none is provided, default to current date (today) preserving existing behavior.
    const parseLocalDate = (dateVal: string | Date | undefined | null) => {
      if (!dateVal) return null
      if (dateVal instanceof Date) {
        const d = new Date(dateVal.getTime())
        d.setHours(0, 0, 0, 0)
        return d
      }
      // If "YYYY-MM-DD"
      if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const [y, m, d] = dateVal.split('-').map(Number)
        return new Date(y, m - 1, d, 0, 0, 0, 0)
      }
      const d = new Date(dateVal)
      d.setHours(0, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }

    const dueDateRaw = opData.due_date || opData.dueDate
    const baseDateRaw = opData.base_date || opData.baseDate || opData.issue_date || opData.issueDate

    let termDays = 0
    let startDateObj: Date = new Date()
    startDateObj.setHours(0, 0, 0, 0)

    if (baseDateRaw) {
      const parsedBase = parseLocalDate(baseDateRaw)
      if (parsedBase) {
        startDateObj = parsedBase
      }
    }

    let dueDateObj: Date | null = null
    if (dueDateRaw) {
      dueDateObj = parseLocalDate(dueDateRaw)
      if (dueDateObj) {
        termDays = Math.max(
          0,
          Math.round((dueDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)),
        )
      }
    }

    // FORMULA IMPLEMENTATION
    // Deságio Proporcional = VF * (TDM / 30) * P
    const discount_val = faceValue * (discount_rate / 100 / 30) * termDays

    // Juros Proporcionais = VS * (TJM / 30) * P
    const interest_val = reqValue * (interest_rate / 100 / 30) * termDays

    // Custo Ad Valorem = VF * TAV (Always based on Face Value as requested)
    const ad_valorem_val = faceValue * (ad_valorem_rate / 100)

    // Custo Estruturação = VS * TE (Assume Structuring is percentage applied to requested value)
    const structuring_val =
      params.structuring_fee_type === 'fixed' ? structuring_fee : reqValue * (structuring_fee / 100)

    // Taxa de Análise (TA) - Valor Fixo
    const analysis_val =
      params.analysis_fee_type === 'percentage' ? reqValue * (analysis_fee / 100) : analysis_fee

    // IOF Fixo = VS * taxa IOF fixa
    const iof_fixed_val = reqValue * (iof_fixed_rate / 100)

    // IOF Diário = VS * taxa IOF diária * P
    const iof_daily_val = reqValue * (iof_daily_rate / 100) * termDays

    // Total Descontos = [Deságio + Juros + Ad Valorem + Estruturação + TA + IOF]
    const total_discounts =
      discount_val +
      interest_val +
      ad_valorem_val +
      structuring_val +
      analysis_val +
      iof_daily_val +
      iof_fixed_val

    // Valor Líquido = VS - Total Descontos
    const net_value = reqValue - total_discounts

    // Custo Efetivo (CET) = Total Descontos / VS
    const effective_cost = reqValue > 0 ? (total_discounts / reqValue) * 100 : 0

    const memory = {
      termDays,
      startDate: startDateObj.toISOString().split('T')[0],
      dueDate: dueDateObj ? dueDateObj.toISOString().split('T')[0] : null,
      discount_val,
      interest_val,
      ad_valorem_val,
      structuring_val,
      analysis_val,
      iof_daily_val,
      iof_fixed_val,
      total_discounts,
      net_value,
      effective_cost,
      applied_params: params,
    }

    if (simulate_data) {
      return new Response(JSON.stringify({ success: true, data: memory }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (operation_id) {
      const { data: calc, error: calcErr } = await supabase
        .from('operation_calculations')
        .upsert(
          {
            operation_id,
            term_days: termDays,
            discount_value: discount_val,
            interest_value: interest_val,
            ad_valorem_value: ad_valorem_val,
            structuring_value: structuring_val,
            analysis_value: analysis_val,
            iof_fixed_value: iof_fixed_val,
            iof_daily_value: iof_daily_val,
            total_discounts: total_discounts,
            net_value: net_value,
            effective_cost_rate: effective_cost,
            calculation_memory: memory,
          },
          { onConflict: 'operation_id' },
        )
        .select()
        .single()

      if (calcErr) throw calcErr

      return new Response(JSON.stringify({ success: true, data: calc }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid request')
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
