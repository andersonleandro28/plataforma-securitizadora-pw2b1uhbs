import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Copy,
  Check,
  Compass,
  Lightbulb,
  Sparkles,
  HelpCircle,
  Shield,
  User,
  ArrowRight,
  Maximize2,
  Minimize2,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/use-auth'
import {
  searchKnowledgeBase,
  FREQUENT_QUESTIONS_BY_ROLE,
  KNOWLEDGE_BASE,
  type KnowledgeTopic,
} from '@/lib/assistant-knowledge'
import { toast } from 'sonner'

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text?: string
  topic?: KnowledgeTopic
  directAnswer?: string
  suggestedTopics?: KnowledgeTopic[]
  warning?: string
  timestamp: string
}

export function AssistantChat() {
  const { activeRole, profile } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [inputText, setInputText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Chave do localStorage por usuário/perfil
  const storageKey = useMemo(() => {
    const userId = profile?.id || 'anon'
    const role = activeRole || 'all'
    return `nexum_assistant_history_${userId}_${role}`
  }, [profile?.id, activeRole])

  const initialWelcomeMessage: ChatMessage = useMemo(() => {
    const roleLabel =
      activeRole === 'admin'
        ? 'Administrador'
        : activeRole === 'borrower'
          ? 'Tomador'
          : activeRole === 'investor'
            ? 'Investidor'
            : activeRole === 'accountant'
              ? 'Contador'
              : 'Usuário'

    return {
      id: 'welcome',
      sender: 'assistant',
      text: `Olá! Sou o **Manual Interativo** da Nexum Security 360º. Estou aqui para guiar você passo a passo na realização de qualquer tarefa no perfil de **${roleLabel}**.\n\nEscolha uma das sugestões rápidas abaixo ou digite sua dúvida no campo de busca.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
  }, [activeRole])

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch {
      // Ignora falha de parse
    }
    return [initialWelcomeMessage]
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Salva histórico no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      // localStorage pode estar cheio ou inacessível
    }
  }, [messages, storageKey])

  // Rola até o final das mensagens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Foco automático no input quando aberto
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
    }
  }, [isOpen])

  // Perguntas frequentes do perfil ativo
  const quickQuestions = useMemo(() => {
    const role = activeRole || 'borrower'
    return (
      FREQUENT_QUESTIONS_BY_ROLE[role] ||
      FREQUENT_QUESTIONS_BY_ROLE.borrower ||
      FREQUENT_QUESTIONS_BY_ROLE.investor
    )
  }, [activeRole])

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : inputText).trim()
    if (!query) return

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: now,
    }

    const answer = searchKnowledgeBase(query, activeRole || undefined)

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      sender: 'assistant',
      topic: answer.topic,
      directAnswer: answer.directAnswer,
      suggestedTopics: answer.suggestedTopics,
      warning: answer.warning,
      timestamp: now,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    if (textToSend === undefined) {
      setInputText('')
    }
  }

  const handleSelectTopic = (topic: KnowledgeTopic) => {
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: topic.title,
      timestamp: now,
    }

    // Busca tópicos relacionados para sugestão
    const suggestions = KNOWLEDGE_BASE.filter(
      (t) =>
        t.id !== topic.id && (topic.relatedTopicIds?.includes(t.id) || t.roles.includes('all')),
    ).slice(0, 3)

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      sender: 'assistant',
      topic,
      suggestedTopics: suggestions,
      timestamp: now,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
  }

  const handleClearHistory = () => {
    setMessages([initialWelcomeMessage])
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    toast.success('Histórico da conversa foi reiniciado.')
  }

  const handleCopyText = (text: string, id: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Instruções copiadas para a área de transferência.')
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const formatRoleBadge = () => {
    switch (activeRole) {
      case 'admin':
        return <Badge className="bg-primary hover:bg-primary text-xs">Admin</Badge>
      case 'staff':
        return <Badge className="bg-indigo-600 text-xs">Staff</Badge>
      case 'accountant':
        return <Badge className="bg-amber-600 text-xs">Contador</Badge>
      case 'investor':
        return <Badge className="bg-emerald-600 text-xs">Investidor</Badge>
      case 'borrower':
        return <Badge className="bg-blue-600 text-xs">Tomador</Badge>
      default:
        return <Badge variant="outline">Geral</Badge>
    }
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end print:hidden">
        {/* Janela do Chat Assistente */}
        {isOpen && (
          <div
            className={`mb-3 flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-5 ${
              isExpanded
                ? 'w-[95vw] sm:w-[650px] md:w-[720px] h-[85vh] max-h-[820px]'
                : 'w-[92vw] sm:w-[420px] md:w-[460px] h-[580px] max-h-[85vh]'
            }`}
            role="dialog"
            aria-label="Manual Interativo do Sistema"
          >
            {/* Header do Chat */}
            <div className="bg-[#0f0f11] text-white px-4 py-3 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm leading-tight text-zinc-100">
                      Manual Interativo
                    </h3>
                    <span className="text-[10px] font-medium bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded">
                      Interno
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                    Modo: {formatRoleBadge()}
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
                    Online
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-zinc-400">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      onClick={handleClearHistory}
                      aria-label="Limpar conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Limpar conversa</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800 hidden sm:inline-flex"
                      onClick={() => setIsExpanded(!isExpanded)}
                      aria-label={isExpanded ? 'Reduzir janela' : 'Expandir janela'}
                    >
                      {isExpanded ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isExpanded ? 'Reduzir' : 'Expandir'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      onClick={() => setIsOpen(false)}
                      aria-label="Fechar manual"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fechar</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Sugestões Rápidas (Chips de perguntas frequentes do perfil) */}
            <div className="bg-muted/40 border-b px-3 py-2 shrink-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Perguntas frequentes ({activeRole || 'geral'})
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(q.query)}
                    className="shrink-0 text-xs bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 border rounded-full px-2.5 py-1 text-muted-foreground transition-all duration-150 text-left font-medium shadow-2xs"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Área de Mensagens / Respostas com Passo a Passo */}
            <ScrollArea className="flex-1 p-3.5 space-y-4">
              <div className="space-y-4 pb-2">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user'

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-end items-end gap-2">
                        <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-tr-xs px-3.5 py-2.5 text-xs shadow-xs">
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          <span className="text-[9px] opacity-75 block text-right mt-1">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // Mensagem do Assistente
                  return (
                    <div key={msg.id} className="flex justify-start items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1 text-primary">
                        <BookOpen className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 max-w-[92%] space-y-2">
                        {/* Texto Simples / Boas-vindas / Aviso */}
                        {msg.text && (
                          <div className="bg-muted/70 text-foreground rounded-2xl rounded-tl-xs p-3.5 text-xs leading-relaxed border space-y-2">
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        )}

                        {/* Resposta direta (ex: aviso de saldo em tempo real) */}
                        {msg.directAnswer && (
                          <div className="bg-amber-500/10 border border-amber-500/30 text-foreground rounded-xl p-3 text-xs leading-relaxed space-y-2">
                            <p className="whitespace-pre-wrap">{msg.directAnswer}</p>
                          </div>
                        )}

                        {/* Aviso de Não Encontrado */}
                        {msg.warning && (
                          <div className="bg-muted/60 border border-dashed rounded-xl p-3 text-xs text-muted-foreground space-y-2">
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Não encontrei uma resposta exata</span>
                            </div>
                            <p>{msg.warning}</p>
                          </div>
                        )}

                        {/* Card do Tópico com Passo a Passo Estruturado */}
                        {msg.topic && (
                          <div className="bg-card border border-border/80 rounded-xl p-3.5 text-xs shadow-xs space-y-3">
                            <div className="flex items-start justify-between gap-2 border-b pb-2">
                              <div>
                                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block mb-0.5">
                                  Instrução do Sistema
                                </span>
                                <h4 className="font-bold text-sm text-foreground leading-snug">
                                  {msg.topic.title}
                                </h4>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => {
                                      const stepsStr = msg.topic?.steps
                                        .map((s, i) => `${i + 1}. ${s}`)
                                        .join('\n')
                                      const textToCopy = `*${msg.topic?.title}*\nCaminho: ${msg.topic?.navigationPath}\n\n${msg.topic?.summary}\n\nPassos:\n${stepsStr}`
                                      handleCopyText(textToCopy, msg.id)
                                    }}
                                  >
                                    {copiedId === msg.id ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copiar passos</TooltipContent>
                              </Tooltip>
                            </div>

                            {/* Caminho exato de navegação */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 flex items-start gap-2">
                              <Compass className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-semibold text-primary uppercase block">
                                  Caminho de Navegação:
                                </span>
                                <p className="font-medium text-foreground text-[11px]">
                                  {msg.topic.navigationPath}
                                </p>
                              </div>
                            </div>

                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {msg.topic.summary}
                            </p>

                            {/* Lista numerada de passos */}
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[11px] font-bold text-foreground block uppercase tracking-wide">
                                Passo a Passo:
                              </span>
                              <ol className="space-y-1.5 pl-4 list-decimal marker:font-bold marker:text-primary">
                                {msg.topic.steps.map((st, i) => (
                                  <li key={i} className="text-foreground leading-relaxed pl-1">
                                    {st}
                                  </li>
                                ))}
                              </ol>
                            </div>

                            {/* Dicas e Alertas Importantes */}
                            {msg.topic.tips && msg.topic.tips.length > 0 && (
                              <div className="bg-muted/40 border-l-2 border-l-amber-500 rounded-r-lg p-2.5 space-y-1">
                                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-[10px] uppercase">
                                  <Lightbulb className="w-3 h-3" />
                                  <span>Dicas & Regras de Negócio</span>
                                </div>
                                <ul className="space-y-1 text-muted-foreground text-[11px] pl-3 list-disc">
                                  {msg.topic.tips.map((tip, idx) => (
                                    <li key={idx} className="leading-snug">
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tópicos Sugeridos / Relacionados */}
                        {msg.suggestedTopics && msg.suggestedTopics.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block">
                              Tópicos Relacionados:
                            </span>
                            <div className="flex flex-col gap-1">
                              {msg.suggestedTopics.map((sug) => (
                                <button
                                  key={sug.id}
                                  type="button"
                                  onClick={() => handleSelectTopic(sug)}
                                  className="w-full text-left text-xs bg-muted/30 hover:bg-primary/5 hover:border-primary/40 border rounded-lg px-2.5 py-1.5 text-foreground transition-colors flex items-center justify-between group"
                                >
                                  <span className="truncate group-hover:text-primary font-medium">
                                    {sug.title}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 ml-1 transition-transform group-hover:translate-x-0.5" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <span className="text-[9px] text-muted-foreground block text-left">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Rodapé com campo de busca / input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="p-3 bg-card border-t border-border flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Qual tarefa você deseja realizar?"
                className="text-xs h-9"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputText.trim()}
                className="h-9 px-3 gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Perguntar</span>
              </Button>
            </form>
          </div>
        )}

        {/* Botão Flutuante (Disparador no Canto Inferior Direito) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="relative group bg-[#0f0f11] hover:bg-[#1a1a1f] text-white p-3.5 rounded-full shadow-xl hover:shadow-2xl border border-zinc-700/60 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Abrir manual interativo do sistema"
            >
              {isOpen ? (
                <X className="w-6 h-6 text-zinc-100" />
              ) : (
                <div className="relative flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary" />
                  {/* Selo discreto "Manual" */}
                  <span className="absolute -top-3 -right-3 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-tighter shadow-xs">
                    Manual
                  </span>
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isOpen ? 'Fechar Manual Interativo' : 'Manual Interativo do Sistema (Ajuda)'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
export default AssistantChat
