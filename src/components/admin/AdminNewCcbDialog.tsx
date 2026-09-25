import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2,
  CheckCircle2,
  ChevronRight,
  Info,
  UserCheck,
  Search,
  Building2,
  User as UserIcon,
} from 'lucide-react'
import { FileUpload } from '@/components/operations/FileUpload'
import { useBorrowerLimit } from '@/hooks/use-borrower-limit'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface BorrowerOption {
  id: string
  full_name: string | null
  email: string | null
  document_number: string | null
  entity_type: string | null
  credit_limit: number | null
  is_borrower: boolean | null
  role: string | null
  phone: string | null
  address_street: string | null
  address_number: string | null
  address_neighborhood: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  pf_birth_date: string | null
  pf_marital_status: string | null
  pf_occupation: string | null
  pj_company_name: string | null
  pj_trade_name: string | null
  pj_annual_revenue: number | null
  pj_cnae: string | null
  pj_foundation_date: string | null
}

const InputField = ({ label, value, onChange, className, ...props }: any) => (
  <div className={`space-y-2 ${className || ''}`}>
    <Label>{label}</Label>
    <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} />
  </div>
)

const FileField = ({ label, onChange }: { label: string; onChange: (f: File) => void }) => (
  <div className="space-y-2">
    <Label className="text-xs">{label}</Label>
    <Input
      type="file"
      accept="image/*,.pdf"
      onChange={(e) => onChange(e.target.files?.[0] as File)}
    />
  </div>
)

const sanitize = (text: any) => {
  if (text === null || text === undefined || text === '') return 'Não informado'
  return String(text)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

interface AdminNewCcbDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AdminNewCcbDialog({ open, onOpenChange, onSuccess }: AdminNewCcbDialogProps) {
  const [borrowers, setBorrowers] = useState<BorrowerOption[]>([])
  const [loadingBorrowers, setLoadingBorrowers] = useState(false)
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>('')
  const [borrowerSearch, setBorrowerSearch] = useState('')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [ccbConfig, setCcbConfig] = useState<any>(null)
  const [entityType, setEntityType] = useState<'pf' | 'pj'>('pj')

  const {
    available,
    limit,
    used,
    loading: limitLoading,
  } = useBorrowerLimit(selectedBorrowerId || undefined)

  const [kycData, setKycData] = useState({
    name: '',
    document: '',
    dob: '',
    maritalStatus: 'solteiro',
    occupation: '',
    income: '',
    foundationDate: '',
    cnae: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  })

  const [partnerData, setPartnerData] = useState({
    name: '',
    document: '',
    rg: '',
    dob: '',
    maritalStatus: 'solteiro',
    occupation: '',
    participation: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  })

  const [spouseData, setSpouseData] = useState({
    name: '',
    document: '',
    dob: '',
    phone: '',
    email: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
  })

  const [bankData, setBankData] = useState({
    bank: '',
    branch: '',
    account: '',
    owner_name: '',
    owner_document: '',
    pix_key: '',
  })

  const [opData, setOpData] = useState<any>({
    requestedValue: '10000',
    termMonths: '12',
    purpose: '',
    creditType: 'Credito Certo Bdigital - Garantia Real - VEICULOS',
    proposedRate: '',
    simulation: {},
  })

  const [guarData, setGuarData] = useState({
    guaranteeType: 'nenhuma',
    receivableType: 'duplicatas',
    sacados: [] as any[],
  })

  const [guarantorData, setGuarantorData] = useState({
    name: '',
    document: '',
    dob: '',
    phone: '',
    email: '',
    zip: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    income: '',
    relationship: '',
  })

  const [docsFiles, setDocsFiles] = useState<any>({ bankExtracts: [], additionalDocs: [] })
  const handleFile = (key: string, file?: File) =>
    file && setDocsFiles((p: any) => ({ ...p, [key]: file }))

  const isVehicle =
    opData.creditType?.toUpperCase().includes('VEICULO') || guarData.guaranteeType === 'veiculo'
  const isAval =
    opData.creditType?.toUpperCase().includes('AVAL') || guarData.guaranteeType === 'avalista'

  const [simData, setSimData] = useState({
    installment_value: 0,
    total_to_pay: 0,
    cet: 0,
    cet_monthly: 0,
  })
  const [, setSchedule] = useState<any[]>([])

  // Buscar lista de tomadores e parâmetros globais de CCB
  useEffect(() => {
    if (!open) return

    const loadData = async () => {
      setLoadingBorrowers(true)
      const [{ data: bData }, { data: cfg }] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, full_name, email, document_number, entity_type, credit_limit, is_borrower, role, phone, address_street, address_number, address_neighborhood, address_city, address_state, address_zip, pf_birth_date, pf_marital_status, pf_occupation, pj_company_name, pj_trade_name, pj_annual_revenue, pj_cnae, pj_foundation_date',
          )
          .or('is_borrower.eq.true,role.eq.borrower')
          .order('full_name', { ascending: true }),
        supabase.from('config_ccb').select('*').single(),
      ])

      if (bData) setBorrowers(bData as BorrowerOption[])
      if (cfg) setCcbConfig(cfg)
      setLoadingBorrowers(false)
    }

    loadData()
  }, [open])

  // Ao selecionar um tomador, pré-preenche os dados cadastrais e busca contas bancárias cadastradas
  const handleSelectBorrower = async (bId: string) => {
    setSelectedBorrowerId(bId)
    const b = borrowers.find((item) => item.id === bId)
    if (!b) return

    const isPj = b.entity_type === 'pj' || (!b.entity_type && Boolean(b.pj_company_name))
    setEntityType(isPj ? 'pj' : 'pf')

    setKycData({
      name: b.pj_company_name || b.pj_trade_name || b.full_name || '',
      document: b.document_number || '',
      dob: b.pf_birth_date || '',
      maritalStatus: b.pf_marital_status || 'solteiro',
      occupation: b.pf_occupation || '',
      income: b.pj_annual_revenue ? String(b.pj_annual_revenue / 12) : '',
      foundationDate: b.pj_foundation_date || '',
      cnae: b.pj_cnae || '',
      zip: b.address_zip || '',
      street: b.address_street || '',
      number: b.address_number || '',
      neighborhood: b.address_neighborhood || '',
      city: b.address_city || '',
      state: b.address_state || '',
      phone: b.phone || '',
      email: b.email || '',
    })

    // Buscar conta bancária preferencial do tomador
    try {
      const { data: bankAccounts } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', bId)
        .order('is_active', { ascending: false })
        .limit(1)

      if (bankAccounts && bankAccounts.length > 0) {
        const primary = bankAccounts[0]
        setBankData({
          bank: primary.bank_name || '',
          branch: primary.branch || '',
          account: primary.account_number || '',
          owner_name: primary.owner_name || b.full_name || '',
          owner_document: primary.owner_document || b.document_number || '',
          pix_key: primary.pix_key || '',
        })
      } else {
        setBankData({
          bank: '',
          branch: '',
          account: '',
          owner_name: b.pj_company_name || b.full_name || '',
          owner_document: b.document_number || '',
          pix_key: '',
        })
      }
    } catch {
      // Ignora erro silenciosamente
    }
  }

  // Recalcula simulação sempre que valor, prazo ou configuração mudarem (mesma fórmula do CcbWizard)
  useEffect(() => {
    if (ccbConfig && opData.requestedValue && opData.termMonths) {
      const pv = Number(opData.requestedValue)
      const n = Number(opData.termMonths)
      const rate = (Number(ccbConfig.interest_rate_monthly) || 0) / 100

      let pmt = pv / n
      if (rate > 0) pmt = (pv * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)

      const fixedCost = Number(ccbConfig.fixed_emission_cost) || 0
      const iofFixedRate = Number(ccbConfig.iof_rate) || 0.38
      const iofDaily30 = Number(ccbConfig.iof_daily_rate_30) || 0.0041
      const iofDailyAfter = Number(ccbConfig.iof_daily_rate_after) || 0.00274
      const iofFixo = pv * (iofFixedRate / 100)

      let saldo = pv,
        totalIofDiario = 0
      const newSchedule = []

      for (let i = 1; i <= n; i++) {
        const juros = saldo * rate
        const amortizacao = pmt - juros
        const days = i * 30
        const days1to30 = Math.min(days, 30)
        const daysAfter = Math.max(0, days - 30)
        const iofDiarioParcela =
          amortizacao * (days1to30 * (iofDaily30 / 100) + daysAfter * (iofDailyAfter / 100))

        totalIofDiario += iofDiarioParcela
        saldo -= amortizacao
        newSchedule.push({
          month: i,
          amortizacao,
          juros,
          pmt_base: pmt,
          iof_diario: iofDiarioParcela,
          saldo_devedor: Math.max(0, saldo),
        })
      }

      const totalIof = iofFixo + totalIofDiario
      const parcelaFinal = pmt + totalIof / n + fixedCost / n
      const totalToPay = parcelaFinal * n

      let low = 0.0,
        high = 1.0,
        r = 0.0
      for (let i = 0; i < 50; i++) {
        r = (low + high) / 2
        const currentPv = (parcelaFinal * (1 - Math.pow(1 + r, -n))) / r
        if (currentPv > pv) low = r
        else high = r
      }

      setSchedule(newSchedule)
      setSimData({
        installment_value: parcelaFinal,
        total_to_pay: totalToPay,
        cet_monthly: r * 100,
        cet: (Math.pow(1 + r, 12) - 1) * 100,
      })
      setOpData((prev: any) => ({
        ...prev,
        simulation: {
          installment_value: parcelaFinal,
          total_to_pay: totalToPay,
          cet_monthly: r * 100,
          cet: (Math.pow(1 + r, 12) - 1) * 100,
          cet_annual: (Math.pow(1 + r, 12) - 1) * 100,
          rate_used: rate,
          fixed_cost: fixedCost,
          iof_fixo: iofFixo,
          iof_diario: totalIofDiario,
          total_iof: totalIof,
          schedule: newSchedule,
        },
      }))
    }
  }, [opData.requestedValue, opData.termMonths, ccbConfig])

  const fetchCep = async (zip: string, setFn: any) => {
    if (zip.length >= 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${zip.replace(/\D/g, '')}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFn((p: any) => ({
            ...p,
            street: data.logradouro || p.street,
            neighborhood: data.bairro || p.neighborhood,
            city: data.localidade || p.city,
            state: data.uf || p.state,
          }))
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const fetchCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '')
    if (cleanCnpj.length === 14) {
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
        const data = await res.json()
        if (data.razao_social) {
          setKycData((p) => ({
            ...p,
            name: data.razao_social,
            foundationDate: data.data_inicio_atividade || p.foundationDate,
            cnae: data.cnae_fiscal_descricao || p.cnae,
            zip: data.cep || p.zip,
            street: data.logradouro || p.street,
            number: data.numero || p.number,
            neighborhood: data.bairro || p.neighborhood,
            city: data.municipio || p.city,
            state: data.uf || p.state,
          }))
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  const renderAddress = (data: any, setData: any, title?: string) => (
    <div className="space-y-4 pt-2">
      {title && <h4 className="font-semibold text-sm">{title}</h4>}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            value={data.zip}
            onBlur={() => fetchCep(data.zip, setData)}
            onChange={(e) => setData({ ...data, zip: e.target.value })}
          />
        </div>
        <InputField
          className="md:col-span-2"
          label="Rua"
          value={data.street}
          onChange={(v: string) => setData({ ...data, street: v })}
        />
        <InputField
          label="Número"
          value={data.number}
          onChange={(v: string) => setData({ ...data, number: v })}
        />
        <InputField
          className="md:col-span-2"
          label="Bairro"
          value={data.neighborhood}
          onChange={(v: string) => setData({ ...data, neighborhood: v })}
        />
        <InputField
          className="md:col-span-2 bg-muted/50"
          label="Cidade/UF"
          value={`${data.city || ''} ${data.state ? `- ${data.state}` : ''}`}
          disabled
        />
      </div>
    </div>
  )

  const handleNext = () => {
    if (!selectedBorrowerId) {
      toast.error('Selecione o Tomador de Crédito antes de prosseguir.')
      return
    }
    if (step === 1) {
      if (!kycData.name || !kycData.document) {
        toast.error('Preencha Nome/Razão Social e Documento.')
        return
      }
    }
    if (step === 2) {
      if (entityType === 'pj' && (!partnerData.name || !partnerData.document)) {
        toast.error('Preencha os dados do Sócio Administrador.')
        return
      }
      if (
        entityType === 'pf' &&
        kycData.maritalStatus === 'casado' &&
        (!spouseData.name || !spouseData.document)
      ) {
        toast.error('Preencha os dados do Cônjuge.')
        return
      }
    }
    if (step === 3) {
      if (!opData.requestedValue || !opData.termMonths || !opData.creditType) {
        toast.error('Preencha valor, prazo e tipo de crédito.')
        return
      }
      if (!bankData.bank || !bankData.account) {
        toast.error('Preencha os dados bancários.')
        return
      }
    }
    setStep((s) => Math.min(s + 1, 4))
  }

  const handleSubmit = async () => {
    if (!selectedBorrowerId) {
      toast.error('Selecione o Tomador de Crédito.')
      return
    }

    const reqVal = Number(opData.requestedValue)
    if (limit > 0 && reqVal > available) {
      toast.error(
        `Limite de crédito do tomador excedido. Limite disponível: R$ ${available.toLocaleString('pt-BR')} (Total: R$ ${limit.toLocaleString('pt-BR')}).`,
      )
      return
    }

    setLoading(true)
    try {
      const docsPaths: any = {}
      const upload = async (f: File, key: string, b = 'ccb-docs') => {
        const path = `${selectedBorrowerId}/${Date.now()}_${key}_${f.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const { error } = await supabase.storage.from(b).upload(path, f)
        if (error) {
          console.warn(`Aviso de upload ${key}:`, error)
        } else {
          docsPaths[key] = path
        }
      }

      const fMap: any = {
        id_front: docsFiles.idFront,
        id_back: docsFiles.idBack,
        selfie: docsFiles.selfie,
        proof_address: docsFiles.proofAddress,
        vehicle_doc: docsFiles.vehicleDoc,
        social_contract: docsFiles.socialContract,
        cnpj_card: docsFiles.cnpjCard,
        revenue_proof: docsFiles.revenueProof,
        partner_id_front: docsFiles.partnerIdFront,
        partner_id_back: docsFiles.partnerIdBack,
        partner_selfie: docsFiles.partnerSelfie,
        partner_address: docsFiles.partnerAddress,
        partner_ir: docsFiles.partnerIr,
      }
      for (const [k, f] of Object.entries(fMap)) {
        if (f) await upload(f as File, k)
      }

      for (const [k, f] of Object.entries({
        marriage_cert: docsFiles.marriageCert,
        spouse_id_front: docsFiles.spouseIdFront,
        spouse_id_back: docsFiles.spouseIdBack,
        spouse_selfie: docsFiles.spouseSelfie,
        spouse_address: docsFiles.spouseAddress,
      } as any)) {
        if (f) await upload(f as File, k, 'ccb_conjuges_docs')
      }

      for (const [k, f] of Object.entries({
        guarantor_id_front: docsFiles.guarantorIdFront,
        guarantor_id_back: docsFiles.guarantorIdBack,
        guarantor_selfie: docsFiles.guarantorSelfie,
        guarantor_address: docsFiles.guarantorAddress,
        guarantor_income: docsFiles.guarantorIncome,
      } as any)) {
        if (f) await upload(f as File, k, 'ccb_avalistas_docs')
      }

      const uArr = async (files: File[], key: string) => {
        docsPaths[key] = []
        for (let i = 0; i < files.length; i++) {
          const path = `${selectedBorrowerId}/${Date.now()}_${key}_${i}_${files[i].name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
          const { error } = await supabase.storage.from('ccb-docs').upload(path, files[i])
          if (!error) docsPaths[key].push(path)
        }
      }
      if (docsFiles.bankExtracts?.length) await uArr(docsFiles.bankExtracts, 'bankExtracts')
      if (docsFiles.additionalDocs?.length) await uArr(docsFiles.additionalDocs, 'additionalDocs')

      const ccbId = crypto.randomUUID()
      const borrowerPayload = {
        ...kycData,
        entityType,
        document: kycData.document?.replace(/[^\d]/g, ''),
        income: kycData.income ? Number(kycData.income) : 0,
        partnerData:
          entityType === 'pj'
            ? {
                ...partnerData,
                document: partnerData.document?.replace(/[^\d]/g, ''),
                participation: partnerData.participation ? Number(partnerData.participation) : 0,
              }
            : null,
        spouseData:
          entityType === 'pf' && kycData.maritalStatus === 'casado'
            ? {
                ...spouseData,
                document: spouseData.document?.replace(/[^\d]/g, ''),
              }
            : null,
        bankData: bankData || null,
        guarantorData: isAval
          ? {
              ...guarantorData,
              document: guarantorData.document?.replace(/[^\d]/g, ''),
              income: guarantorData.income ? Number(guarantorData.income) : 0,
            }
          : null,
      }

      // 1. Inserir a solicitação de CCB no banco de dados com status 'pendente'
      const { data: createdCcb, error: dbErr } = await supabase
        .from('ccb_solicitacoes')
        .insert({
          id: ccbId,
          user_id: selectedBorrowerId,
          requested_value: reqVal,
          term_months: parseInt(opData.termMonths, 10) || 12,
          borrower_data: borrowerPayload,
          operation_data: opData || {},
          guarantees_data: guarData || {},
          docs_paths: docsPaths || {},
          status: 'pendente',
          admin_notes: 'Lançada internamente pela Mesa / Admin',
        })
        .select()
        .single()

      if (dbErr) throw dbErr

      // 2. Tentar gerar espelho PDF do Dossiê CCB
      try {
        // Carregar dados da securitizadora para o cabeçalho oficial
        const { data: compSettings } = await (supabase.from('company_settings') as any)
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        const secHeaderName = compSettings?.razao_social || 'NEXUM SECURITIZADORA S.A.'
        const secHeaderCnpj = compSettings?.cnpj ? `CNPJ: ${compSettings.cnpj}` : ''

        const pdfDoc = await PDFDocument.create()
        const page = pdfDoc.addPage([841.89, 595.28])
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const margin = 40
        let currentY = 595.28 - margin

        const drawH2 = (title: string, y: number) => {
          page.drawText(title, { x: margin, y, font: fontBold, size: 12 })
          page.drawLine({
            start: { x: margin, y: y - 5 },
            end: { x: 841.89 - margin, y: y - 5 },
            thickness: 1,
          })
        }

        page.drawText(secHeaderName.toUpperCase(), {
          x: margin,
          y: currentY,
          font: fontBold,
          size: 16,
          color: rgb(0, 0.3, 0.6),
        })
        if (secHeaderCnpj) {
          page.drawText(secHeaderCnpj, {
            x: margin,
            y: currentY - 15,
            font,
            size: 9,
            color: rgb(0.3, 0.3, 0.3),
          })
        }
        page.drawText('DOSSIÊ CCB - LANÇAMENTO INTERNO / PROPOSTA', {
          x: margin + 350,
          y: currentY + 2,
          font: fontBold,
          size: 13,
        })
        currentY -= 30

        drawH2(`1. DADOS DO TOMADOR (${entityType === 'pj' ? 'PJ' : 'PF'})`, currentY)
        currentY -= 20
        page.drawText(
          `Nome/Razão: ${sanitize(kycData.name).substring(0, 50)} | Doc: ${sanitize(kycData.document)}`,
          { x: margin, y: currentY, font, size: 10 },
        )
        currentY -= 15
        page.drawText(
          `Endereço: ${sanitize(kycData.street)}, ${sanitize(kycData.number)} - ${sanitize(kycData.city)}/${sanitize(kycData.state)}`,
          { x: margin, y: currentY, font, size: 10 },
        )
        currentY -= 25

        drawH2('2. OPERAÇÃO E SIMULAÇÃO', currentY)
        currentY -= 20
        page.drawText(
          `Tipo: ${sanitize(opData.creditType).substring(0, 60)} | Prazo: ${opData.termMonths} meses`,
          { x: margin, y: currentY, font: fontBold, size: 10 },
        )
        currentY -= 15
        page.drawText(
          `Valor Solicitado: R$ ${reqVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Parcela Estimada: R$ ${simData.installment_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          { x: margin, y: currentY, font, size: 10 },
        )
        currentY -= 15
        page.drawText(
          `CET: ${simData.cet_monthly.toFixed(4)}% a.m. | Total a pagar: R$ ${simData.total_to_pay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          { x: margin, y: currentY, font, size: 10 },
        )
        currentY -= 25

        if (bankData?.bank) {
          drawH2('3. DADOS BANCÁRIOS DE CRÉDITO', currentY)
          currentY -= 20
          page.drawText(
            `Banco: ${sanitize(bankData.bank)} | Agência: ${sanitize(bankData.branch)} | Conta: ${sanitize(bankData.account)} | Titular: ${sanitize(bankData.owner_name)} (${sanitize(bankData.owner_document)})`,
            { x: margin, y: currentY, font, size: 10 },
          )
        }

        const pdfBytes = await pdfDoc.save()
        const fileName = `Dossie_CCB_${ccbId.substring(0, 8)}.pdf`
        const filePath = `${selectedBorrowerId}/${fileName}`
        const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

        const { error: uploadError } = await supabase.storage
          .from('ccb-docs')
          .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

        if (!uploadError) {
          await supabase
            .from('ccb_solicitacoes')
            .update({ pdf_file_path: filePath })
            .eq('id', ccbId)
        }
      } catch (pdfErr) {
        console.warn('PDF não gerado (fluxo mantido):', pdfErr)
      }

      toast.success('Solicitação de CCB interna lançada com sucesso!')
      onSuccess()
      onOpenChange(false)
      resetState()
    } catch (err: any) {
      toast.error('Erro ao lançar solicitação: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setStep(1)
    setSelectedBorrowerId('')
    setBorrowerSearch('')
    setKycData({
      name: '',
      document: '',
      dob: '',
      maritalStatus: 'solteiro',
      occupation: '',
      income: '',
      foundationDate: '',
      cnae: '',
      zip: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      phone: '',
      email: '',
    })
    setPartnerData({
      name: '',
      document: '',
      rg: '',
      dob: '',
      maritalStatus: 'solteiro',
      occupation: '',
      participation: '',
      zip: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      phone: '',
      email: '',
    })
    setSpouseData({
      name: '',
      document: '',
      dob: '',
      phone: '',
      email: '',
      zip: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
    })
    setBankData({
      bank: '',
      branch: '',
      account: '',
      owner_name: '',
      owner_document: '',
      pix_key: '',
    })
    setOpData({
      requestedValue: '10000',
      termMonths: '12',
      purpose: '',
      creditType: 'Credito Certo Bdigital - Garantia Real - VEICULOS',
      proposedRate: '',
      simulation: {},
    })
    setDocsFiles({ bankExtracts: [], additionalDocs: [] })
  }

  const filteredBorrowers = borrowers.filter((b) => {
    if (!borrowerSearch) return true
    const term = borrowerSearch.toLowerCase()
    return (
      b.full_name?.toLowerCase().includes(term) ||
      b.pj_company_name?.toLowerCase().includes(term) ||
      b.pj_trade_name?.toLowerCase().includes(term) ||
      b.document_number?.includes(term) ||
      b.email?.toLowerCase().includes(term)
    )
  })

  const selectedBorrower = borrowers.find((b) => b.id === selectedBorrowerId)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-[#001b33] to-[#004e8a] text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5 text-[#00C2E0]" /> Lançar Nova Solicitação de CCB
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Criação interna de CCB pela Mesa / Admin em nome do cliente tomador selecionado.
              </DialogDescription>
            </div>
            <div className="w-full md:w-56">
              <div className="flex justify-between text-[11px] font-medium mb-1 text-white/80">
                <span>Passo {step} de 4</span>
                <span>{step * 25}%</span>
              </div>
              <Progress value={step * 25} className="h-1.5 bg-white/20" />
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Seletor de Tomador com exibição de Limite de Crédito */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border/80 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#00C2E0]" /> Cliente Tomador da Operação *
              </Label>
              {selectedBorrower && !limitLoading && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-background">
                    Limite Total: R$ {limit.toLocaleString('pt-BR')}
                  </Badge>
                  <Badge
                    variant={available > 0 ? 'secondary' : 'destructive'}
                    className={
                      available > 0
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        : ''
                    }
                  >
                    Disponível: R$ {available.toLocaleString('pt-BR')}
                  </Badge>
                  {used > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      (Em uso: R$ {used.toLocaleString('pt-BR')})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Filtrar tomador por nome, CNPJ/CPF ou email..."
                  value={borrowerSearch}
                  onChange={(e) => setBorrowerSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <Select
                value={selectedBorrowerId}
                onValueChange={handleSelectBorrower}
                disabled={loadingBorrowers}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      loadingBorrowers ? 'Carregando tomadores...' : 'Selecione o tomador...'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64 z-[9999]">
                  {filteredBorrowers.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
                      Nenhum tomador encontrado.
                    </div>
                  ) : (
                    filteredBorrowers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.pj_company_name || b.full_name || b.email}
                        {b.document_number ? ` — ${b.document_number}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="font-semibold text-base border-b pb-2 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-primary" /> 1. Dados do Solicitante (Empresa / PF)
              </h3>
              <div className="flex items-center gap-6 mb-4 bg-muted/20 p-3 rounded-md border">
                <Label className="text-sm font-semibold">Tipo de Solicitante:</Label>
                <RadioGroup
                  value={entityType}
                  onValueChange={(v: any) => setEntityType(v)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pf" id="admin-ccb-pf" />
                    <Label htmlFor="admin-ccb-pf" className="cursor-pointer">
                      Pessoa Física
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pj" id="admin-ccb-pj" />
                    <Label htmlFor="admin-ccb-pj" className="cursor-pointer">
                      Pessoa Jurídica
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {entityType === 'pj' ? (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    <InputField
                      className="md:col-span-2"
                      label="Razão Social *"
                      value={kycData.name}
                      onChange={(v: string) => setKycData({ ...kycData, name: v })}
                    />
                    <div className="space-y-2">
                      <Label>CNPJ *</Label>
                      <Input
                        value={kycData.document}
                        onBlur={(e) => fetchCnpj(e.target.value)}
                        onChange={(e) => setKycData({ ...kycData, document: e.target.value })}
                      />
                    </div>
                    <InputField
                      label="Data de Fundação"
                      type="date"
                      value={kycData.foundationDate}
                      onChange={(v: string) => setKycData({ ...kycData, foundationDate: v })}
                    />
                    <InputField
                      label="Faturamento Médio Mensal"
                      type="number"
                      value={kycData.income}
                      onChange={(v: string) => setKycData({ ...kycData, income: v })}
                    />
                    <InputField
                      label="CNAE Principal"
                      value={kycData.cnae}
                      onChange={(v: string) => setKycData({ ...kycData, cnae: v })}
                    />
                    <InputField
                      label="Telefone"
                      value={kycData.phone}
                      onChange={(v: string) => setKycData({ ...kycData, phone: v })}
                    />
                    <InputField
                      className="md:col-span-2"
                      label="E-mail"
                      value={kycData.email}
                      onChange={(v: string) => setKycData({ ...kycData, email: v })}
                    />
                  </div>
                  {renderAddress(kycData, setKycData, 'Endereço Comercial')}
                </>
              ) : (
                <>
                  <div className="grid md:grid-cols-3 gap-4">
                    <InputField
                      className="md:col-span-2"
                      label="Nome Completo *"
                      value={kycData.name}
                      onChange={(v: string) => setKycData({ ...kycData, name: v })}
                    />
                    <InputField
                      label="CPF *"
                      value={kycData.document}
                      onChange={(v: string) => setKycData({ ...kycData, document: v })}
                    />
                    <InputField
                      label="Data Nasc."
                      type="date"
                      value={kycData.dob}
                      onChange={(v: string) => setKycData({ ...kycData, dob: v })}
                    />
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Select
                        value={kycData.maritalStatus}
                        onValueChange={(v) => setKycData({ ...kycData, maritalStatus: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <InputField
                      label="Profissão"
                      value={kycData.occupation}
                      onChange={(v: string) => setKycData({ ...kycData, occupation: v })}
                    />
                    <InputField
                      label="Renda Mensal"
                      type="number"
                      value={kycData.income}
                      onChange={(v: string) => setKycData({ ...kycData, income: v })}
                    />
                    <InputField
                      label="Telefone"
                      value={kycData.phone}
                      onChange={(v: string) => setKycData({ ...kycData, phone: v })}
                    />
                    <InputField
                      className="md:col-span-2"
                      label="E-mail"
                      value={kycData.email}
                      onChange={(v: string) => setKycData({ ...kycData, email: v })}
                    />
                  </div>
                  {renderAddress(kycData, setKycData, 'Endereço Residencial')}
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="font-semibold text-base border-b pb-2">2. Sócios e Intervenientes</h3>
              {entityType === 'pj' && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-primary text-sm">
                    Sócio Administrador / Avalista Principal *
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <InputField
                      className="md:col-span-2"
                      label="Nome Completo"
                      value={partnerData.name}
                      onChange={(v: string) => setPartnerData({ ...partnerData, name: v })}
                    />
                    <InputField
                      label="CPF"
                      value={partnerData.document}
                      onChange={(v: string) => setPartnerData({ ...partnerData, document: v })}
                    />
                    <InputField
                      label="RG"
                      value={partnerData.rg}
                      onChange={(v: string) => setPartnerData({ ...partnerData, rg: v })}
                    />
                    <InputField
                      label="Data Nasc."
                      type="date"
                      value={partnerData.dob}
                      onChange={(v: string) => setPartnerData({ ...partnerData, dob: v })}
                    />
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Select
                        value={partnerData.maritalStatus}
                        onValueChange={(v) => setPartnerData({ ...partnerData, maritalStatus: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <InputField
                      label="Profissão"
                      value={partnerData.occupation}
                      onChange={(v: string) => setPartnerData({ ...partnerData, occupation: v })}
                    />
                    <InputField
                      label="Participação Societária (%)"
                      type="number"
                      value={partnerData.participation}
                      onChange={(v: string) => setPartnerData({ ...partnerData, participation: v })}
                    />
                    <InputField
                      label="Telefone"
                      value={partnerData.phone}
                      onChange={(v: string) => setPartnerData({ ...partnerData, phone: v })}
                    />
                  </div>
                  {renderAddress(partnerData, setPartnerData, 'Endereço Residencial do Sócio')}
                </div>
              )}

              {entityType === 'pf' && kycData.maritalStatus === 'casado' && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-primary text-sm">Dados do Cônjuge *</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <InputField
                      className="md:col-span-2"
                      label="Nome Completo"
                      value={spouseData.name}
                      onChange={(v: string) => setSpouseData({ ...spouseData, name: v })}
                    />
                    <InputField
                      label="CPF"
                      value={spouseData.document}
                      onChange={(v: string) => setSpouseData({ ...spouseData, document: v })}
                    />
                    <InputField
                      label="Data Nasc."
                      type="date"
                      value={spouseData.dob}
                      onChange={(v: string) => setSpouseData({ ...spouseData, dob: v })}
                    />
                    <InputField
                      label="Telefone"
                      value={spouseData.phone}
                      onChange={(v: string) => setSpouseData({ ...spouseData, phone: v })}
                    />
                  </div>
                  {renderAddress(spouseData, setSpouseData)}
                </div>
              )}

              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-4">Garantias Adicionais</h4>
                <div className="space-y-2 w-full md:w-1/2">
                  <Label>Tipo de Garantia Secundária</Label>
                  <Select
                    value={guarData.guaranteeType}
                    onValueChange={(v) => setGuarData({ ...guarData, guaranteeType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      <SelectItem value="veiculo">Veículo</SelectItem>
                      <SelectItem value="imovel">Imóvel</SelectItem>
                      <SelectItem value="avalista">Avalista Adicional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isAval && (
                  <div className="grid md:grid-cols-3 gap-4 mt-4 bg-muted/20 p-4 border rounded-md">
                    <InputField
                      className="md:col-span-2"
                      label="Nome do Avalista"
                      value={guarantorData.name}
                      onChange={(v: string) => setGuarantorData({ ...guarantorData, name: v })}
                    />
                    <InputField
                      label="CPF"
                      value={guarantorData.document}
                      onChange={(v: string) => setGuarantorData({ ...guarantorData, document: v })}
                    />
                    <InputField
                      label="Renda (R$)"
                      type="number"
                      value={guarantorData.income}
                      onChange={(v: string) => setGuarantorData({ ...guarantorData, income: v })}
                    />
                    <InputField
                      label="Relação"
                      value={guarantorData.relationship}
                      onChange={(v: string) =>
                        setGuarantorData({ ...guarantorData, relationship: v })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="font-semibold text-base border-b pb-2">
                3. Simulação e Dados Bancários
              </h3>
              <div className="grid md:grid-cols-2 gap-6 bg-background border p-4 rounded-xl shadow-sm">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Tipo de Crédito BDIGITAL *</Label>
                    <Select
                      value={opData.creditType}
                      onValueChange={(v) => setOpData({ ...opData, creditType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Credito Certo Bdigital - Garantia Real - VEICULOS">
                          Garantia Real - VEICULOS
                        </SelectItem>
                        <SelectItem value="CREDITO CERTO BDIGITAL - CAPITAL DE GIRO - MENSAL - AVAL CCB ATUALIZADA">
                          Capital de Giro - AVAL
                        </SelectItem>
                        <SelectItem value="Credito Pessoal - Garantia - Veiculo">
                          Pessoal - Veiculo
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Valor Solicitado</Label>
                      <div className="text-right">
                        <span className="font-bold text-[#00C2E0] text-base">
                          R$ {Number(opData.requestedValue || 1000).toLocaleString('pt-BR')}
                        </span>
                        {!limitLoading && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Disponível: R$ {available.toLocaleString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                    <Slider
                      min={1000}
                      max={500000}
                      step={1000}
                      value={[Number(opData.requestedValue) || 1000]}
                      onValueChange={(v) =>
                        setOpData({ ...opData, requestedValue: v[0].toString() })
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Prazo</Label>
                      <span className="font-bold text-[#00C2E0] text-base">
                        {opData.termMonths} meses
                      </span>
                    </div>
                    <Slider
                      min={3}
                      max={ccbConfig?.max_term_months || 36}
                      step={1}
                      value={[Number(opData.termMonths) || 12]}
                      onValueChange={(v) => setOpData({ ...opData, termMonths: v[0].toString() })}
                    />
                  </div>
                </div>

                <div className="bg-muted/30 p-5 rounded-xl border border-[#00C2E0]/20 flex flex-col justify-center space-y-3">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumo da Simulação
                  </h4>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Valor Parcela</span>
                    <span className="font-bold text-primary">
                      R${' '}
                      {simData.installment_value.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm">Total a Pagar</span>
                    <span className="font-semibold">
                      R${' '}
                      {simData.total_to_pay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-sm">CET (a.m. / a.a.)</span>
                    <span className="font-semibold text-[#00C2E0]">
                      {simData.cet_monthly.toFixed(4)}% / {simData.cet.toFixed(4)}%
                    </span>
                  </div>
                  <Alert className="bg-muted/50 mt-2 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs">
                      Taxas calculadas via Juros Compostos (Equivalência Bancária). IOF conforme
                      Decreto 6.306/07.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-semibold text-sm">Dados Bancários para Recebimento</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <InputField
                    label="Banco"
                    value={bankData.bank}
                    onChange={(v: string) => setBankData({ ...bankData, bank: v })}
                  />
                  <InputField
                    label="Agência"
                    value={bankData.branch}
                    onChange={(v: string) => setBankData({ ...bankData, branch: v })}
                  />
                  <InputField
                    label="Conta"
                    value={bankData.account}
                    onChange={(v: string) => setBankData({ ...bankData, account: v })}
                  />
                  <InputField
                    label="Titular"
                    value={bankData.owner_name}
                    onChange={(v: string) => setBankData({ ...bankData, owner_name: v })}
                  />
                  <InputField
                    label="CPF/CNPJ Titular"
                    value={bankData.owner_document}
                    onChange={(v: string) => setBankData({ ...bankData, owner_document: v })}
                  />
                  <InputField
                    label="Chave PIX"
                    value={bankData.pix_key}
                    onChange={(v: string) => setBankData({ ...bankData, pix_key: v })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="font-semibold text-base border-b pb-2">
                4. Módulo de Documentação (Uploads)
              </h3>
              {entityType === 'pj' ? (
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Documentos da Empresa</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <FileField
                      label="Contrato Social / Estatuto"
                      onChange={(f) => handleFile('socialContract', f)}
                    />
                    <FileField label="Cartão CNPJ" onChange={(f) => handleFile('cnpjCard', f)} />
                    <FileField
                      label="Comprovante de Faturamento"
                      onChange={(f) => handleFile('revenueProof', f)}
                    />
                  </div>
                  <h4 className="font-semibold text-sm pt-4 border-t">
                    Documentos do Sócio Administrador
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <FileField
                      label="RG/CNH (Frente)"
                      onChange={(f) => handleFile('partnerIdFront', f)}
                    />
                    <FileField
                      label="RG/CNH (Verso)"
                      onChange={(f) => handleFile('partnerIdBack', f)}
                    />
                    <FileField
                      label="Selfie com Documento"
                      onChange={(f) => handleFile('partnerSelfie', f)}
                    />
                    <FileField
                      label="Comprovante de Residência"
                      onChange={(f) => handleFile('partnerAddress', f)}
                    />
                    <FileField label="Declaração IR" onChange={(f) => handleFile('partnerIr', f)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Documentos Pessoais</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <FileField
                      label="Identidade (Frente)"
                      onChange={(f) => handleFile('idFront', f)}
                    />
                    <FileField
                      label="Identidade (Verso)"
                      onChange={(f) => handleFile('idBack', f)}
                    />
                    <FileField
                      label="Selfie com Documento"
                      onChange={(f) => handleFile('selfie', f)}
                    />
                    <FileField
                      label="Comprovante de Residência"
                      onChange={(f) => handleFile('proofAddress', f)}
                    />
                  </div>
                  {kycData.maritalStatus === 'casado' && (
                    <>
                      <h4 className="font-semibold text-sm pt-4 border-t">Documentos do Cônjuge</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <FileField
                          label="Identidade (Frente)"
                          onChange={(f) => handleFile('spouseIdFront', f)}
                        />
                        <FileField
                          label="Selfie Cônjuge"
                          onChange={(f) => handleFile('spouseSelfie', f)}
                        />
                        <FileField
                          label="Certidão Casamento"
                          onChange={(f) => handleFile('marriageCert', f)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {(isVehicle || isAval) && (
                <h4 className="font-semibold text-sm pt-4 border-t">Garantias</h4>
              )}
              <div className="grid md:grid-cols-3 gap-4">
                {isVehicle && (
                  <FileField
                    label="CRLV do Veículo"
                    onChange={(f) => handleFile('vehicleDoc', f)}
                  />
                )}
                {isAval && (
                  <>
                    <FileField
                      label="Identidade Avalista"
                      onChange={(f) => handleFile('guarantorIdFront', f)}
                    />
                    <FileField
                      label="Comprovante Renda"
                      onChange={(f) => handleFile('guarantorIncome', f)}
                    />
                  </>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Extratos Bancários / Documentos Adicionais</Label>
                <FileUpload
                  files={docsFiles.bankExtracts}
                  setFiles={(f) =>
                    setDocsFiles({
                      ...docsFiles,
                      bankExtracts: typeof f === 'function' ? f(docsFiles.bankExtracts) : f,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-muted/10 border-t p-4 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(s - 1, 1))}
            disabled={step === 1 || loading}
          >
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            {step < 4 ? (
              <Button
                onClick={handleNext}
                className="gap-2 bg-[#00C2E0] hover:bg-[#00a9c4] text-white"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-[#00C2E0] hover:bg-[#00a9c4] text-white gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Lançar Solicitação
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
