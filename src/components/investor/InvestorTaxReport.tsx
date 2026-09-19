import { useState, useMemo } from 'react'
import {
  FileText,
  Printer,
  Calendar,
  Building,
  User,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { generateAnnualTaxReport, TaxReportAnnualData } from '@/lib/tax-report-utils'
import type { ManualYieldEntry } from '@/services/manual-yield'

interface InvestorTaxReportProps {
  investorProfile: any
  investments: any[]
  redemptions: any[]
  manualYieldMap?: Record<string, ManualYieldEntry[]>
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export function InvestorTaxReport({
  investorProfile,
  investments,
  redemptions,
  manualYieldMap = {},
}: InvestorTaxReportProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>()
    yearsSet.add(currentYear)
    yearsSet.add(currentYear - 1)
    yearsSet.add(currentYear - 2)

    investments.forEach((inv) => {
      const dateStr = inv.transfer_date || inv.created_at
      if (dateStr) {
        const y = parseInt(dateStr.substring(0, 4), 10)
        if (!isNaN(y)) yearsSet.add(y)
      }
    })

    redemptions.forEach((red) => {
      const dateStr = red.updated_at || red.created_at
      if (dateStr) {
        const y = parseInt(dateStr.substring(0, 4), 10)
        if (!isNaN(y)) yearsSet.add(y)
      }
    })

    return Array.from(yearsSet).sort((a, b) => b - a)
  }, [investments, redemptions, currentYear])

  const reportData: TaxReportAnnualData = useMemo(() => {
    return generateAnnualTaxReport({
      year: selectedYear,
      investorProfile,
      investments,
      redemptions,
      manualYieldMap,
    })
  }, [selectedYear, investorProfile, investments, redemptions, manualYieldMap])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Barra Superior de Controles (oculta na impressão) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-lg border shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-md">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Informe de Rendimentos Financeiros
            </h3>
            <p className="text-xs text-muted-foreground">
              Documento consolidado para Declaração de Ajuste Anual do Imposto de Renda (DIRPF /
              DIRPJ).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Ano-Calendário:
            </span>
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handlePrint} className="gap-2 h-9 text-xs">
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL FORMATADO (visível em tela e estilizado para impressão) */}
      <Card className="shadow-md border-border/80 print:border-none print:shadow-none print:p-0">
        <CardContent className="p-6 sm:p-10 space-y-8 print:p-0">
          {/* Cabeçalho do Documento */}
          <div className="border-b pb-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                  S
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                    Nexum Security 360º
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Securitizadora S.A. • CNPJ / Cadastro Financeiro Institucional
                  </p>
                </div>
              </div>

              <div className="text-right">
                <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider">
                  Ano-Calendário {reportData.year}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Emitido em: {reportData.generatedAt}
                </p>
              </div>
            </div>

            <div className="text-center pt-2">
              <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
                Comprovante de Rendimentos Pagos e de Retenção de Imposto de Renda
              </h2>
              <p className="text-xs text-muted-foreground">
                Rendimentos de Aplicações de Renda Fixa / Debêntures / Operações Financeiras
              </p>
            </div>
          </div>

          {/* Dados das Partes: Fonte Pagadora e Beneficiário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs bg-muted/20 p-4 rounded-lg border">
            {/* Fonte Pagadora */}
            <div className="space-y-1">
              <span className="font-semibold text-foreground uppercase text-[11px] block border-b pb-1 mb-2">
                1. Fonte Pagadora da Renda
              </span>
              <div>
                <span className="text-muted-foreground">Razão Social: </span>
                <span className="font-medium text-foreground">Nexum Securitizadora S.A.</span>
              </div>
              <div>
                <span className="text-muted-foreground">Atividade: </span>
                <span className="font-medium text-foreground">
                  Securitização de Créditos e Emissão de Títulos
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Plataforma: </span>
                <span className="font-medium text-foreground">Nexum Security 360º</span>
              </div>
            </div>

            {/* Pessoa Física / Jurídica Beneficiária */}
            <div className="space-y-1">
              <span className="font-semibold text-foreground uppercase text-[11px] block border-b pb-1 mb-2">
                2. Beneficiário dos Rendimentos
              </span>
              <div>
                <span className="text-muted-foreground">Nome / Razão Social: </span>
                <span className="font-bold text-foreground">{reportData.investorName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CPF / CNPJ: </span>
                <span className="font-mono font-medium text-foreground">
                  {reportData.investorDocument}
                </span>
              </div>
              {reportData.investorEmail && (
                <div>
                  <span className="text-muted-foreground">E-mail: </span>
                  <span className="font-medium text-foreground">{reportData.investorEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tabela Detalhada por Produto */}
          <div className="space-y-3">
            <span className="font-semibold text-foreground uppercase text-xs block">
              3. Rendimentos Sujeitos à Tributação Exclusiva (Renda Fixa / Debêntures)
            </span>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px]">
                    <TableHead className="font-semibold">Produto / Título</TableHead>
                    <TableHead className="text-center font-semibold">Cotas Ativas</TableHead>
                    <TableHead className="text-right font-semibold">
                      Saldo em 31/12/{reportData.year}
                    </TableHead>
                    <TableHead className="text-right font-semibold">Rendimentos Brutos</TableHead>
                    <TableHead className="text-right font-semibold">IRRF Retido</TableHead>
                    <TableHead className="text-right font-semibold">
                      Resgates Pagos (Líq.)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {reportData.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma posição ativa ou movimentação registrada no ano-calendário{' '}
                        {reportData.year}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.products.map((prod) => (
                      <TableRow key={prod.productId} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="font-medium text-foreground">{prod.productTitle}</div>
                          {prod.productRate && (
                            <div className="text-[10px] text-muted-foreground">
                              Taxa Contratual: {prod.productRate}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center font-mono">{prod.quotas}</TableCell>

                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(prod.appliedBalance)}
                        </TableCell>

                        <TableCell className="text-right font-mono font-medium text-emerald-600">
                          {formatCurrency(prod.grossYield)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-amber-700 dark:text-amber-400">
                          {formatCurrency(prod.taxAmount)}
                        </TableCell>

                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatCurrency(prod.paidRedemptionsNet)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter className="bg-muted/60 font-semibold text-xs">
                  <TableRow>
                    <TableCell colSpan={2} className="uppercase">
                      Totais Gerais Consolidados
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(reportData.totals.appliedBalance)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">
                      {formatCurrency(reportData.totals.grossYield)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-700 dark:text-amber-400">
                      {formatCurrency(reportData.totals.taxAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-foreground">
                      {formatCurrency(reportData.totals.paidRedemptionsNet)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>

          {/* Informações Complementares e Base Legal */}
          <div className="space-y-3 pt-2">
            <span className="font-semibold text-foreground uppercase text-xs block">
              4. Informações Complementares
            </span>
            <div className="bg-muted/20 p-4 rounded-lg border text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                • <strong>Alíquota de IRRF:</strong> Tributação exclusiva na fonte conforme Lei nº
                11.033/2004 e Instrução Normativa RFB nº 1.585/2015 (Tabela Regressiva: 22,5% até
                180 dias; 20,0% de 181 a 360 dias; 17,5% de 361 a 720 dias; 15,0% acima de 720
                dias).
              </p>
              <p>
                • <strong>Declaração de Bens e Direitos:</strong> Os saldos aplicados em 31/12/
                {reportData.year} devem ser informados no grupo correspondente a Aplicações e
                Investimentos (Renda Fixa / Títulos Privados / Debêntures), sob o CNPJ da respectiva
                emissora.
              </p>
              <p>
                • <strong>Rendimentos Sujeitos à Tributação Exclusiva:</strong> Os valores de
                rendimento recebidos nos resgates pagos devem ser declarados na ficha de
                “Rendimentos Sujeitos à Tributação Exclusiva/Definitiva” sob o código
                correspondente.
              </p>
              <p>
                • Os dados consolidados neste documento refletem fielmente as subscrições,
                rendimentos acumulados pro rata die e resgates liquidados na conta do titular no
                período apurado.
              </p>
            </div>
          </div>

          {/* Rodapé de Validação Oficial */}
          <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Autenticidade garantida por registro criptográfico no sistema Nexum Security 360º
              </span>
            </div>
            <div className="text-right font-mono text-[11px]">
              Documento emitido eletronicamente via portal do investidor
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
