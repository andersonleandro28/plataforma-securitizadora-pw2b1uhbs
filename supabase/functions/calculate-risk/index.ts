import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { operation_id, sacado_document } = await req.json()
    if (!operation_id) throw new Error('operation_id is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch operation
    const { data: op, error: opErr } = await supabase
      .from('credit_operations')
      .select('*')
      .eq('id', operation_id)
      .single()
    if (opErr || !op) throw new Error('Operation not found')

    // Fetch total portfolio value (excluding reprovado/cancelado) to calculate concentration
    const { data: allOps } = await supabase
      .from('credit_operations')
      .select('sacado, requested_value')
      .in('status', ['aprovado', 'pago', 'em_analise', 'em_triagem', 'aguardando_formalizacao'])

    let totalPortfolio = 0
    let sacadoTotal = 0
    const sacadoName = op.sacado

    if (allOps) {
      allOps.forEach((o: any) => {
        const val = Number(o.requested_value || 0)
        totalPortfolio += val
        if (o.sacado === sacadoName) {
          sacadoTotal += val
        }
      })
    }

    // Add current op if not already in the list
    if (!allOps?.find((o: any) => o.id === operation_id)) {
      totalPortfolio += Number(op.requested_value || 0)
      sacadoTotal += Number(op.requested_value || 0)
    }

    const concentration = totalPortfolio > 0 ? (sacadoTotal / totalPortfolio) * 100 : 0

    // Fetch Serasa Score (Call internal integration function)
    const document = sacado_document || op.document_number
    const serasaRes = await fetch(`${supabaseUrl}/functions/v1/serasa-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ document }),
    })

    if (!serasaRes.ok) {
      throw new Error(`Failed to call Serasa Integration: ${await serasaRes.text()}`)
    }

    const serasaJson = await serasaRes.json()
    const serasaData = serasaJson.data
    if (!serasaData) throw new Error('Could not fetch Serasa data')

    const serasa_score = serasaData.score || 0
    const bankruptcies = serasaData.bankruptcies || 0
    const negativeValue = serasaData.negativeRecordsValue || 0

    // Calculate Term Days
    const due = new Date(op.due_date)
    const now = new Date()
    const termDays = Math.max(
      0,
      Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    )

    // SIO Calculation (Score Interno de Operação)
    let sio = 0
    const triggers: string[] = []
    let isHardRule = false

    // 1. Serasa Score (Peso 50%)
    if (serasa_score > 700) sio += 50
    else if (serasa_score >= 500) sio += 35
    else if (serasa_score >= 300) sio += 20
    else sio += 0

    // 2. Apontamentos (Peso 20%)
    if (bankruptcies > 0) {
      triggers.push('Recuperação Judicial / Falência detectada.')
      isHardRule = true
    } else if (negativeValue > 1000) {
      triggers.push(
        `Protestos/PEFIN > R$ 1.000 (Encontrado: R$ ${negativeValue.toLocaleString('pt-BR')})`,
      )
    } else {
      sio += 20
    }

    // 3. Prazo (Peso 15%)
    if (termDays <= 30) sio += 15
    else if (termDays <= 60) sio += 9
    else sio += 3

    if (termDays > 60) triggers.push(`Prazo alongado (${termDays} dias)`)

    // 4. Concentração (Peso 15%)
    if (concentration > 15) {
      triggers.push(`Concentração no Sacado excede 15% (Atual: ${concentration.toFixed(1)}%)`)
    } else {
      sio += 15
    }

    // Check Hard Rules
    if (serasa_score < 200) {
      triggers.push(`Score Serasa crítico (< 200)`)
      isHardRule = true
    }

    let suggestion = ''

    if (isHardRule) {
      suggestion = 'Reprovação Sugerida'
      // Auto-reprove action
      const { error: updErr } = await supabase
        .from('credit_operations')
        .update({ status: 'reprovado' })
        .eq('id', operation_id)
      if (updErr) console.error('Error auto reproving:', updErr)
      triggers.push('Operação Reprovada Automaticamente (Hard Rule)')
    } else if (sio < 50) {
      suggestion = 'Reprovação Sugerida'
    } else if (sio < 80) {
      suggestion = 'Análise Manual'
      triggers.push('Risco Moderado')
    } else {
      suggestion = 'Aprovação Sugerida'
    }

    // Identify user caller for audit trail
    const authHeader = req.headers.get('Authorization')
    let userId = null
    if (authHeader) {
      const client = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userResp } = await client.auth.getUser()
      if (userResp?.user) userId = userResp.user.id
    }

    // Insert into risk_analysis_history
    const { data: riskRecord, error: riskErr } = await supabase
      .from('risk_analysis_history')
      .insert({
        operation_id,
        serasa_score,
        sio_score: sio,
        risk_level: suggestion,
        triggers: triggers,
        raw_serasa_data: serasaData,
        created_by: userId,
      })
      .select()
      .single()

    if (riskErr) throw riskErr

    return new Response(JSON.stringify({ success: true, data: riskRecord }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
