import React, { useState } from 'react'
import {
  Copy,
  Check,
  Rocket,
  ShieldCheck,
  Database,
  Cpu,
  KeyRound,
  ListChecks,
  AlertTriangle,
  Scale,
  FileText,
  Search,
  Filter,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  MIGRATIONS_DATA,
  EDGE_FUNCTIONS_DATA,
  SECRETS_DATA,
  PHASES_DATA,
  FULL_GUIDE_MARKDOWN,
} from '@/lib/deployment-guide-data'

export default function DeploymentGuide() {
  const [copiedFull, setCopiedFull] = useState(false)
  const [migrationFilter, setMigrationFilter] = useState<'TODOS' | 'APLICAR' | 'PULAR'>('TODOS')
  const [migrationSearch, setMigrationSearch] = useState('')
  const [functionSearch, setFunctionSearch] = useState('')
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('nexum_deployment_guide_checklist')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  })

  const toggleCheck = (stepId: string) => {
    setCheckedSteps((prev) => {
      const updated = { ...prev, [stepId]: !prev[stepId] }
      try {
        localStorage.setItem('nexum_deployment_guide_checklist', JSON.stringify(updated))
      } catch {
        // ignore storage errors
      }
      return updated
    })
  }

  const handleCopyFull = async () => {
    try {
      await navigator.clipboard.writeText(FULL_GUIDE_MARKDOWN)
      setCopiedFull(true)
      toast.success('Guia completo copiado com sucesso!', {
        description:
          'Cole na primeira mensagem do agente no projeto novo da Skip para guiar toda a implantação.',
      })
      setTimeout(() => setCopiedFull(false), 3000)
    } catch {
      toast.error('Erro ao copiar conteúdo para a área de transferência.')
    }
  }

  const handleCopySnippet = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado!`)
    } catch {
      toast.error('Falha ao copiar.')
    }
  }

  const filteredMigrations = MIGRATIONS_DATA.filter((m) => {
    if (migrationFilter !== 'TODOS' && m.action !== migrationFilter) return false
    if (!migrationSearch.trim()) return true
    const q = migrationSearch.toLowerCase()
    return (
      m.filename.toLowerCase().includes(q) ||
      m.justification.toLowerCase().includes(q) ||
      String(m.id).includes(q)
    )
  })

  const filteredFunctions = EDGE_FUNCTIONS_DATA.filter((ef) => {
    if (!functionSearch.trim()) return true
    const q = functionSearch.toLowerCase()
    return ef.name.toLowerCase().includes(q) || ef.purpose.toLowerCase().includes(q)
  })

  const totalStepsCount = PHASES_DATA.reduce((acc, p) => acc + p.steps.length, 0)
  const completedStepsCount = Object.values(checkedSteps).filter(Boolean).length
  const progressPct = Math.round((completedStepsCount / totalStepsCount) * 100) || 0

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-12">
        {/* Banner de Cabeçalho Institucional */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 md:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px] tracking-wider font-semibold">
                  Módulo Exclusivo Admin
                </Badge>
                <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-[10px]">
                  Manual Operacional Mestre
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <Rocket className="h-7 w-7 text-primary shrink-0" />
                Guia de Implantação em Nova Operação
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Tudo o que você precisa para subir uma nova instância da plataforma{' '}
                <strong className="text-zinc-200">Nexum Security 360°</strong> na Skip conectada a
                um novo Supabase limpo e seguro: inventário das 92 migrations (75 a aplicar / 17 a
                pular), 26 edge functions explicadas, 6 credenciais necessárias, passo a passo em 6
                fases e as regras inegociáveis de negócio.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3 shrink-0">
              <Button
                size="lg"
                onClick={handleCopyFull}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md active:scale-95 transition-all"
              >
                {copiedFull ? (
                  <>
                    <Check className="h-5 w-5 text-white" />
                    <span>Conteúdo Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5" />
                    <span>Copiar Guia Completo</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Barra de Progresso Rápida do Checklist */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-300">Progresso do Checklist:</span>
              <div className="w-36 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="font-semibold text-primary">
                {completedStepsCount} de {totalStepsCount} etapas ({progressPct}%)
              </span>
            </div>
            <div className="text-[11px] text-zinc-500">
              * O estado dos checkboxes fica salvo no seu navegador.
            </div>
          </div>
        </div>

        {/* Cards de Resumo Executivo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Migrations
              </CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-foreground">92 Total</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <span className="text-emerald-500 font-semibold">75 Aplicar</span>
                <span>•</span>
                <span className="text-rose-500 font-semibold">17 Pular</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Edge Functions
              </CardTitle>
              <Cpu className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-foreground">26 Funções</div>
              <p className="text-xs text-muted-foreground mt-1">Backend serverless em Deno</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Credenciais Externas
              </CardTitle>
              <KeyRound className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-foreground">6 Contas</div>
              <p className="text-xs text-muted-foreground mt-1">
                Resend, Serasa, DocuSign + Supabase
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Checklist de Fases
              </CardTitle>
              <ListChecks className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <div className="text-2xl font-bold text-foreground">6 Fases</div>
              <p className="text-xs text-muted-foreground mt-1">Do setup aos testes de aceitação</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerta de Regras Inegociáveis no Topo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Regra Pétrea: Limite de Crédito do Tomador</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p>
                <strong className="text-foreground">Status &quot;Pago&quot; consome limite:</strong>{' '}
                O desembolso ao cedente já ocorreu. Operações pagas <em>continuam consumindo</em> o
                teto de crédito do tomador e nunca voltam para &quot;aprovado&quot;.
              </p>
              <p>
                <strong className="text-foreground">
                  Somente &quot;Liquidado&quot; libera limite:
                </strong>{' '}
                Apenas quando o sacado quita o título o limite do tomador é restaurado.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/10">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Scale className="h-4 w-4 shrink-0" />
                <span>Tributação Obrigatória: Securitizadora (Lucro Real)</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p>
                <strong className="text-foreground">PIS (0,65%) e COFINS (4,00%):</strong>{' '}
                Cumulativo sobre spread, deduzindo despesas de captação (juros de debêntures).
              </p>
              <p>
                <strong className="text-foreground">IRPJ 15% + 10% adicional</strong> (&gt; R$
                20k/mês) | <strong className="text-foreground">CSLL 9%</strong> |{' '}
                <strong className="text-foreground">IOF Isento</strong> |{' '}
                <strong className="text-foreground">ISS Não incide</strong>.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Abas Principais de Conteúdo */}
        <Tabs defaultValue="fases" className="w-full space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60">
            <TabsTrigger
              value="fases"
              className="py-2.5 text-xs font-semibold flex items-center gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>Passo a Passo (6 Fases)</span>
            </TabsTrigger>
            <TabsTrigger
              value="migrations"
              className="py-2.5 text-xs font-semibold flex items-center gap-1.5"
            >
              <Database className="h-3.5 w-3.5" />
              <span>Migrations (92)</span>
            </TabsTrigger>
            <TabsTrigger
              value="functions"
              className="py-2.5 text-xs font-semibold flex items-center gap-1.5"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Edge Functions (26)</span>
            </TabsTrigger>
            <TabsTrigger
              value="secrets"
              className="py-2.5 text-xs font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Credenciais & Secrets</span>
            </TabsTrigger>
            <TabsTrigger
              value="visao-geral"
              className="py-2.5 text-xs font-semibold flex items-center gap-1.5 col-span-2 md:col-span-1"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Regras & Visão Geral</span>
            </TabsTrigger>
          </TabsList>

          {/* ========================================================= */}
          {/* ABA 1: PASSO A PASSO (CHECKLIST 6 FASES) */}
          {/* ========================================================= */}
          <TabsContent value="fases" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-primary" />
                      Checklist Interativo de Implantação
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Marque cada etapa conforme você avança na criação da nova securitizadora. O
                      progresso fica salvo no seu navegador.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCheckedSteps({})
                      localStorage.removeItem('nexum_deployment_guide_checklist')
                      toast.info('Checklist reiniciado.')
                    }}
                    className="text-xs h-8"
                  >
                    Resetar Checklist
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {PHASES_DATA.map((phase) => {
                  const isExpanded = expandedPhases[phase.number] ?? true
                  const phaseCompleted = phase.steps.filter((s) => checkedSteps[s.id]).length
                  const allDone = phaseCompleted === phase.steps.length

                  return (
                    <div
                      key={phase.number}
                      className="border rounded-xl overflow-hidden bg-card transition-colors"
                    >
                      <div
                        onClick={() =>
                          setExpandedPhases((prev) => ({
                            ...prev,
                            [phase.number]: !isExpanded,
                          }))
                        }
                        className="p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer flex items-center justify-between transition-colors border-b"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              allDone
                                ? 'bg-emerald-500 text-white'
                                : 'bg-primary/20 text-primary border border-primary/30'
                            }`}
                          >
                            {allDone ? <Check className="h-4 w-4" /> : phase.number}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                              Fase {phase.number}: {phase.title}
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                              {phaseCompleted} de {phase.steps.length} concluídos
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {allDone && (
                            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              Concluída
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 space-y-3 divide-y divide-border/40">
                          {phase.steps.map((step) => {
                            const isChecked = !!checkedSteps[step.id]

                            return (
                              <div
                                key={step.id}
                                className={`pt-3 first:pt-0 flex items-start gap-3 transition-opacity ${
                                  isChecked ? 'opacity-60' : 'opacity-100'
                                }`}
                              >
                                <Checkbox
                                  id={step.id}
                                  checked={isChecked}
                                  onCheckedChange={() => toggleCheck(step.id)}
                                  className="mt-1"
                                />
                                <div className="flex-1 space-y-2">
                                  <label
                                    htmlFor={step.id}
                                    className={`text-xs leading-relaxed cursor-pointer block select-none ${
                                      isChecked
                                        ? 'line-through text-muted-foreground'
                                        : 'text-foreground font-medium'
                                    }`}
                                  >
                                    {step.text}
                                  </label>

                                  {step.code && (
                                    <div className="relative group bg-zinc-950 text-zinc-100 p-3 rounded-lg text-xs font-mono border border-zinc-800">
                                      <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed">
                                        {step.code}
                                      </pre>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        className="absolute top-2 right-2 h-7 px-2 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleCopySnippet(step.code!, 'Comando')
                                        }}
                                      >
                                        <Copy className="h-3 w-3 mr-1" />
                                        Copiar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================= */}
          {/* ABA 2: MIGRATIONS (75 APLICAR / 17 PULAR) */}
          {/* ========================================================= */}
          <TabsContent value="migrations" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      Inventário Completo de Migrations (92 Arquivos)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Separação estrita entre migrações estruturais que devem ser aplicadas e
                      scripts corretivos com dados de testes da operação antiga que devem ser
                      pulados.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                      <Button
                        variant={migrationFilter === 'TODOS' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMigrationFilter('TODOS')}
                        className="h-7 text-xs"
                      >
                        Todas (92)
                      </Button>
                      <Button
                        variant={migrationFilter === 'APLICAR' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMigrationFilter('APLICAR')}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Aplicar (75)
                      </Button>
                      <Button
                        variant={migrationFilter === 'PULAR' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMigrationFilter('PULAR')}
                        className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        Pular (17)
                      </Button>
                    </div>

                    <div className="relative w-48 sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={migrationSearch}
                        onChange={(e) => setMigrationSearch(e.target.value)}
                        placeholder="Buscar por arquivo ou finalidade..."
                        className="pl-8 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/70 border-b text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">Arquivo de Migração</th>
                          <th className="py-2.5 px-3 w-28 text-center">Ação</th>
                          <th className="py-2.5 px-3">Justificativa / Finalidade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredMigrations.map((m) => {
                          const isApply = m.action === 'APLICAR'
                          return (
                            <tr
                              key={m.id}
                              className={`hover:bg-muted/40 transition-colors ${
                                !isApply ? 'bg-rose-500/5' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-mono text-muted-foreground text-[11px]">
                                {m.id}
                              </td>
                              <td className="py-2 px-3 font-mono font-medium text-foreground text-[11px] break-all">
                                {m.filename}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  className={`text-[10px] font-bold px-2 py-0.5 ${
                                    isApply
                                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  {m.action}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground leading-relaxed">
                                {m.justification}
                              </td>
                            </tr>
                          )
                        })}
                        {filteredMigrations.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-muted-foreground">
                              Nenhuma migração encontrada para a busca informada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================= */}
          {/* ABA 3: EDGE FUNCTIONS (26 FUNÇÕES) */}
          {/* ========================================================= */}
          <TabsContent value="functions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-indigo-500" />
                      Inventário das 26 Edge Functions
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Todas as funções de backend localizadas em `supabase/functions/` descritas em
                      linguagem de produto e negócios.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={functionSearch}
                      onChange={(e) => setFunctionSearch(e.target.value)}
                      placeholder="Buscar função..."
                      className="pl-8 text-xs h-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredFunctions.map((fn, idx) => (
                    <div
                      key={fn.name}
                      className="border rounded-xl p-3.5 bg-card hover:border-primary/40 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-primary break-all">
                          {fn.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground shrink-0"
                        >
                          #{idx + 1}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{fn.purpose}</p>
                    </div>
                  ))}
                  {filteredFunctions.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-muted-foreground text-xs">
                      Nenhuma edge function encontrada.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================= */}
          {/* ABA 4: CREDENCIAIS & SECRETS */}
          {/* ========================================================= */}
          <TabsContent value="secrets" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-500" />
                  Credenciais e Segredos do Ambiente (Secrets)
                </CardTitle>
                <CardDescription className="text-xs">
                  Para que a nova operação funcione sem erros, ela precisa possuir suas próprias
                  contas corporativas nos serviços externos integrados. Nenhuma chave da operação
                  anterior deve ser reaproveitada.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1 space-y-4">
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 border-b text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Nome do Segredo</th>
                        <th className="py-2.5 px-3 w-40">Provedor</th>
                        <th className="py-2.5 px-3">O que é e onde obter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {SECRETS_DATA.map((sec) => (
                        <tr key={sec.name} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-foreground text-[11px] whitespace-nowrap">
                            {sec.name}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {sec.provider}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground leading-relaxed">
                            {sec.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border text-xs text-muted-foreground space-y-2">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Como cadastrar os segredos no novo projeto:
                  </h4>
                  <ol className="list-decimal pl-4 space-y-1 text-xs">
                    <li>
                      No painel da <strong>Skip</strong>, utilize o comando interno de configuração
                      de variáveis de ambiente (ou adicione via painel do Supabase).
                    </li>
                    <li>
                      No painel do <strong>Supabase</strong>, acesse{' '}
                      <code>Settings -&gt; Edge Functions -&gt; Secrets</code> e crie cada chave
                      acima.
                    </li>
                    <li>
                      As chaves <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code> e{' '}
                      <code>SUPABASE_SERVICE_ROLE_KEY</code> já são preenchidas automaticamente pelo
                      provedor.
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================================================= */}
          {/* ABA 5: REGRAS INEGOCIÁVEIS & VISÃO GERAL */}
          {/* ========================================================= */}
          <TabsContent value="visao-geral" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Regras Inegociáveis e Governança da Securitizadora
                </CardTitle>
                <CardDescription className="text-xs">
                  Regras institucionais, operacionais e tributárias que jamais devem ser quebradas
                  ou alteradas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-1">
                {/* 1. Operação Limpa */}
                <div className="border-l-2 border-primary pl-4 space-y-1.5">
                  <h3 className="font-bold text-sm text-foreground">
                    1. Operação Limpa (Zero Contaminação de Dados)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A nova empresa deve iniciar com{' '}
                    <strong>
                      saldo zero, histórico zerado e nenhuma informação de clientes da operação
                      anterior
                    </strong>
                    . Nenhum arquivo de backup, tabela de backup (como{' '}
                    <code>pre_producao_preserva_investimentos</code>) ou registros de auditoria da
                    base anterior devem ser transferidos.
                  </p>
                </div>

                {/* 2. Regra Pétrea do Limite do Tomador */}
                <div className="border-l-2 border-amber-500 pl-4 space-y-1.5">
                  <h3 className="font-bold text-sm text-foreground">
                    2. Regra Pétrea do Limite de Crédito do Tomador (Sensibilidade Máxima)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A lógica de consumo e liberação do limite de crédito do tomador segue uma regra
                    institucional estrita:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed">
                    <li>
                      <strong>Operação Aprovada:</strong> Consome o limite de crédito do tomador.
                    </li>
                    <li>
                      <strong>Operação com status &quot;Pago&quot;:</strong> Significa que a
                      securitizadora desembolsou o recurso para o cedente (o tomador já recebeu o
                      dinheiro). Portanto,{' '}
                      <strong>
                        &quot;pago&quot; CONTINUA CONSUMINDO o limite de crédito do tomador
                      </strong>
                      . Sob nenhuma hipótese uma operação paga deve liberar limite ou retornar para
                      &quot;aprovado&quot;.
                    </li>
                    <li>
                      <strong>Operação com status &quot;Liquidado&quot;:</strong> Significa que o
                      devedor/sacado final pagou o título e o dinheiro entrou de volta no caixa da
                      securitizadora.{' '}
                      <strong>
                        SOMENTE O STATUS &quot;LIQUIDADO&quot; LIBERA E RESTAURA O LIMITE DE CRÉDITO
                        DO TOMADOR.
                      </strong>
                    </li>
                    <li>Operações canceladas ou reprovadas também liberam o limite.</li>
                  </ul>
                </div>

                {/* 3. Tributação Obrigatória */}
                <div className="border-l-2 border-blue-500 pl-4 space-y-1.5">
                  <h3 className="font-bold text-sm text-foreground">
                    3. Tributação Obrigatória de Securitizadora de Créditos (Lei nº 9.718/1998)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Empresas de securitização de créditos são obrigadas ao regime de tributação pelo{' '}
                    <strong>Lucro Real</strong>:
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed">
                    <li>
                      <strong>PIS (0,65%) e COFINS (4,00%):</strong> Regime cumulativo sobre a
                      receita bruta operacional (spread). A legislação permite a{' '}
                      <strong>dedução direta das despesas financeiras de captação</strong> (juros
                      remuneratórios das debêntures pagos aos investidores) da base de cálculo.
                    </li>
                    <li>
                      <strong>IRPJ (Imposto de Renda Pessoa Jurídica):</strong> Alíquota de{' '}
                      <strong>15% sobre o lucro real</strong>, acrescida do{' '}
                      <strong>Adicional de 10%</strong> sobre a parcela do lucro tributável que
                      exceder R$ 20.000,00 por mês (R$ 60.000,00 no trimestre).
                    </li>
                    <li>
                      <strong>CSLL (Contribuição Social sobre o Lucro Líquido):</strong> Alíquota de{' '}
                      <strong>9%</strong> sobre o lucro real.
                    </li>
                    <li>
                      <strong>IOF (Imposto sobre Operações Financeiras):</strong> Isento para
                      operações de cessão de direitos creditórios e recebíveis.
                    </li>
                    <li>
                      <strong>ISS (Imposto Sobre Serviços):</strong> <strong>Não incide</strong>{' '}
                      sobre compra de direitos creditórios por ausência de prestação de serviços (LC
                      116/2003).
                    </li>
                  </ul>
                </div>

                {/* 4. Os 6 Tipos Canônicos de Recebíveis */}
                <div className="border-l-2 border-emerald-500 pl-4 space-y-1.5">
                  <h3 className="font-bold text-sm text-foreground">
                    4. Os 6 Tipos Canônicos de Recebíveis Homologados
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A plataforma opera exclusivamente com as 6 categorias estruturadas de
                    recebíveis:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>1. Cheque:</strong> Pré-datados e à vista
                    </div>
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>2. Nota Promissória:</strong> Título por promessa
                    </div>
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>3. Contrato de Mútuo:</strong> Mútuo financeiro
                    </div>
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>4. Confissão de Dívida:</strong> Instrumentos públicos/particulares
                    </div>
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>5. Recebível Contratual:</strong> Locação, serviços, fornecimento
                    </div>
                    <div className="p-2 border rounded-lg bg-muted/20">
                      <strong>6. Outros:</strong> Descrição personalizada
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
