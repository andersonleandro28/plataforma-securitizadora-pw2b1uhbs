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
    let defaultParams =
      paramsData?.find((p: any) => p.receivable_type === opData.receivable_type) ||
      paramsData?.find((p: any) => p.receivable_type === 'global') ||
      {}

    // Check if operation already has customized applied_params saved in its calculation_memory
    let existingAppliedParams: any = null
    if (operation_id) {
      const { data: existingCalc } = await supabase
        .from('operation_calculations')
        .select('calculation_memory')
        .eq('operation_id', operation_id)
        .maybeSingle()

      if (existingCalc?.calculation_memory?.applied_params) {
        existingAppliedParams = existingCalc.calculation_memory.applied_params
      }
    }

    let params = { ...defaultParams, ...(existingAppliedParams || {}) }

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

    const parseLocalDate = (dateVal: string | Date | undefined | null) => {
      if (!dateVal) return null
      if (dateVal instanceof Date) {
        const d = new Date(dateVal.getTime())
        d.setHours(0, 0, 0, 0)
        return d
      }
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

    let startDateObj: Date = new Date()
    startDateObj.setHours(0, 0, 0, 0)
    if (baseDateRaw) {
      const parsedBase = parseLocalDate(baseDateRaw)
      if (parsedBase) {
        startDateObj = parsedBase
      }
    }

    let dueDateObj: Date | null = null
    let fallbackTermDays = 0
    if (dueDateRaw) {
      dueDateObj = parseLocalDate(dueDateRaw)
      if (dueDateObj) {
        fallbackTermDays = Math.max(
          0,
          Math.round((dueDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)),
        )
      }
    }

    // Verificar se há cronograma de parcelas individuais fornecido
    // Pode vir em: opData.installments_data, opData.installmentsList, opData.installmentsData
    const rawInstallments =
      opData.installments_data || opData.installmentsData || opData.installmentsList || []

    const hasMultipleInstallments =
      Array.isArray(rawInstallments) &&
      rawInstallments.length > 1 &&
      rawInstallments.some(
        (i: any) => (i.dueDate || i.due_date) && parseLocalDate(i.dueDate || i.due_date) !== null,
      )

    let discount_val = 0
    let interest_val = 0
    let iof_daily_val = 0
    let termDays = fallbackTermDays
    let installmentsBreakdown: any[] | null = null

    if (hasMultipleInstallments) {
      const validInstallmentItems = rawInstallments
        .map((inst: any, idx: number) => {
          const instDueRaw = inst.dueDate || inst.due_date || dueDateRaw
          const instDueObj = parseLocalDate(instDueRaw)
          const instDays = instDueObj
            ? Math.max(
                0,
                Math.round((instDueObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)),
              )
            : fallbackTermDays

          const instNum = Number(inst.number || idx + 1)
          const rawInstVal = inst.value != null && inst.value !== '' ? Number(inst.value) : null

          return {
            number: instNum,
            dueDate: instDueObj ? instDueObj.toISOString().split('T')[0] : null,
            termDays: instDays,
            declaredValue: rawInstVal,
          }
        })
        .filter((i: any) => i.dueDate !== null)

      const count = validInstallmentItems.length

      // Rateio do valor de face por parcela
      // Se a soma dos valores informados bater com o faceValue (ou estiver preenchida), usa o valor informado.
      // Se não, divide faceValue igualmente entre as parcelas.
      const sumDeclaredFace = validInstallmentItems.reduce(
        (acc: number, curr: any) => acc + (curr.declaredValue || 0),
        0,
      )
      const useDeclared =
        validInstallmentItems.every(
          (i: any) => typeof i.declaredValue === 'number' && i.declaredValue > 0,
        ) && sumDeclaredFace > 0

      // Proporção de valor solicitado em relação ao valor de face (ex: 100% ou 90%)
      const reqToFaceRatio = faceValue > 0 ? reqValue / faceValue : count > 0 ? 1 / count : 1

      let totalWeightedDaysFace = 0
      let totalFaceAllocated = 0

      installmentsBreakdown = validInstallmentItems.map((item: any) => {
        const instFace = useDeclared
          ? (item.declaredValue as number)
          : count > 0
            ? faceValue / count
            : 0
        const instReq = instFace * reqToFaceRatio

        totalFaceAllocated += instFace
        totalWeightedDaysFace += instFace * item.termDays

        // Parcela juros = instReq * (TJM / 30) * instDays
        const instInterest = instReq * (interest_rate / 100 / 30) * item.termDays

        // Parcela deságio = instFace * (TDM / 30) * instDays
        const instDiscount = instFace * (discount_rate / 100 / 30) * item.termDays

        // Parcela IOF diário = instReq * taxa IOF diária * instDays
        const instIofDaily = instReq * (iof_daily_rate / 100) * item.termDays

        return {
          number: item.number,
          dueDate: item.dueDate,
          termDays: item.termDays,
          faceValue: instFace,
          requestedValue: instReq,
          discount_val: instDiscount,
          interest_val: instInterest,
          iof_daily_val: instIofDaily,
        }
      })

      // Soma consolidada de todas as parcelas
      discount_val = installmentsBreakdown.reduce((acc, c) => acc + c.discount_val, 0)
      interest_val = installmentsBreakdown.reduce((acc, c) => acc + c.interest_val, 0)
      iof_daily_val = installmentsBreakdown.reduce((acc, c) => acc + c.iof_daily_val, 0)

      // Prazo médio ponderado pelo valor de face para exibição clara de prazo médio
      const weightedAverageTermDays =
        totalFaceAllocated > 0
          ? Math.round(totalWeightedDaysFace / totalFaceAllocated)
          : fallbackTermDays

      // Se não havia dueDate geral ou se quisermos o prazo médio/último vencimento:
      termDays = weightedAverageTermDays

      // Atualiza dueDateObj para o último vencimento caso não houvesse dueDate geral
      if (!dueDateObj && validInstallmentItems.length > 0) {
        const lastInst = validInstallmentItems[validInstallmentItems.length - 1]
        if (lastInst.dueDate) {
          dueDateObj = parseLocalDate(lastInst.dueDate)
        }
      }
    } else {
      // 1 Parcela ou sem vencimentos individuais: Comportamento tradicional existente
      discount_val = faceValue * (discount_rate / 100 / 30) * termDays
      interest_val = reqValue * (interest_rate / 100 / 30) * termDays
      iof_daily_val = reqValue * (iof_daily_rate / 100) * termDays
    }

    // FORMULA IMPLEMENTATION (TAXAS INDEPENDENTES DE PRAZO POR PARCELA)
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
      isInstallmentCalculation: hasMultipleInstallments,
      installmentsBreakdown,
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
