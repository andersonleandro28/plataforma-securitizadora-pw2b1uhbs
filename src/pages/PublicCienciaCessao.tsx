import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileText,
  ShieldCheck,
  Building2,
  User,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  Download,
  Info,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

interface NotificationPublicData {
  notification: {
    id: string
    token: string
    operation_id: string
    sacado_nome: string
    sacado_documento: string | null
    sacado_email: string | null
    sacado_telefone: string | null
    pdf_file_path: string | null
    pdf_url: string | null
    status_aceite: 'aguardando' | 'aceito' | 'expirado'
    aceito_em: string | null
    aceito_ip: string | null
    aceito_user_agent: string | null
    aceito_hash: string | null
    expira_em: string
    credit_operations: {
      id: string
      face_value: number
      requested_value: number
      issue_date: string | null
      due_date: string | null
      document_number: string | null
      receivable_type: string | null
      installments_data: any
      cedente: string | null
      profiles?: {
        full_name: string | null
        email: string | null
        document: string | null
        pj_company_name: string | null
        pj_cnpj: string | null
      } | null
    } | null
  }
  company: {
    company_name: string | null
    trade_name: string | null
    cnpj: string | null
    address_street: string | null
    address_number: string | null
    address_city: string | null
    address_state: string | null
    email: string | null
    phone: string | null
  } | null
  bankAccount: {
    bank_name: string | null
    bank_code: string | null
    branch: string | null
    account_number: string | null
    owner_name: string | null
    owner_document: string | null
    pix_key: string | null
  } | null
}

export function PublicCienciaCessao() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [data, setData] = useState<NotificationPublicData | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [acceptedSuccess, setAcceptedSuccess] = useState(false)
  const [acceptMetadata, setAcceptMetadata] = useState<{
    aceito_em?: string
    aceito_ip?: string
    aceito_hash?: string
  }>({})

  useEffect(() => {
    if (!token) {
      setErrorMessage('Token de acesso não informado.')
      setLoading(false)
      return
    }

    const loadNotification = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const { data: resData, error } = await supabase.functions.invoke(
          'acknowledge-cessao-notification',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )

        // Note: Invoke GET on Edge Functions handles query params via request URL or body params
        // Let's call using direct URL fetch with supabase url for query params reliability
      } catch (err: any) {
        console.warn('Fallbacking to fetch direct', err)
      }

      try {
        const supabaseUrl =
          import.meta.env.VITE_SUPABASE_URL || 'https://misoqvscsydxqcsfjaux.supabase.co'
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        const response = await fetch(
          `${supabaseUrl}/functions/v1/acknowledge-cessao-notification?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: anonKey,
            },
          },
        )

        const payload = await response.json()

        if (!response.ok) {
          if (response.status === 410 || payload.expired) {
            setIsExpired(true)
            setErrorMessage(payload.error || 'Este link de confirmação expirou.')
          } else {
            setErrorMessage(payload.error || 'Notificação não encontrada ou inválida.')
          }
          return
        }

        setData(payload)
        if (payload.notification?.status_aceite === 'aceito') {
          setAcceptedSuccess(true)
          setAcceptMetadata({
            aceito_em: payload.notification.aceito_em,
            aceito_ip: payload.notification.aceito_ip,
            aceito_hash: payload.notification.aceito_hash,
          })
        }
      } catch (err: any) {
        console.error('Error fetching notification:', err)
        setErrorMessage(err.message || 'Erro de conexão ao carregar a notificação.')
      } finally {
        setLoading(false)
      }
    }

    loadNotification()
  }, [token])

  const handleConfirmCiencia = async () => {
    if (!token) return
    setSubmitting(true)
    try {
      const supabaseUrl =
        import.meta.env.VITE_SUPABASE_URL || 'https://misoqvscsydxqcsfjaux.supabase.co'
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      const response = await fetch(`${supabaseUrl}/functions/v1/acknowledge-cessao-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
        },
        body: JSON.stringify({ token }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao registrar confirmação.')
      }

      setAcceptedSuccess(true)
      setAcceptMetadata({
        aceito_em: payload.aceito_em,
        aceito_ip: payload.aceito_ip,
        aceito_hash: payload.aceito_hash,
      })

      if (data?.notification) {
        setData({
          ...data,
          notification: {
            ...data.notification,
            status_aceite: 'aceito',
            aceito_em: payload.aceito_em,
            aceito_ip: payload.aceito_ip,
            aceito_hash: payload.aceito_hash,
          },
        })
      }

      toast.success('Ciência confirmada com sucesso!')
    } catch (err: any) {
      console.error('Confirm ciencia error:', err)
      toast.error(err.message || 'Erro ao confirmar ciência da cessão.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!data?.notification) return
    setDownloadingPdf(true)
    try {
      const notif = data.notification
      let downloadBlob: Blob | null = null

      if (notif.pdf_file_path) {
        const { data: fileData, error: fileErr } = await supabase.storage
          .from('operation-docs')
          .download(notif.pdf_file_path)

        if (!fileErr && fileData) {
          downloadBlob = fileData
        }
      }

      if (!downloadBlob && notif.pdf_url) {
        const res = await fetch(notif.pdf_url)
        if (res.ok) {
          downloadBlob = await res.blob()
        }
      }

      if (!downloadBlob) {
        throw new Error('PDF da notificação ainda não está disponível para download.')
      }

      const opNum = notif.operation_id?.split('-')[0]?.toUpperCase() || 'OP'
      const blobUrl = URL.createObjectURL(downloadBlob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `Notificacao_Cessao_${opNum}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      toast.success('Download do documento PDF iniciado.')
    } catch (err: any) {
      console.error('Download error:', err)
      toast.error(err.message || 'Erro ao baixar o documento PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">
            Carregando Notificação de Cessão...
          </h2>
          <p className="text-sm text-muted-foreground">
            Verificando a autenticidade e validade jurídica do documento.
          </p>
        </div>
      </div>
    )
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-rose-200 dark:border-rose-900 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-rose-900 dark:text-rose-200">
              {isExpired ? 'Link de Notificação Expirado' : 'Notificação Inválida'}
            </CardTitle>
            <CardDescription className="text-sm">
              {errorMessage || 'O link de confirmação não foi reconhecido pelo sistema.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-foreground text-center py-4">
            <p>
              Por motivos de segurança e conformidade jurídica, as notificações de cessão possuem
              validade temporal e código de verificação individual.
            </p>
            <p>
              Caso necessite de uma segunda via ou de instruções atualizadas para liquidação do
              título, favor entrar em contato diretamente com a Securitizadora credora.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button variant="outline" size="sm">
                Ir para Página Inicial
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const { notification: notif, company, bankAccount } = data
  const op = notif.credit_operations
  const cedenteName =
    op?.profiles?.pj_company_name || op?.profiles?.full_name || op?.cedente || 'Cedente do Crédito'
  const cedenteDoc = op?.profiles?.pj_cnpj || op?.profiles?.document || 'Documento não informado'
  const secName = company?.company_name || company?.trade_name || 'Nexum Securitizadora S/A'
  const secCnpj = company?.cnpj || 'CNPJ não cadastrado'
  const opIdShort = notif.operation_id?.split('-')[0]?.toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header Institucional */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              N
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{secName}</h1>
              <p className="text-xs text-muted-foreground">
                Plataforma de Formalização de Cessão de Crédito • CNPJ: {secCnpj}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs font-mono border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
          >
            Art. 290 Código Civil
          </Badge>
        </div>

        {/* Card Principal da Notificação */}
        <Card className="border shadow-md overflow-hidden bg-white dark:bg-slate-900">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase tracking-widest text-blue-200 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Instrumento Jurídico de
                Notificação
              </span>
              <span className="text-xs font-mono bg-blue-950/60 px-2.5 py-1 rounded text-blue-100 border border-blue-700/60">
                OP #{opIdShort}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Notificação Formal de Cessão de Crédito
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1">
              Comunicação de transferência definitiva de titularidade de créditos e instrução
              oficial de pagamento.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Status do Aceite Banner */}
            {acceptedSuccess ? (
              <Alert className="bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="font-semibold text-sm">
                  Ciência Confirmada e Registrada Legalmente
                </AlertTitle>
                <AlertDescription className="text-xs mt-1 space-y-1">
                  <p>
                    A confirmação desta cessão foi registrada com eficácia plena em{' '}
                    <strong>
                      {acceptMetadata.aceito_em
                        ? format(new Date(acceptMetadata.aceito_em), 'dd/MM/yyyy HH:mm:ss')
                        : 'Registro confirmado'}
                    </strong>
                    .
                  </p>
                  {acceptMetadata.aceito_ip && (
                    <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                      IP: {acceptMetadata.aceito_ip} | Hash:{' '}
                      {acceptMetadata.aceito_hash?.substring(0, 24)}...
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold text-sm">
                  Aguardando sua Confirmação de Ciência
                </AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Por favor, confira os dados da operação abaixo e clique no botão{' '}
                  <strong>"Confirmar ciência da cessão"</strong> para atestar o recebimento desta
                  notificação.
                </AlertDescription>
              </Alert>
            )}

            {/* Seção 1: Identificação das Partes */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> 1. Identificação das Partes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border text-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                    Cedente Original (Tomador)
                  </span>
                  <p className="font-medium text-foreground">{cedenteName}</p>
                  <p className="text-muted-foreground font-mono">{cedenteDoc}</p>
                </div>

                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs space-y-1">
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase block">
                    Cessionária (Nova Credora)
                  </span>
                  <p className="font-medium text-foreground">{secName}</p>
                  <p className="text-muted-foreground font-mono">CNPJ: {secCnpj}</p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border text-xs space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                    Sacado (Devedor)
                  </span>
                  <p className="font-medium text-foreground">{notif.sacado_nome}</p>
                  {notif.sacado_documento && (
                    <p className="text-muted-foreground font-mono">{notif.sacado_documento}</p>
                  )}
                  {notif.sacado_email && (
                    <p className="text-muted-foreground text-[11px] truncate">
                      {notif.sacado_email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Seção 2: Dados do Título Cedido */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> 2. Dados do Título e Valores Cedidos
              </h3>
              <div className="border rounded-lg overflow-hidden text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 bg-muted/40 p-3 border-b gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Tipo de Ativo:</span>
                    <strong className="text-foreground uppercase">
                      {op?.receivable_type?.replace('_', ' ') || 'Duplicata Mercantil'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nº Documento:</span>
                    <strong className="text-foreground font-mono">
                      {op?.document_number || `OP-${opIdShort}`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Emissão:</span>
                    <span className="text-foreground">
                      {op?.issue_date
                        ? format(new Date(op.issue_date + 'T00:00:00'), 'dd/MM/yyyy')
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Vencimento:</span>
                    <strong className="text-foreground">
                      {op?.due_date
                        ? format(new Date(op.due_date + 'T00:00:00'), 'dd/MM/yyyy')
                        : '-'}
                    </strong>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Valor Total de Face Cedido
                    </span>
                    <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(op?.face_value || op?.requested_value || 0)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Visualizar / Baixar PDF Completo
                  </Button>
                </div>
              </div>
            </div>

            {/* Seção 3: Instrução de Pagamento */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> 3. Instrução Obrigatória de Pagamento
              </h3>
              <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-xs space-y-3">
                <p className="text-foreground leading-relaxed">
                  Conforme preceitua o{' '}
                  <strong>artigo 290 da Lei Federal nº 10.406/2002 (Código Civil)</strong>, o SACADO
                  fica ciente e notificado de que a quitação desta obrigação deve ocorrer{' '}
                  <strong>EXCLUSIVAMENTE</strong> em favor da Cessionária <strong>{secName}</strong>
                  .
                </p>

                <div className="p-3 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-blue-800 space-y-1.5">
                  <p className="font-semibold text-blue-950 dark:text-blue-100 text-xs">
                    Dados Bancários Oficiais para Quitação:
                  </p>
                  {bankAccount ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Banco:</span>{' '}
                        <strong>
                          {bankAccount.bank_name || 'Banco Parceiro'} ({bankAccount.bank_code})
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Agência:</span>{' '}
                        <strong>{bankAccount.branch}</strong> •{' '}
                        <span className="text-muted-foreground">C/C:</span>{' '}
                        <strong>{bankAccount.account_number}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Favorecido:</span>{' '}
                        <strong>{bankAccount.owner_name || secName}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chave PIX:</span>{' '}
                        <strong className="text-emerald-600 font-mono">
                          {bankAccount.pix_key || secCnpj}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs space-y-1">
                      <p>
                        <span className="text-muted-foreground">Favorecido:</span>{' '}
                        <strong>{secName}</strong> (CNPJ: {secCnpj})
                      </p>
                      <p>
                        <span className="text-muted-foreground">Chave PIX:</span>{' '}
                        <strong className="text-emerald-600 font-mono">{secCnpj}</strong>
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  Aviso Importante: Pagamentos efetuados ao cedente original ou a terceiros não
                  autorizados não terão eficácia liberatória da dívida perante a Cessionária.
                </p>
              </div>
            </div>

            {/* Ação de Confirmação de Ciência */}
            <div className="pt-4 border-t flex flex-col items-center justify-center text-center space-y-3">
              {acceptedSuccess ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg w-full text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Sua ciência foi confirmada com sucesso.
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    O registro eletrônico qualificado vinculou seu acesso, data e hora legal de
                    Brasília. Você pode guardar uma cópia do documento PDF para seus arquivos
                    contábeis.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Ao clicar no botão abaixo, você atesta a ciência desta notificação de cessão em
                    conformidade com as Leis Federais 10.406/2002 e 14.063/2020.
                  </p>
                  <Button
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-8 shadow-sm gap-2"
                    onClick={handleConfirmCiencia}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Registrando confirmação...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Confirmar ciência da cessão
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </CardContent>

          <CardFooter className="bg-muted/20 border-t p-4 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
            <span>Ambiente Seguro • Nexum Security 360º</span>
            <span>Validade legal da notificação: 90 dias a partir da emissão</span>
          </CardFooter>
        </Card>

        {/* Rodapé institucional */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>
            Dúvidas financeiras ou operacionais? Entre em contato pelo e-mail oficial:{' '}
            {company?.email || 'contato@securitizadora.com.br'}
          </p>
        </div>
      </div>
    </div>
  )
}
export default PublicCienciaCessao
