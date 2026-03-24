import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Landmark, ArrowRight, Clock, FileText, CheckCircle2 } from 'lucide-react'
import { CcbWizard } from '@/components/ccb/CcbWizard'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'

export default function CcbDigital() {
  const { user } = useAuth()
  const [showWizard, setShowWizard] = useState(false)
  const [requests, setRequests] = useState<any[]>([])

  const fetchRequests = async () => {
    if (!user) return
    const { data } = await supabase
      .from('ccb_solicitacoes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setRequests(data)
  }

  useEffect(() => {
    fetchRequests()
  }, [user])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovada':
        return <Badge className="bg-emerald-500">Aprovada</Badge>
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>
      case 'em_analise':
        return <Badge className="bg-amber-500">Em Análise BDIGITAL</Badge>
      default:
        return <Badge variant="secondary">Pendente Envio</Badge>
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-10">
      <div className="bg-gradient-to-r from-[#001b33] to-[#004e8a] rounded-2xl overflow-hidden shadow-lg border border-[#00C2E0]/30 relative">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[#00C2E0]/20 rounded-full blur-3xl"></div>
        <div className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-white max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-xs font-semibold tracking-wide">
              <Landmark className="h-4 w-4 text-[#00C2E0]" /> Parceria Exclusiva BDIGITAL
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              Emita sua CCB 100% Digital <span className="text-[#00C2E0]">em 5 minutos</span>
            </h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Antecipação imediata com aprovação bancária direto do seu painel. Crédito rápido, sem
              burocracia, para valores a partir de R$ 5.000.
            </p>
            {!showWizard && (
              <Button
                size="lg"
                className="mt-4 bg-[#00C2E0] hover:bg-[#00a9c4] text-white border-0 font-semibold gap-2"
                onClick={() => setShowWizard(true)}
              >
                Iniciar Emissão CCB <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="hidden md:flex flex-col gap-4 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm min-w-[280px]">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Análise Rápida</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Zero Papel</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#00C2E0]" />
              <span className="text-sm font-medium text-white">Assinatura Eletrônica</span>
            </div>
          </div>
        </div>
      </div>

      {showWizard ? (
        <CcbWizard
          onSuccess={() => {
            setShowWizard(false)
            fetchRequests()
          }}
        />
      ) : (
        requests.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold border-b pb-2">Minhas Solicitações CCB</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests.map((req) => (
                <Card
                  key={req.id}
                  className="shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-muted"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-mono text-muted-foreground">
                        ID: {req.id.split('-')[0].toUpperCase()}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        R$ {Number(req.requested_value).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-sm text-muted-foreground">{req.term_months} meses</p>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t text-sm">
                      <span className="text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {req.pdf_file_path && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-[#00C2E0] hover:text-[#00C2E0] hover:bg-[#00C2E0]/10"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from('ccb-docs')
                              .createSignedUrl(req.pdf_file_path, 60)
                            if (data) window.open(data.signedUrl, '_blank')
                          }}
                        >
                          <FileText className="h-4 w-4" /> Espelho
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
