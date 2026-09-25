import {
  CompanySettings,
  formatCompanyAddress,
  buildSecuritizadoraPreambulo,
} from '@/services/company-settings'
import { ManagerCommissionSummary } from '@/services/credit-managers'
import { maskCpf, maskCnpj } from '@/lib/cpf-cnpj'

export interface PrintManagerReceiptOptions {
  summary: ManagerCommissionSummary
  periodMonth: string // YYYY-MM
  settings?: CompanySettings | null
  bankAccountLabel?: string
  paymentDate?: string
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

function formatMonthCompetence(periodMonth: string): string {
  if (!periodMonth) return '—'
  const [year, month] = periodMonth.split('-')
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' })
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year} (${month}/${year})`
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('pt-BR')
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

export function generateManagerReceiptHtml(options: PrintManagerReceiptOptions): string {
  const { summary, periodMonth, settings, bankAccountLabel, paymentDate } = options
  const mgr = summary.manager
  const compLabel = formatMonthCompetence(periodMonth)
  const dateFormatted = formatDateDisplay(paymentDate || summary.paymentDetails?.paidAt)
  const amountFormatted = formatCurrency(summary.paymentDetails?.amount ?? summary.totalCommission)

  const razaoSocial = settings?.razao_social || 'NEXUM SECURITIZADORA S.A.'
  const nomeFantasia = settings?.nome_fantasia || 'Nexum Security 360º'
  const cnpjFmt = settings?.cnpj ? maskCnpj(settings.cnpj) : '—'
  const enderecoFmt = settings ? formatCompanyAddress(settings) : 'São Paulo - SP | Brasil'
  const telEmail =
    [settings?.telefone, settings?.email].filter(Boolean).join(' | ') || 'contato@empresa.com.br'

  const repNome = settings?.representante_nome || 'Anderson Leandro'
  const repCargo = settings?.representante_cargo || 'Diretor-Presidente'
  const repCpf = settings?.representante_cpf ? maskCpf(settings.representante_cpf) : '—'

  const preambuloEmpresa = buildSecuritizadoraPreambulo(settings, 'SECURITIZADORA')

  const itemsRows = summary.items
    .map(
      (it, idx) => `
      <tr>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 500;">${it.contractOrIdentifier}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${it.operationType === 'antecipacao' ? 'Antecipação de Recebíveis' : 'Aquisição de CCB'}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${it.clientName || '—'}</td>
        <td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${formatCurrency(it.faceValue)}</td>
        <td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${formatCurrency(it.discountValue)}</td>
        <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace;">${it.commissionRatePct}%</td>
        <td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-family: monospace; font-weight: 600; color: #047857;">${formatCurrency(it.commissionAmount)}</td>
      </tr>
    `,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo de Comissão — ${mgr.full_name} — ${compLabel}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 18mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-badge-title {
      font-size: 16px;
      font-weight: 800;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .doc-badge-num {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
      font-family: monospace;
    }
    .receipt-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .receipt-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1e293b;
      margin-bottom: 10px;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
    }
    .receipt-text {
      font-size: 12.5px;
      line-height: 1.7;
      text-align: justify;
      color: #1e293b;
    }
    .highlight-val {
      font-weight: 700;
      color: #047857;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 14px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 10px 12px;
      font-size: 11px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
      font-size: 11.5px;
      margin-top: 1px;
    }
    .table-container {
      margin-top: 16px;
      margin-bottom: 20px;
    }
    .table-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #334155;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 7px 8px;
      border-bottom: 1px solid #cbd5e1;
      letter-spacing: 0.02em;
    }
    .discharge-statement {
      margin-top: 16px;
      padding: 12px 14px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      font-size: 11.5px;
      line-height: 1.6;
      color: #14532d;
      text-align: justify;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 45px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      padding-top: 8px;
      border-top: 1px solid #0f172a;
    }
    .sig-name {
      font-weight: 700;
      font-size: 11.5px;
      color: #0f172a;
    }
    .sig-role {
      font-size: 10px;
      color: #475569;
    }
    .sig-doc {
      font-size: 9.5px;
      color: #64748b;
      font-family: monospace;
    }
    .footer-note {
      margin-top: 30px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <!-- Cabeçalho Institucional da Securitizadora -->
  <div class="header-box">
    <div>
      <div class="company-title">${razaoSocial}</div>
      <div class="company-sub"><strong>Nome Fantasia:</strong> ${nomeFantasia} | <strong>CNPJ:</strong> ${cnpjFmt}</div>
      <div class="company-sub">${enderecoFmt}</div>
      <div class="company-sub">${telEmail}</div>
    </div>
    <div class="doc-badge">
      <div class="doc-badge-title">Recibo de Quitação</div>
      <div class="doc-badge-num">Comissão de Gerente de Crédito</div>
      <div class="doc-badge-num">Competência: ${compLabel}</div>
    </div>
  </div>

  <!-- Preâmbulo e Corpo do Recibo -->
  <div class="receipt-card">
    <div class="receipt-title">Declaração de Pagamento e Quitação de Comissão</div>
    <div class="receipt-text">
      Pelo presente instrumento particular, a <strong>${preambuloEmpresa}</strong>, declara que efetuou nesta data o pagamento da importância líquida de <span class="highlight-val">${amountFormatted}</span> a favor do Gerente de Crédito <strong>${mgr.full_name.toUpperCase()}</strong>, inscrito no CPF sob o nº <strong>${maskCpf(mgr.cpf)}</strong>, correspondente à remuneração por comissão sobre o deságio/spread das operações de crédito originadas na competência <strong>${compLabel}</strong>.
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Gerente Credor / Beneficiário</span>
        <span class="info-value">${mgr.full_name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">CPF do Gerente</span>
        <span class="info-value" style="font-family: monospace;">${maskCpf(mgr.cpf)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Competência de Apuração</span>
        <span class="info-value">${compLabel}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data Efetiva do Pagamento</span>
        <span class="info-value">${dateFormatted}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Conta Bancária de Liquidação (Origem)</span>
        <span class="info-value">${bankAccountLabel || 'Conta Corrente Vinculada — Tesouraria'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Valor Total da Comissão Paga</span>
        <span class="info-value highlight-val" style="font-size: 13px;">${amountFormatted}</span>
      </div>
    </div>
  </div>

  <!-- Demonstrativo das Operações Vinculadas -->
  <div class="table-container">
    <div class="table-title">Demonstrativo Analítico das Operações Trazidas (${summary.totalOperations} operação/operações)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 28px; text-align: center;">#</th>
          <th style="text-align: left;">Contrato / Título</th>
          <th style="text-align: left;">Modalidade</th>
          <th style="text-align: left;">Cliente / Tomador</th>
          <th style="text-align: right;">Valor Face</th>
          <th style="text-align: right;">Deságio Spread</th>
          <th style="text-align: center;">% Comis.</th>
          <th style="text-align: right;">Comissão (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || '<tr><td colspan="8" style="text-align: center; padding: 12px; color: #94a3b8;">Nenhuma operação listada</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-weight: 700;">
          <td colspan="5" style="text-align: right; padding: 8px; text-transform: uppercase; font-size: 11px; border-top: 2px solid #cbd5e1;">Totais da Competência:</td>
          <td style="text-align: right; padding: 8px; font-family: monospace; font-size: 11px; border-top: 2px solid #cbd5e1;">${formatCurrency(summary.totalDiscount)}</td>
          <td style="text-align: center; padding: 8px; border-top: 2px solid #cbd5e1;">—</td>
          <td style="text-align: right; padding: 8px; font-family: monospace; font-size: 11.5px; color: #047857; border-top: 2px solid #cbd5e1;">${amountFormatted}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Declaração de Quitação Plena -->
  <div class="discharge-statement">
    <strong>Declaração de Quitação Plena e Geral:</strong> Mediante a liquidação financeira discriminada acima, dá-se a mais ampla, geral, rasa e irrevogável quitação de todas as comissões devidas decorrentes das operações de crédito originadas na competência <strong>${compLabel}</strong>, nada mais tendo as partes a reclamar uma da outra a este título, seja a que tempo for.
  </div>

  <!-- Assinaturas Formais -->
  <div class="signatures-grid">
    <div class="sig-box">
      <div class="sig-name">${razaoSocial}</div>
      <div class="sig-role">${repNome} — ${repCargo} (Emitente)</div>
      <div class="sig-doc">CPF: ${repCpf} | CNPJ: ${cnpjFmt}</div>
    </div>
    <div class="sig-box">
      <div class="sig-name">${mgr.full_name}</div>
      <div class="sig-role">Gerente de Crédito Originador (Beneficiário)</div>
      <div class="sig-doc">CPF: ${maskCpf(mgr.cpf)}</div>
    </div>
  </div>

  <!-- Rodapé Institucional -->
  <div class="footer-note">
    <span>${nomeFantasia} — Sistema Integrado de Gestão de Securitizadora</span>
    <span>Emissão: ${new Date().toLocaleString('pt-BR')} | Documento de Quitação Financeira</span>
  </div>
</body>
</html>`
}

export function printIsolatedManagerReceipt(options: PrintManagerReceiptOptions): void {
  const html = generateManagerReceiptHtml(options)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    window.print()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error('Erro ao acionar impressão de recibo:', err)
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 1000)
      }
    }, 250)
  }
}
