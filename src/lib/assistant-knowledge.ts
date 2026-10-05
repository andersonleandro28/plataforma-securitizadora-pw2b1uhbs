/**
 * Base de Conhecimento Estruturada e Motor de Busca Interno do Manual Interativo do Sistema
 * Nexum Security 360º (Securitizadora de Créditos)
 *
 * 100% interno e determinístico — SEM IA externa / SEM chamadas a LLMs.
 */

export type AssistantRole = 'admin' | 'staff' | 'accountant' | 'borrower' | 'investor' | 'all'

export interface KnowledgeTopic {
  id: string
  title: string
  roles: AssistantRole[]
  keywords: string[]
  navigationPath: string
  category: 'admin' | 'investor' | 'borrower' | 'transversal'
  summary: string
  steps: string[]
  tips?: string[]
  relatedTopicIds?: string[]
}

export interface SearchMatch {
  topic: KnowledgeTopic
  score: number
  matchedKeywords: string[]
}

export interface AssistantAnswer {
  matched: boolean
  topic?: KnowledgeTopic
  directAnswer?: string
  suggestedTopics: KnowledgeTopic[]
  warning?: string
}

/**
 * Normaliza textos para busca (minúsculas, remove acentos e pontuações comuns)
 */
export function normalizeAssistantText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/[^a-z0-9\s]/g, ' ') // substitui pontuação por espaço
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokenização simples com stemming em português para raízes comuns
 */
export function stemWord(word: string): string {
  if (word.length <= 3) return word
  // Plural simples
  if (word.endsWith('ões')) return word.slice(0, -3) + 'ao'
  if (word.endsWith('oes')) return word.slice(0, -3) + 'ao'
  if (word.endsWith('ais') || word.endsWith('eis') || word.endsWith('ois'))
    return word.slice(0, -2) + 'l'
  if (word.endsWith('res') || word.endsWith('zes')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) word = word.slice(0, -1)

  // Desinências verbais comuns
  const suffixes = [
    'amento',
    'amentos',
    'imento',
    'imentos',
    'acao',
    'acoes',
    'ando',
    'endo',
    'indo',
    'aram',
    'eram',
    'iram',
    'avam',
    'asse',
    'esse',
    'isse',
    'aria',
    'eria',
    'iria',
    'ara',
    'era',
    'ira',
    'ava',
    'ava',
    'ar',
    'er',
    'ir',
  ]
  for (const suf of suffixes) {
    if (word.length > suf.length + 3 && word.endsWith(suf)) {
      return word.slice(0, -suf.length)
    }
  }
  return word
}

/**
 * Mapeamento de sinônimos frequentes no domínio de securitizadora de crédito
 */
const SYNONYMS_MAP: Record<string, string[]> = {
  tomador: ['cedente', 'cliente', 'empresa', 'sacador', 'mutuario'],
  investidor: ['debenturista', 'cotista', 'aplicador', 'aportante'],
  sacado: ['devedor', 'pagador', 'comprador', 'cliente_do_tomador'],
  recebivel: ['duplicata', 'titulo', 'cheque', 'nota', 'bordero', 'ativo'],
  ccb: ['cedula', 'cedula_credito_bancario', 'emprestimo', 'bdigital'],
  debenture: ['escritura', 'serie', 'subscricao', 'cautela', 'titulo_divida'],
  limite: ['saldo_disponivel', 'credito_disponivel', 'teto', 'capacidade'],
  liquidar: ['liquidado', 'liquidacao', 'quitar', 'baixar', 'pago', 'recebido'],
  resgate: ['saque', 'retirada', 'reembolso', 'desinvestir', 'resgatar'],
  comissao: ['gerente', 'gerente_credito', 'recibo', 'honorario', 'broker'],
  tributo: ['imposto', 'lucro_real', 'lair', 'lalur', 'pis', 'cofins', 'irpj', 'csll'],
  dre: ['demonstrativo_resultado', 'resultado', 'receitas', 'despesas'],
  dfc: ['fluxo_caixa', 'fasb95', 'entradas', 'saidas', 'caixa_operacional'],
  livro_caixa: ['extrato', 'contabilidade', 'conciliacao', 'movimentacoes'],
  assinatura: ['docusign', 'assinar', 'formalizacao', 'eletronica', 'digital', 'aditivo'],
  escritura: ['junta_comercial', 'jucesc', 'jucesp', 'arquivamento', 'registro'],
  saldo: ['extrato', 'quanto_tenho', 'meu_dinheiro', 'posicao', 'saldo_atual'],
}

/**
 * Base de conhecimento curada e oficial da plataforma Nexum Security 360º
 */
export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // ==========================================
  // ADMIN & STAFF
  // ==========================================
  {
    id: 'admin-tomador-limite',
    title: 'Cadastro de Tomadores e Regra do Limite de Crédito',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gestão de Usuários (ou Risco Global)',
    keywords: [
      'tomador',
      'limite',
      'credito',
      'regra',
      'consumo',
      'liberacao',
      'liquidado',
      'pago',
      'cadastro tomador',
      'alterar limite',
      'aumentar limite',
      'capacidade',
      'risco',
      'limite tomador',
      'restaura limite',
    ],
    summary:
      'Como cadastrar ou ajustar tomadores e a regra estrita de consumo/liberação de limite.',
    steps: [
      'Acesse "Gestão de Usuários" no menu lateral.',
      'Localize o tomador desejado na tabela ou clique em "Novo Cadastro" para inserir um tomador PF ou PJ com CNPJ/CPF, razão social e dados de contato.',
      'No menu de ações do tomador (três pontos), clique em "Gestão de Risco & Limite" (AdminUserRiskDialog).',
      'Na aba "Alterar Limite", insira o novo valor de teto de crédito e preencha obrigatoriamente a "Justificativa da Alteração" (ex.: comprovação de faturamento via balanço).',
      'Clique em "Salvar Novo Limite". A alteração é registrada em trilha de auditoria (audit_logs).',
    ],
    tips: [
      'REGRA DE OURO DO SISTEMA: Operações com status "pago" (dinheiro desembolsado ao tomador) CONTINUAM CONSUMINDO o limite.',
      'Apenas o status "liquidado" (quando o sacado ou tomador quita o título/parcela) LIBERA e restaura o limite disponível do tomador.',
      'Operações com status "pago" jamais devem retornar para "aprovado".',
    ],
    relatedTopicIds: ['admin-lancar-operacao', 'admin-ccb-purchases'],
  },
  {
    id: 'admin-lancar-operacao',
    title: 'Lançar Antecipação de Recebíveis (Mesa de Operações)',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath: 'Menu lateral > Mesa de Operações > Botão "Lançar Operação"',
    keywords: [
      'lancar operacao',
      'antecipacao',
      'recebiveis',
      'duplicata',
      'cheque',
      'bordero',
      'mesa de operacoes',
      'novo bordero',
      'desagio',
      'aditivo',
    ],
    summary:
      'Passo a passo para registrar e processar uma nova aquisição de recebíveis na mesa de operações.',
    steps: [
      'Acesse "Mesa de Operações" no menu lateral.',
      'No canto superior direito, clique no botão "Lançar Operação" para abrir o assistente de bordero.',
      'Selecione o Tomador (cedente) já homologado e, opcionalmente, o Gerente de Crédito responsável pela indicação.',
      'Defina o Tipo de Ativo (Duplicata Mercantil, Cheque, CCB ou Outros Recebíveis).',
      'Informe o Sacado (devedor) com CNPJ/CPF, o Valor de Face total e a Data de Vencimento do título.',
      'O sistema calculará automaticamente o deságio, taxa administrativa e o Valor Líquido com base nos Parâmetros Financeiros.',
      'Caso precise de condições diferenciadas para a operação, utilize a opção "Alterar Taxas" na linha da operação.',
      'Faça o upload do documento comprobatório (espelho da NF-e, XML ou cópia do título) e confirme o lançamento.',
      'A operação entrará na esteira com status "enviado" ou "em_analise" para formalização e geração do aditivo de cessão com assinatura eletrônica.',
    ],
    tips: [
      'O valor líquido solicitado consome imediatamente o limite disponível do tomador.',
      'Após aprovado e assinado, registre a liberação do recurso bancário para mudar o status para "pago".',
    ],
    relatedTopicIds: ['admin-tomador-limite', 'transversal-assinatura-eletronica'],
  },
  {
    id: 'admin-notificacao-cessao',
    title: 'Notificação de Cessão de Crédito ao Sacado (Art. 290 Código Civil)',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Mesa de Operações > Clicar na Operação > Card "Notificação de Cessão de Crédito"',
    keywords: [
      'notificacao cessao',
      'notificacao de cessao',
      'sacado',
      'art 290',
      'ciencia sacado',
      'reenviar notificacao',
      'reenvio sacado',
      'download notificacao',
      'email sacado',
      'telefone sacado',
      'aceite publico',
      'ciencia da cessao',
    ],
    summary:
      'Fluxo completo da Notificação de Cessão ao sacado: disparo automático pós-aprovação, download de PDF autenticado, reenvio por e-mail e confirmação de ciência pelo link público.',
    steps: [
      'Geração Automática: ao aprovar uma operação de antecipação ("aprovado") na Mesa de Operações, o sistema gera assincronamente a Notificação de Cessão formal em PDF e dispara um e-mail com anexo e link de ciência se o sacado possuir e-mail cadastrado.',
      'Identificação e Acompanhamento: no detalhe da operação (AdminOperationDetails) e na listagem, localize a coluna/badge "Ciência do Sacado" com os estados: "Aceito" (com carimbo de data/hora), "Aguardando ciência", "Falha no envio" ou "Sem e-mail".',
      'Download do Documento: clique no botão "Notificação de Cessão (PDF)" para baixar o documento através de conexão segura autenticada da plataforma.',
      'Reenvio Manual ao Sacado: caso o sacado solicite reenvio ou tenha atualizado o e-mail, utilize o botão "Reenviar ao sacado" (ativo se houver e-mail válido).',
      'Edição de Contato do Sacado: clique em "Editar Contatos do Sacado" para retificar o e-mail e telefone diretamente na operação e no registro de notificação.',
      'Confirmação pelo Sacado: o sacado acessa a rota pública sem login (/ciencia-cessao/:token), revisa os dados da cessão, instrução bancária da securitizadora e clica em "Confirmar ciência da cessão", gerando hash criptográfico SHA-256 e IP de auditoria.',
    ],
    tips: [
      'O PDF da notificação atende ao art. 290 do Código Civil e adverte o sacado de que pagamentos efetuados ao cedente original não têm eficácia liberatória.',
      'O link de confirmação do sacado tem validade de 90 dias a contar da emissão.',
    ],
    relatedTopicIds: ['admin-lancar-operacao', 'transversal-assinatura-eletronica'],
  },
  {
    id: 'borrower-notificacao-cessao',
    title: 'Tomador: Download da Notificação de Cessão de Crédito',
    roles: ['borrower'],
    category: 'borrower',
    navigationPath: 'Menu lateral > Minhas Solicitações > Botão "Notificação" na linha da operação',
    keywords: [
      'notificacao cessao tomador',
      'baixar notificacao',
      'notificacao sacado',
      'comprovante cessao',
      'art 290 tomador',
      'notificacao pdf',
    ],
    summary:
      'Como o tomador pode baixar a Notificação de Cessão em PDF para acompanhar a comunicação enviada aos sacados.',
    steps: [
      'No Dashboard do Tomador, acesse a tabela "Minhas Solicitações e Assinaturas".',
      'Localize a operação de antecipação que já se encontra com status "Aprovado", "Formalização" ou "Pago / Liquidado".',
      'Na coluna de ações ou dentro do modal "Ver Detalhes", clique no botão "Notificação" (ou "Baixar Notificação de Cessão (PDF)").',
      'O download seguro do PDF é realizado diretamente pelo navegador, contendo todos os dados do título, da securitizadora cessionária e a advertência de pagamento exclusivo.',
    ],
    tips: [
      'A notificação fica disponível imediatamente após a aprovação da proposta pela mesa.',
      'A ciência do sacado é formalizada diretamente por ele através do link enviado no e-mail cadastrado.',
    ],
    relatedTopicIds: ['borrower-nova-operacao', 'borrower-dashboard-visao'],
  },
  {
    id: 'admin-ccb-purchases',
    title: 'Aquisição e Compras de CCB (Cédula de Crédito Bancário)',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath: 'Menu lateral > Compras CCB BDIGITAL (ou Solicitações CCB)',
    keywords: [
      'ccb',
      'compras ccb',
      'solicitacoes ccb',
      'aquisicao ccb',
      'cedula de credito',
      'bdigital',
      'parcelas ccb',
      'aprovar ccb',
      'comprar ccb',
    ],
    summary:
      'Fluxo de análise, aprovação de solicitações de CCB e registro de compras com cronograma de parcelas.',
    steps: [
      'Acesse "Solicitações CCB" para conferir propostas submetidas pelos tomadores através do simulador BDIGITAL.',
      'Revise os dados da proposta: valor solicitado, prazo em meses, taxa pactuada e capacidade de pagamento do tomador.',
      'Se necessário ajustar termos, clique em "Ajustar Proposta" para enviar uma contraproposta que o tomador aceita no próprio painel.',
      'Após aceite e emissão da CCB formalizada, acesse "Compras CCB BDIGITAL" para registrar a aquisição do ativo pela securitizadora.',
      'Confira o cronograma de parcelas gerado (número de parcelas, datas de vencimento e valor unitário).',
      'Ao confirmar a aquisição, a operação é refletida em "Recebíveis e Parcelas" e o desembolso registrado no Livro Caixa.',
    ],
    tips: [
      'Cada parcela vinculada gera boletos e códigos PIX automáticos com juros e multa pré-calculados em caso de atraso.',
      'A quitação de cada parcela CCB pelo tomador libera proporcionalmente seu limite de crédito na plataforma.',
    ],
    relatedTopicIds: [
      'admin-ccb-prorrogacao',
      'admin-tomador-limite',
      'admin-livro-caixa',
      'borrower-ccb-digital',
    ],
  },
  {
    id: 'admin-ccb-prorrogacao',
    title: 'Prorrogação de Parcelas de CCB e Cálculo de Juros Pro Rata',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Compras CCB BDIGITAL > Botão "Ver Parcelas" > Botão "Prorrogar"',
    keywords: [
      'prorrogar ccb',
      'prorrogacao ccb',
      'prorrogar parcela',
      'novo vencimento ccb',
      'juros prorrogacao',
      'pro rata die ccb',
      'estender vencimento',
      'renegociar ccb',
      'aditivo ccb',
    ],
    summary:
      'Como prorrogar a data de vencimento de uma parcela de CCB não liquidada, calculando juros pro rata die automáticos pela taxa contratada da operação e atualizando o valor devido.',
    steps: [
      'Acesse "Compras CCB BDIGITAL" no menu lateral.',
      'Na linha da operação de CCB desejada, clique no ícone de lista "Ver Parcelas" para abrir a listagem de parcelas do contrato.',
      'Localize a parcela que deseja prorrogar. Ao lado do botão verde "Dar Baixa", clique no botão "Prorrogar" (ícone de calendário com relógio).',
      'O sistema abre o diálogo "Prorrogar Parcela", exibindo o vencimento original, o valor nominal e a taxa de remuneração contratada da CCB.',
      'Selecione a Nova Data de Vencimento no date picker (deve ser posterior à data atual de vencimento).',
      'O sistema calcula automaticamente os dias de prorrogação e os juros pro rata die proporcionais ao período adicional (Taxa Mensal ÷ 30 × Dias × Valor Original).',
      'Se necessário, ajuste ou adicione encargos complementares no campo "Multa / Encargos" e preencha uma breve justificativa no campo "Motivo / Justificativa".',
      'Confira o resumo: o "Novo Valor da Parcela" é calculado somando o valor original aos juros da prorrogação.',
      'Clique em "Confirmar Prorrogação". O sistema grava a nova data, o novo valor devido, o status "Prorrogada", a observação com histórico e registra o evento na trilha de auditoria.',
      'A parcela atualizada é automaticamente refletida no relatório "Recebíveis a Receber" com status Prorrogado, novo vencimento e novo valor de face.',
    ],
    tips: [
      'Parcelas que já foram baixadas/quitadas (status "Pago") não podem ser prorrogadas diretamente — caso precise retificar uma baixa indevida antes de prorrogar, utilize o botão "Reverter Baixa".',
      'A prorrogação não afeta saldos de caixa já realizados e mantém o consumo de limite de crédito do tomador até a liquidação definitiva.',
    ],
    relatedTopicIds: [
      'admin-ccb-purchases',
      'admin-relatorios-recebiveis-a-receber',
      'admin-tomador-limite',
    ],
  },
  {
    id: 'admin-debentures-escritura',
    title: 'Debêntures: Emissão, Editar Escritura & Registro na Junta Comercial',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath: 'Menu lateral > Debêntures > Botão "Editar Escritura & Registro"',
    keywords: [
      'debenture',
      'escritura',
      'junta comercial',
      'jucesc',
      'jucesp',
      'registro',
      'numero arquivamento',
      'data registro',
      'editar escritura',
      'emissao',
      'series',
      'subscricao',
      'cautela',
      'normativa',
    ],
    summary:
      'Configuração dos dados oficiais da Junta Comercial e emissão/gestão de séries e escrituras.',
    steps: [
      'Acesse a tela "Debêntures" no menu lateral.',
      'No topo da tela, clique no botão de destaque "Editar Escritura & Registro" (abre o diálogo EditEscrituraDialog).',
      'Preencha ou revise os campos oficiais de arquivamento:',
      '  - Nome do Emissor / Razão Social da securitizadora.',
      '  - Identificação da Escritura (ex.: "1ª Escritura de Emissão Pública de Debêntures").',
      '  - Número da Emissão (ex.: "1ª Emissão").',
      '  - Órgão de Registro / Junta Comercial (ex.: "Junta Comercial do Estado de Santa Catarina" - JUCESC ou outra UF).',
      '  - Data do Registro/Arquivamento (ex.: 2025-06-05).',
      '  - Nº do Arquivamento na Junta (ex.: ED009857000).',
      '  - Volume Total da Emissão em R$ e Data da Ata de Deliberação.',
      'Observe a caixa de prévia da redação normativa contratual que será impressa nos termos de subscrição e cautelas.',
      'Mantenha marcada a opção "Regenerar retroativamente os contratos existentes vinculados a esta escritura" caso queira atualizar os PDFs já emitidos.',
      'Clique em "Salvar Escritura". O sistema sincroniza todos os documentos contratuais de debêntures.',
    ],
    tips: [
      'Na aba "Gestão Granular de Séries", você pode adicionar novas séries seniores ou subordinadas com taxas específicas.',
      'O botão "Processar Documento IA" ou "Nova Escritura" permite criar escrituras adicionais.',
    ],
    relatedTopicIds: ['admin-investimentos-aportes', 'investor-contrato-cautela'],
  },
  {
    id: 'admin-investimentos-aportes',
    title: 'Cadastro de Investidores, Produtos e Aprovação de Aportes',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gestão de Produtos e Aprovações de Aportes',
    keywords: [
      'investidor',
      'aportes',
      'aprovacao aporte',
      'produtos',
      'captacao',
      'conferir comprovante',
      'debenturista',
      'carteira investidores',
      'aprovar investimento',
    ],
    summary:
      'Como criar produtos de captação, monitorar subscrições e aprovar comprovantes de aportes dos investidores.',
    steps: [
      'Para cadastrar novos produtos de debênture: Menu lateral > "Gestão de Produtos" > "Novo Produto" (defina título, taxa ao ano/mês, carência mínima, prazo e tipo de juros simples ou composto).',
      'Quando um investidor realiza uma subscrição e anexa o comprovante (PIX/TED), a solicitação surge em "Aprovações de Aportes".',
      'Acesse "Aprovações de Aportes" e localize o registro com status "Em Análise" (awaiting_review).',
      'Clique em "Ver Comprovante" para inspecionar o arquivo anexado pelo investidor.',
      'Confirme se o valor creditado bate com o extrato bancário da conta da securitizadora.',
      'Clique em "Aprovar Aporte". O sistema atualiza o status para "approved", inicia a contagem de rendimentos na data informada e alimenta a entrada no Livro Caixa.',
    ],
    tips: [
      'Ao aprovar o aporte, o investidor passa a ter acesso imediato ao Termo de Subscrição formal e à Cautela de Debêntures em PDF.',
      'Para aportes manuais ou ajustes de rentabilidade atípica, use "Manual Yield Entries" na gestão do produto.',
    ],
    relatedTopicIds: [
      'admin-debentures-escritura',
      'admin-resgates-investidor',
      'investor-checkout',
    ],
  },
  {
    id: 'admin-resgates-investidor',
    title: 'Gestão de Resgates de Investidores',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Aprovações de Aportes (aba Resgates) ou Carteira de Investidores',
    keywords: [
      'resgate',
      'saque investidor',
      'carência',
      'liquidar resgate',
      'penalidade',
      'cotizacao',
      'devolucao debenture',
      'pagar resgate',
    ],
    summary:
      'Como aprovar, liquidar e gerenciar resgates de cotas de debêntures solicitados pelos investidores.',
    steps: [
      'Acesse "Aprovações de Aportes" e selecione a aba ou visualização de solicitações de resgate (ou através da Carteira de Investidores).',
      'Analise os parâmetros do resgate: data do pedido, quantidade de cotas solicitadas, cumprimento da carência mínima contratual e eventual incidência de deságio/penalidade por resgate antecipado.',
      'Verifique a disponibilidade de saldo na conta bancária de origem da securitizadora.',
      'Efetue a transferência bancária ao investidor exclusivamente para a conta bancária homologada no perfil KYC dele.',
      'Clique em "Confirmar Liquidação de Resgate", informe a data efetiva da operação e anexe o comprovante de transferência bancária.',
      'O sistema registra automaticamente a saída financeira no Livro Caixa (categoria "Resgate de Investimento") e debita o saldo de cotas ativas da carteira do investidor.',
    ],
    tips: [
      'Se o investidor solicitar resgate antes da carência mínima, o sistema calcula a penalidade conforme parametrizado no produto (early_redemption_penalty_pct).',
      'O investidor recebe notificação no dashboard e pode baixar o comprovante do demonstrativo de resgate.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-livro-caixa',
      'investor-resgate',
      'debentures-regime-mensal',
    ],
  },
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
    title: 'Fornecedores & Despesas: Lançamento e Anexo de Nota Fiscal',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Fornecedores & Despesas',
    keywords: [
      'despesas',
      'fornecedores',
      'nota fiscal',
      'nf',
      'anexo nf',
      'comprovante despesa',
      'livro caixa despesa',
      'pagar fornecedor',
      'categoria despesa',
      'lalur sem nf',
    ],
    summary:
      'Gestão de fornecedores cadastrados, agendamento de contas a pagar, liquidação com anexo de Nota Fiscal e impacto tributário.',
    steps: [
      'Acesse "Fornecedores & Despesas" no menu lateral.',
      'Para cadastrar parceiro: na aba Fornecedores, clique em "Novo Fornecedor" e preencha Razão Social, CNPJ/CPF válido, categoria e contato.',
      'Para lançar uma despesa simples: clique em "Nova Despesa", selecione o fornecedor, informe a descrição clara, o valor em R$, a categoria contábil e a data de vencimento.',
      'Se a despesa já estiver quitada, marque o status como "Pago", indique a Data de Pagamento e selecione a Conta Bancária da securitizadora.',
      'No campo "Anexo de Nota Fiscal / Comprovante", faça o upload do arquivo PDF ou imagem da NF-e.',
      'Clique em "Salvar Despesa". Quando marcada como paga, o sistema gera a respectiva saída no Livro Caixa.',
    ],
    tips: [
      'IMPORTÂNCIA FISCAL (LALUR): Gastos com fornecedores SEM nota fiscal anexada (apenas recibos simples) são considerados indedutíveis pelo fisco e serão adicionados ao LAIR na apuração do Lucro Real (Adição LALUR).',
      'Sempre anexe o documento fiscal idôneo para evitar tributação indevida de IRPJ/CSLL.',
      'Para despesas que se repetem todo mês (aluguel, sistemas, assessoria contábil), utilize a opção "Despesa recorrente" no formulário.',
    ],
    relatedTopicIds: [
      'admin-despesas-recorrentes',
      'admin-livro-caixa',
      'admin-dre-dfc',
      'admin-relatorios-tributario',
    ],
  },
  {
    id: 'admin-resgates-investidor',
    title: 'Gestão de Resgates de Investidores',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Aprovações de Aportes (aba Resgates) ou Carteira de Investidores',
    keywords: [
      'resgate',
      'saque investidor',
      'carência',
      'liquidar resgate',
      'penalidade',
      'cotizacao',
      'devolucao debenture',
      'pagar resgate',
    ],
    summary:
      'Como aprovar, liquidar e gerenciar resgates de cotas de debêntures solicitados pelos investidores.',
    steps: [
      'Acesse "Aprovações de Aportes" e selecione a aba ou visualização de solicitações de resgate (ou através da Carteira de Investidores).',
      'Analise os parâmetros do resgate: data do pedido, quantidade de cotas solicitadas, cumprimento da carência mínima contratual e eventual incidência de deságio/penalidade por resgate antecipado.',
      'Verifique a disponibilidade de saldo na conta bancária de origem da securitizadora.',
      'Efetue a transferência bancária ao investidor exclusivamente para a conta bancária homologada no perfil KYC dele.',
      'Clique em "Confirmar Liquidação de Resgate", informe a data efetiva da operação e anexe o comprovante de transferência bancária.',
      'O sistema registra automaticamente a saída financeira no Livro Caixa (categoria "Resgate de Investimento") e debita o saldo de cotas ativas da carteira do investidor.',
    ],
    tips: [
      'Se o investidor solicitar resgate antes da carência mínima, o sistema calcula a penalidade conforme parametrizado no produto (early_redemption_penalty_pct).',
      'O investidor recebe notificação no dashboard e pode baixar o comprovante do demonstrativo de resgate.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-livro-caixa',
      'investor-resgate',
      'debentures-regime-mensal',
    ],
  },
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
  {
    id: 'admin-resgates-investidor',
    title: 'Gestão de Resgates de Investidores',
    roles: ['admin', 'staff'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Aprovações de Aportes (aba Resgates) ou Carteira de Investidores',
    keywords: [
      'resgate',
      'saque investidor',
      'carência',
      'liquidar resgate',
      'penalidade',
      'cotizacao',
      'devolucao debenture',
      'pagar resgate',
    ],
    steps: [
      'Acesse "Aprovações de Aportes" e selecione a visualização de solicitações de resgate.',
      'Analise os parâmetros do resgate: data do pedido, quantidade de cotas, se o aporte já cumpriu a carência mínima contratual e eventual deságio por resgate antecipado.',
      'Verifique o saldo disponível na conta bancária de origem da securitizadora.',
      'Realize a transferência bancária ao investidor para a conta previamente cadastrada no perfil KYC dele.',
      'Clique em "Confirmar Liquidação de Resgate", informe a data e anexe o comprovante de saída.',
      'O sistema registra automaticamente a saída no Livro Caixa na categoria "Resgate de Investimento" e debita as cotas ativas da carteira do investidor.',
    ],
    tips: [
      'Se o investidor solicitar resgate antes da carência mínima, o sistema calcula a penalidade conforme parametrizado no produto (early_redemption_penalty_pct).',
      'O investidor recebe notificação no dashboard e pode baixar o comprovante do demonstrativo de resgate.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-livro-caixa',
      'investor-resgate',
      'debentures-regime-mensal',
    ],
  },
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
=======
  {
    id: 'admin-despesas-nf',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
=======
    relatedTopicIds: ['admin-investimentos-aportes', 'admin-livro-caixa', 'investor-resgate', 'debentures-regime-mensal'],
  },
  {
    id: 'debentures-regime-mensal',
=======
    tips: [
      'Se o investidor solicitar resgate antes da carência mínima, o sistema calcula a penalidade conforme parametrizado no produto (early_redemption_penalty_pct).',
      'O investidor recebe notificação no dashboard e pode baixar o comprovante do demonstrativo de resgate.',
    ],
    relatedTopicIds: ['admin-investimentos-aportes', 'admin-livro-caixa', 'investor-resgate', 'debentures-regime-mensal'],
  },
  {
    id: 'debentures-regime-mensal',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
=======
    relatedTopicIds: ['admin-investimentos-aportes', 'admin-livro-caixa', 'investor-resgate', 'debentures-regime-mensal'],
  },
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
=======
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
<<<<<<< SEARCH
  {
    id: 'debentures-regime-mensal',
=======
  {
    id: 'admin-despesas-nf',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'Acesse "Aprovações de Aportes" e selecione a visualização de solicitações de resgate.',
      'Analise os parâmetros do resgate: data do pedido, quantidade de cotas, se o aporte já cumpriu a carência mínima contratual e eventual deságio por resgate antecipado.',
      'Verifique o saldo disponível na conta bancária de origem da securitizadora.',
      'Realize a transferência bancária ao investidor para a conta previamente cadastrada no perfil KYC dele.',
      'Clique em "Confirmar Liquidação de Resgate", informe a data e anexe o comprovante de saída.',
      'O sistema registra automaticamente a saída no Livro Caixa na categoria "Resgate de Investimento" e debita as cotas ativas da carteira do investidor.',
    ],
    tips: [
      'Se o investidor solicitar resgate antes da carência mínima, o sistema calcula a penalidade conforme parametrizado no produto (early_redemption_penalty_pct).',
      'O investidor recebe notificação no dashboard e pode baixar o comprovante do demonstrativo de resgate.',
    ],
    relatedTopicIds: ['admin-investimentos-aportes', 'admin-livro-caixa', 'investor-resgate', 'debentures-regime-mensal'],
  },
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
<<<<<<< SEARCH
  {
    id: 'debentures-regime-mensal',
=======
  {
    id: 'admin-despesas-nf',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
<<<<<<< SEARCH
  {
    id: 'debentures-regime-mensal',
    title: 'Debêntures: Regime de Rendimento Mensal e Resgate com Cotas Preservadas',
    roles: ['admin', 'investor', 'staff', 'accountant'],
    category: 'investor',
    navigationPath:
      'Admin: Menu lateral > Gestão de Produtos | Investidor: Dashboard > "Resgatar Rendimentos do Mês"',
    keywords: [
      'juros mensais',
      'resgate mensal',
      'rendimento mensal',
      'regime de rendimentos',
      'cotas preservadas',
      'resgatar rendimentos',
      'regime mensal',
      'debentures rendimento mensal',
      'pagamento mensal de juros',
      'rendimento periodico',
    ],
    summary:
      'Como funciona o regime de rendimentos mensais em debêntures: cadastro pelo administrador, resgate periódico pelo investidor mantendo 100% das cotas e do principal ativos, carência e projeção no fluxo de caixa.',
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    steps: [
      'COMO O ADMINISTRADOR CADASTRA:',
      '  1. Acesse o menu lateral "Gestão de Produtos" > "Novo Produto" (ou clique em editar um produto existente).',
      '  2. Localize o campo "Regime de Rendimentos" e selecione a opção "Juros Mensais" (yield_payment_regime = "monthly").',
      '  3. Defina o "Dia Base de Liberação no Mês" (monthly_payment_day, padrão dia 1º). Este dia determina quando o rendimento da competência anterior fica liberado para saque.',
      '  4. Configure taxa de juros (ao mês/ano), carência mínima (se houver) e valor unitário da cota.',
      'COMO O INVESTIDOR RESGATA RENDIMENTOS DO MÊS:',
      '  1. No Dashboard do Investidor, localize o card do produto com regime mensal.',
      '  2. Quando a competência estiver liberada, clique no botão destacado "Resgatar Rendimentos do Mês".',
      '  3. O sistema calcula automaticamente o rendimento pro rata do período, deduz o IRRF retido na fonte conforme a tabela regressiva e apresenta o valor líquido a receber.',
      '  4. Confirme os dados bancários e finalize a solicitação.',
      'COTAS E PRINCIPAL 100% PRESERVADOS:',
      '  - Diferente do resgate parcial ou total, o resgate exclusivo de rendimento (redemption_type = "interest_only") NÃO consome nenhuma cota (0 cotas resgatadas).',
      '  - O valor principal investido e a totalidade das cotas permanecem integralmente investidos e continuam rendendo juros compostos ou simples nos meses subsequentes.',
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
      'DIFERENÇA PARA JUROS ACUMULADOS:',
      '  - No regime "Juros Acumulados" (padrão de mercado / accumulated), os rendimentos são capitalizados e só saem do fundo no momento do resgate parcial ou total de cotas.',
      '  - No regime "Juros Mensais", o investidor tem a opção de sacar o fluxo de renda passiva mensalmente sem diminuir sua posição acionária/debenturária.',
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
=======
      'REGRA DE CARÊNCIA:',
      '  - Caso o produto possua carência mínima (ex.: 6 ou 12 meses), o botão de resgate mensal só é desbloqueado após decorrido o prazo contratual de carência a contar da data de aporte.',
    ],
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
    title: 'Gerentes de Crédito: Comissões, Pagamento e Emissão de Recibo Oficial',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Gerentes de Crédito',
    keywords: [
      'gerente de credito',
      'comissao',
      'pagar comissao',
      'recibo comissao',
      'desagio',
      'percentual comissao',
      'competencia',
      'recibo oficial',
      'quitacao',
    ],
    summary:
      'Controle dos originadores de crédito, apuração automática de comissões por competência, pagamento no Livro Caixa e impressão de recibo.',
    steps: [
      'Acesse "Gerentes de Crédito" no menu lateral.',
      'Para cadastrar um originador: clique em "Novo Gerente", preencha nome completo, CPF válido, dados de contato e os percentuais padrão de comissão (% sobre deságio de antecipação e % sobre CCB).',
      'Na aba superior, selecione a "Competência" desejada (mês/ano YYYY-MM). O sistema apura automaticamente todas as operações vinculadas àquele gerente liquidadas no mês.',
      'Expanda o cartão do gerente para auditar cada operação originada, valor de face, deságio gerado e comissão apurada.',
      'Para pagar a comissão: clique no botão "Pagar Comissão" na linha do gerente.',
      'Selecione a Conta Bancária da securitizadora de onde sairá o recurso, confirme a data de pagamento e clique em "Confirmar Pagamento".',
      'O sistema lança automaticamente a saída no Livro Caixa (categoria "Comissão Gerente de Crédito") e vincula a quitação.',
      'Após o pagamento, o botão "Imprimir Recibo" fica habilitado. Clique nele para gerar e imprimir o recibo formal com termo de quitação, assinatura digital e identificação da securitizadora.',
    ],
    tips: [
      'Você também pode exportar todo o relatório consolidado de comissões em formato CSV clicando em "Exportar CSV".',
      'Se um gerente for desativado, ele não poderá ser vinculado a novos borderôs, mas o histórico permanece preservado.',
    ],
    relatedTopicIds: [
      'admin-livro-caixa',
      'admin-despesas-nf',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'admin-despesas-nf',
=======
    tips: [
      'FILA DE RESGATES DO ADMIN: Os resgates de juros mensais aparecem na Fila de Resgates com o selo verde "Rendimento Mensal (Cotas Preservadas)" e indicação clara de 0 cotas baixadas.',
      'MODAL DE APROVAÇÃO: Ao liquidar, um card verde confirma que a liquidação paga apenas os juros da competência e que o principal continua ativo.',
      'FLUXO DE CAIXA PROJETADO: O relatório "Fluxo de Caixa Projetado" inclui automaticamente essas saídas mensais de juros (origem "Juros Mensais — Debênture") para todas as aplicações ativas em regime mensal, respeitando a carência e suprimindo meses já pagos ou solicitados.',
    ],
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
    relatedTopicIds: [
      'admin-investimentos-aportes',
      'admin-resgates-investidor',
      'investor-resgate',
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
      'admin-relatorios-fluxo-caixa-projetado',
    ],
  },
  {
    id: 'admin-gerentes-comissoes',
=======
  {
    id: 'admin-despesas-recorrentes',
    title: 'Despesas Recorrentes: Lançamento em Parcelas Mensais Subsequentes',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath:
      'Menu lateral > Fornecedores & Despesas (rota /admin/expenses) > Botão "Nova Despesa"',
    keywords: [
      'despesa recorrente',
      'despesas recorrentes',
      'parcelas mensais',
      'recorrencia',
      'mesmo dia',
      'meses subsequentes',
      'quantidade de parcelas',
      'aluguel recorrente',
      'software mensal',
      'contas a pagar recorrentes',
      'fluxo projetado recorrente',
    ],
    summary:
      'Como lançar despesas fixas ou parceladas com repetição automática no mesmo dia dos meses subsequentes, controle de quantidade de parcelas e projeção no Fluxo de Caixa.',
    steps: [
      'Acesse a tela "Fornecedores & Despesas" pelo menu lateral (rota /admin/expenses).',
      'Na aba "Lançamentos (Contas a Pagar)", clique no botão "Nova Despesa".',
      'No topo do formulário, ative a opção "Despesa recorrente".',
      'Preencha o Fornecedor e a Descrição Base do contrato (ex.: "Aluguel Sede", "Licença Cloud", "Honorários Contábeis"). Cada parcela receberá automaticamente o sufixo "— Parcela X/N".',
      'Selecione a Categoria e a Data de Vencimento da 1ª Parcela (ex.: 15/03/2026). As parcelas subsequentes repetirão no mesmo dia de cada mês (ou no último dia útil do mês caso fevereiro ou meses de 30 dias não possuam o dia informado).',
      'No quadro de configuração de recorrência:',
      '  - Informe a "Quantidade de Parcelas (Meses)" desejada (ex.: 12 para 1 ano de contrato).',
      '  - Escolha o critério de valor: "Valor por Parcela (R$/mês)" se souber a mensalidade exata, ou "Valor Total do Contrato" para o sistema dividir automaticamente em N parcelas iguais com ajuste de centavos.',
      'Confira o Demonstrativo em Tempo Real na tela: o sistema exibe o valor de cada parcela, o total geral e as datas dos vencimentos calculados.',
      'Defina o status da 1ª Parcela (se já foi paga no ato ou se fica pendente) e a Conta Bancária da securitizadora.',
      'Clique em "Gerar N Parcelas Recorrentes". Todas as parcelas são criadas no Contas a Pagar com vínculo seguro de grupo (recurrence_group_id) e log de auditoria.',
      'Acompanhamento e Baixa: na listagem de despesas, use os botões de filtro rápido "Todas", "Recorrentes" ou filtre por grupo específico. Conforme os meses avançam, dê a baixa individual de cada parcela pelo botão de check.',
    ],
    tips: [
      'IMPACTO NO FLUXO DE CAIXA PROJETADO: Todas as parcelas futuras com status pendente aparecem automaticamente no relatório "Fluxo de Caixa Projetado" no respectivo mês de vencimento, compondo a projeção de liquidez da empresa.',
      'Se a 1ª parcela for marcada como "Pago", ela debita a tesouraria imediatamente; as parcelas seguintes (2..N) entram como "Pendente" para controle mensal.',
    ],
    relatedTopicIds: [
      'admin-despesas-nf',
      'admin-relatorios-fluxo-caixa-projetado',
      'admin-livro-caixa',
    ],
  },
  {
    id: 'admin-livro-caixa',
    title: 'Contabilidade & Livro Caixa (Movimentações Financeiras)',
    roles: ['admin', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Contabilidade & Fiscal',
    keywords: [
      'livro caixa',
      'contabilidade',
      'entradas',
      'saidas',
      'saldo acumulado',
      'conciliacao',
      'reconciliar',
      'movimentacoes caixa',
      'extrato contabilidade',
    ],
    summary:
      'Visão consolidada direta das fontes primárias de receitas, desembolsos, pagamentos de despesas e conciliação bancária.',
    steps: [
      'Acesse "Contabilidade & Fiscal" no menu lateral.',
      'No cabeçalho, acompanhe os quatro cards consolidados: Total Entradas (Período), Total Saídas (Período), Fluxo Líquido e Saldo Acumulado Global.',
      'Utilize a barra de filtros para segmentar por Data Inicial/Final, Tipo (Entradas ou Saídas), Categoria (Recebimento CCB, Liquidação de Recebível, Despesas, Aporte, etc.) e Conta Bancária.',
      'Para conferir e bater lançamentos com o banco, clique no botão "Reconciliar" para abrir o ReconcileModal.',
      'Para exportar os registros contábeis auditáveis, clique em "CSV" para baixar a planilha estruturada ou em "PDF" para imprimir.',
    ],
    tips: [
      'Usuários com permissão administrativa podem excluir registros financeiros elegíveis com justificativa formal pelo botão de lixeira.',
      'O Livro Caixa consolida automaticamente todas as pontas do sistema (operações de crédito, debêntures, despesas e comissões).',
    ],
    relatedTopicIds: ['admin-despesas-nf', 'admin-dre-dfc', 'admin-relatorios-tributario'],
  },
  {
    id: 'admin-dre-dfc',
    title: 'Demonstrativos Contábeis: DRE e DFC (FASB-95)',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > DRE (ou DFC)',
    keywords: [
      'dre',
      'dfc',
      'demonstrativo de resultado',
      'fluxo de caixa',
      'fasb95',
      'receita bruta',
      'ebitda',
      'lair',
      'lucro liquido',
      'caixa operacional',
    ],
    summary:
      'Como acompanhar o Demonstrativo do Resultado do Exercício e o Demonstrativo de Fluxo de Caixa pelo método contábil FASB-95.',
    steps: [
      'Para a DRE: acesse "DRE" no menu lateral. Escolha o período (mês ou intervalo de datas).',
      'Analise a cascata contábil: Receita Bruta de Operações (deságio de recebíveis e juros CCB) deduzida de impostos diretos, apurando a Receita Líquida.',
      'Observe os Custos de Captação (rendimentos das debêntures) e as Despesas Operacionais (administrativas, comissões e fornecedores) para chegar ao LAIR (Lucro Antes do IR) e Lucro Líquido.',
      'Para a DFC: acesse "DFC" no menu lateral. A visualização segue a norma FASB-95 dividida em três macroatividades: Atividades Operacionais, Atividades de Investimento e Atividades de Financiamento.',
      'Utilize os botões de exportação em cada tela para gerar relatórios contábeis oficiais para auditoria ou investidores fiduciários.',
    ],
    tips: [
      'A DRE reflete o regime de competência, enquanto a DFC e o Livro Caixa refletem o regime de caixa efetivo.',
      'O LAIR apurado na DRE serve de ponto de partida direto para os Ajustes do LALUR no fechamento tributário.',
    ],
    relatedTopicIds: ['admin-livro-caixa', 'admin-relatorios-tributario'],
  },
  {
    id: 'admin-relatorios-tributario',
    title: 'Relatórios Fiscais e Tributação Securitizadora (LAIR/LALUR/Lucro Real)',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Relatórios > Aba "Operações do Período"',
    keywords: [
      'relatorios',
      'operacoes do periodo',
      'tributario',
      'lucro real',
      'lair',
      'lalur',
      'pis',
      'cofins',
      'irpj',
      'csll',
      'adicao lalur',
      'impostos securitizadora',
    ],
    summary:
      'Regras fiscais completas da securitizadora de crédito e emissão do relatório de fechamento tributário mensal.',
    steps: [
      'Acesse "Relatórios" no menu lateral e clique na aba "Operações do Período".',
      'Defina o mês de competência desejado (ex.: mês corrente) para carregar todos os dados.',
      'Role até a seção detalhada "Apuração Tributária da Securitizadora":',
      '  - PIS (0,65%) e COFINS (4,00%): calculados cumulativamente sobre a Receita Bruta Operacional, DEDUZINDO da base as despesas de captação (rendimentos pagos aos investidores das debêntures).',
      '  - IOF: isento para securitizadoras de créditos conforme legislação federal.',
      '  - ISS: não incide sobre atividades típicas de securitização.',
      '  - LAIR: Lucro Antes do Imposto de Renda apurado no período.',
      '  - Ajustes LALUR: despesas de fornecedores sem nota fiscal (apenas recibo) são somadas como Adição ao LALUR.',
      '  - IRPJ (15%): calculado sobre o Lucro Real (LAIR + Adições LALUR) + Adicional de 10% sobre a parcela do lucro que exceder R$ 20.000 no mês.',
      '  - CSLL (9%): calculado sobre a base do Lucro Real ajustado.',
      'Ao final da tela, clique em "Exportar Relatório Fiscal (CSV)" ou "Imprimir Relatório Tributário" para enviar à contabilidade.',
    ],
    tips: [
      'Securitizadoras de créditos são obrigatoriamente enquadradas no regime de Lucro Real.',
      'A dedução das despesas de captação na base de PIS/COFINS é assegurada pela Lei 9.718/1998 e jurisprudência consolidada.',
    ],
    relatedTopicIds: ['admin-dre-dfc', 'admin-relatorios-unificado', 'admin-despesas-nf'],
  },
  {
    id: 'admin-relatorios-unificado',
    title: 'Relatórios: Gerador Unificado, Rendimentos e Extrato Bancário',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Relatórios',
    keywords: [
      'relatorios',
      'gerador unificado',
      'rendimentos investidores',
      'extrato bancario',
      'resumo de carteira',
      'subscricoes',
      'aquisicoes',
      'exportar pdf',
    ],
    summary:
      'Acesso aos demonstrativos de rendimentos dos debenturistas, movimentações bancárias e gerador unificado.',
    steps: [
      'Acesse "Relatórios" no menu lateral.',
      'Aba "Gerador Unificado": permite compor um dossiê executivo completo da securitizadora, combinando dados de carteira, inadimplência, captação e resultado em um único relatório para impressão profissional (printIsolatedUnifiedReport).',
      'Aba "Rendimentos dos Investidores": visualize o montante provisionado e pago para cada investidor, segregado por série de debênture, com cálculos de juros acumulados e tributação retida na fonte.',
      'Aba "Extrato de Movimentações Bancárias": relatório conciso de entradas e saídas de cada conta bancária cadastrada da securitizadora.',
      'Aba "Subscrições" e "Aquisições": acompanhe em tabelas filtráveis o fluxo de títulos originados e debêntures emitidas.',
    ],
    tips: [
      'Todos os relatórios contam com botões rápidos de exportação em CSV para importação direta no Excel e impressão com layout corporativo formatado.',
    ],
    relatedTopicIds: [
      'admin-relatorios-tributario',
      'admin-relatorios-recebiveis-a-receber',
      'admin-investimentos-aportes',
    ],
  },
  {
    id: 'admin-relatorios-fluxo-caixa-projetado',
    title: 'Relatório: Fluxo de Caixa Projetado (Previsão de Liquidez & Tesouraria)',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Relatórios > Aba "Fluxo de Caixa Projetado"',
    keywords: [
      'fluxo de caixa projetado',
      'previsao de caixa',
      'projecao de caixa',
      'fluxo futuro',
      'saldo acumulado',
      'contas a pagar projetadas',
      'resgates projetados',
      'recebiveis futuros manuais',
      'pagamentos futuros manuais',
      'horizonte de projecao',
      'liquidez futura',
      'ponto de partida caixa',
      'saldo inicial em caixa',
      'previsao financeira',
    ],
    summary:
      'Demonstrativo gerencial preditivo de fluxo de caixa da Securitizadora, projetando saídas (contas a pagar e resgates de investidores), entradas (parcelas de recebíveis de antecipação e CCBs) e lançamentos manuais com apuração do saldo acumulado mês a mês.',
    steps: [
      'Acesse "Relatórios" no menu lateral e clique na aba destacada "Fluxo de Caixa Projetado".',
      'Defina o horizonte de projeção pelos filtros no topo:',
      '  - Modo Competência & Horizonte: selecione o Mês de Início e o horizonte futuro desejado (3, 6, 12, 24 meses ou todos os meses).',
      '  - Modo Intervalo: informe livremente a Data Inicial e Data Final para uma janela temporal customizada.',
      'Analise os 5 Cards de Resumo no topo:',
      '  1. Saldo Inicial em Caixa: ponto de partida com o saldo real em caixa das contas bancárias cadastradas no Livro Caixa.',
      '  2. Entradas Projetadas: soma de parcelas a receber (antecipações e CCBs) mais recebíveis manuais futuros.',
      '  3. Saídas Projetadas: soma de contas a pagar em aberto e resgates de cotas (pendentes e término de carência).',
      '  4. Resultado do Período: saldo líquido (Entradas - Saídas) do horizonte selecionado.',
      '  5. Saldo Acumulado Final: caixa inicial somado ao resultado líquido projetado.',
      'COMO ADICIONAR PREVISÕES MANUAIS:',
      '  - Para prever novas receitas ou aportes: clique no botão verde "+ Recebível Futuro", informe descrição, valor, data prevista e categoria.',
      '  - Para prever despesas orçamentárias ou investimentos da empresa: clique no botão vermelho "+ Pagamento Futuro".',
      '  - Você pode editar ou excluir lançamentos manuais a qualquer momento clicando nos ícones da tabela dentro do mês.',
      '  - IMPORTANTE: os lançamentos manuais são puramente preditivos e não impactam o Livro Caixa oficial, DRE ou DFC.',
      'COMO INTERPRETAR O SALDO ACUMULADO:',
      '  - Cada mês exibe seu saldo inicial (que é o saldo final do mês anterior), o montante de entradas, saídas, o resultado líquido do mês e o saldo acumulado final.',
      '  - Se o saldo acumulado final ficar negativo em algum mês, o card e o valor ficam em destaque vermelho, alertando a administração para necessidade de captação de recursos ou remanejamento de vencimentos.',
      'EXPORTAÇÃO:',
      '  - Clique em "Exportar CSV" para baixar a planilha detalhada com todos os lançamentos e linha de totais.',
      '  - Clique em "Imprimir / PDF" para gerar o relatório impresso com o nome do arquivo e cabeçalho institucional formatado.',
    ],
    tips: [
      'O relatório consolida tanto resgates pendentes já solicitados quanto resgates previstos pelo término da carência contratual das debêntures ativas.',
      'Use o filtro de Origem para isolar apenas Despesas, apenas Resgates, apenas Recebíveis ou apenas Lançamentos Manuais.',
    ],
    relatedTopicIds: [
      'admin-relatorios-recebiveis-a-receber',
      'admin-relatorios-unificado',
      'admin-parametros-securitizadora',
    ],
  },
  {
    id: 'admin-relatorios-recebiveis-a-receber',
    title: 'Relatório: Recebíveis a Receber (Posição Futura de Caixa da Carteira)',
    roles: ['admin', 'staff', 'accountant'],
    category: 'admin',
    navigationPath: 'Menu lateral > Relatórios > Aba "Recebíveis a Receber"',
    keywords: [
      'recebiveis a receber',
      'recebiveis pendentes',
      'posicao futura',
      'fluxo futuro',
      'entradas de caixa',
      'aging de recebiveis',
      'parcelas a vencer',
      'parcelas vencidas',
      'duplicatas a receber',
      'ccbs a receber',
      'cronograma de parcelas',
      'filtro competencia',
      'filtro periodo',
      'relatorio recebiveis',
    ],
    summary:
      'Demonstrativo analítico do fluxo futuro de caixa da securitizadora, consolidando recebíveis de antecipação (duplicatas, cheques) e parcelas de CCB a receber com filtros de período e aging de atraso.',
    steps: [
      'Acesse "Relatórios" no menu lateral e clique na aba destacada "Recebíveis a Receber".',
      'Escolha o modo de filtro desejado:',
      '  - Modo Competência: selecione o Mês e Ano de vencimento (histórico de até 36 meses atrás a 24 meses futuros ou "Todos os Meses").',
      '  - Modo Intervalo: informe a Data Inicial e Data Final para uma janela personalizada de vencimentos.',
      'Refine pelos filtros adicionais: tipo de operação (Todas, Antecipações ou CCBs), situação (A Vencer, Vencido, Prorrogado) e busca por nome ou documento.',
      'Para conferir parcelas que já foram quitadas dentro do corte selecionado, marque a opção "Incluir parcelas já recebidas/liquidadas no período".',
      'Analise os indicadores de topo: Total a Receber no Filtro, Parcelas Vencidas em Atraso, subtotal por tipo (Antecipações vs CCBs) e parcelas A Vencer em dia.',
      'Caso existam parcelas vencidas, confira o card de Aging da Carteira em Atraso (faixas: até 30 dias, 31 a 60, 61 a 90 e >90 dias).',
      'Para exportar os dados para auditoria ou contabilidade: clique em "Baixar Planilha CSV" ou "Imprimir / Salvar PDF" (com formatação corporativa, cabeçalho da Securitizadora e paginação automática sem cortes).',
    ],
    tips: [
      'O relatório é somente leitura e reflete as datas reais de vencimento e valores de cada título contratado na esteira da Securitizadora.',
      'Valores prorrogados na mesa de operações já incorporam automaticamente os juros e encargos pactuados no valor total devido da parcela.',
    ],
    relatedTopicIds: [
      'admin-relatorios-fluxo-caixa-projetado',
      'admin-relatorios-unificado',
      'admin-lancar-operacao',
      'admin-ccb-purchases',
    ],
  },
  {
    id: 'admin-parametros-securitizadora',
    title: 'Parâmetros & Configurações: Dados da Securitizadora e Taxas Globais',
    roles: ['admin'],
    category: 'admin',
    navigationPath: 'Menu lateral > Parâmetros Financeiros',
    keywords: [
      'parametros',
      'configuracoes',
      'dados securitizadora',
      'razao social',
      'cnpj',
      'preambulo',
      'taxas globais',
      'parametros ccb',
      'contas bancarias',
      'multa e juros',
    ],
    summary:
      'Manutenção cadastral da empresa (endereço, preâmbulo de contratos), taxas de juros, multas e parâmetros operacionais de CCB.',
    steps: [
      'Acesse "Parâmetros Financeiros" no menu lateral.',
      'Aba "Dados da Securitizadora" (CompanySettingsForm): informe Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, NIRE/Junta, endereço completo com CEP e dados de contato. Esses dados alimentam automaticamente o preâmbulo de todos os contratos, recibos e termos gerados.',
      'Aba "Configuração de CCB" (CcbParametersForm): defina taxas mínimas e máximas de juros ao mês, percentual de IOF, prazos de carência e parceiro bancário padrão.',
      'Aba "Parâmetros Gerais" (GlobalParametersForm): configure taxa de juros de mora diária, percentual de multa por atraso e parâmetros aplicáveis à mesa de antecipação.',
      'Clique em "Salvar Configurações" na respectiva aba para aplicar as novas regras imediatamente em todo o sistema.',
    ],
    tips: [
      'Para cadastrar as contas correntes bancárias e chaves PIX da empresa, acesse "Contas Bancárias" no menu lateral.',
    ],
    relatedTopicIds: ['admin-debentures-escritura', 'admin-tomador-limite'],
  },

  // ==========================================
  // INVESTIDOR
  // ==========================================
  {
    id: 'investor-autorizacao-lancamento-interno',
    title: 'Investidor: Como Autorizar Investimento Lançado Internamente pelo Admin',
    roles: ['investor', 'admin', 'staff'],
    category: 'investor',
    navigationPath:
      'Menu lateral > Dashboard > Card/Banner "Autorização de Investimento Pendente" ou listagem de Aportes',
    keywords: [
      'autorizar investimento',
      'autorizacao investidor',
      'aceite lancamento interno',
      'confirmar aporte',
      'aceite aporte admin',
      'lancamento interno',
      'aguardando autorizacao',
      'solicitar revisao',
      'contestar aporte',
      'termo de subscricao interno',
      'aceite do investidor',
      'aceite',
    ],
    summary:
      'Fluxo obrigatório em que o investidor confere o contrato e autoriza expressamente um aporte em debêntures lançado internamente pela administração.',
    steps: [
      'Quando a administração lança um investimento para você internamente, um card/banner âmbar em destaque surge no topo do seu "Dashboard do Investidor" indicando "Autorização de Investimento Pendente".',
      'Clique no botão "Revisar e Autorizar Aporte" no banner, ou no botão "Autorizar Investimento" no card do aporte com o selo "Aguardando sua autorização".',
      'O sistema abre o diálogo "Autorização de Investimento Lançado", apresentando o produto, valor total, quantidade de cotas, rentabilidade contratual e carência mínima.',
      'LEITURA PRÉVIA DO CONTRATO: Clique no botão "Ver Contrato (PDF)" para abrir e ler o Termo de Subscrição de Debêntures gerado na íntegra por dentro da plataforma (imune a bloqueadores).',
      'PARA CONFIRMAR O ACEITE: Marque a caixa de declaração de ciência e clique em "Confirmar Aceite e Autorizar". O sistema registra o carimbo temporal oficial e seu endereço de conexão autenticado (MP 2.200-2/2001 e Lei 14.063/2020), atualizando o status para "Aceito pelo investidor em DD/MM/AAAA".',
      'SE NÃO RECONHECER OU DESEJAR AJUSTES: Clique no link "Não reconhece este investimento ou deseja retificação? Solicitar revisão", descreva a divergência no campo de texto e clique em "Enviar Solicitação de Revisão". Uma notificação prioritária é enviada para os administradores revisarem o caso sem alterar seus saldos financeiros de forma indevida.',
    ],
    tips: [
      'A confirmação do aceite consolida a regularidade contratual do aporte em sua carteira.',
      'A solicitação de revisão não estorna valores automaticamente, garantindo segurança patrimonial para ambas as partes.',
    ],
    relatedTopicIds: [
      'investor-contrato-cautela',
      'admin-investimentos-aportes',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'investor-checkout',
    title: 'Investidor: Como Fazer um Investimento e Enviar Comprovante (Checkout)',
    roles: ['investor'],
    category: 'investor',
    navigationPath: 'Menu lateral > Investimentos > Botão "Investir Agora"',
    keywords: [
      'investir',
      'checkout',
      'comprovante pix',
      'transferencia',
      'ted',
      'fazer investimento',
      'subscricao',
      'como investir',
      'novo aporte',
    ],
    summary:
      'Passo a passo para o investidor escolher um produto de debênture, subscrever cotas e anexar comprovante de aporte.',
    steps: [
      'Acesse "Investimentos" no menu lateral.',
      'Analise a vitrine de produtos de debêntures disponíveis (remuneração ao ano, prazo mínimo de carência e valor unitário da cota).',
      'Clique em "Investir Agora" no produto desejado para abrir a tela de subscrição e simulação.',
      'Indique a quantidade de cotas que deseja subscrever. O sistema calcula o valor total do investimento.',
      'Leia e confirme a aceitação do Termo de Subscrição de Debêntures. O contrato digital é formalizado.',
      'Você será direcionado para a tela de Confirmação de Depósito (InvestmentCheckout).',
      'Copie os dados bancários da conta da Securitizadora ou utilize a chave PIX informada no quadro de transferência.',
      'Realize o pagamento no app do seu banco.',
      'Na seção "Envio de Comprovante", informe a data exata da transferência, o valor transferido e anexe o comprovante (PDF ou foto).',
      'Clique em "Enviar para Conferência". Sua aplicação entrará com status "Em Análise". Assim que a equipe conferir o crédito, seu investimento começará a render.',
    ],
    tips: [
      'Na própria tela de checkout e no seu painel, você já pode clicar em "Ver Documento" ou baixar o contrato em PDF assinado.',
      'Assim que aprovado, a contagem de rentabilidade tem início na data de crédito pactuada.',
    ],
    relatedTopicIds: ['investor-contrato-cautela', 'investor-rendimentos', 'investor-resgate'],
  },
  {
    id: 'investor-contrato-cautela',
    title: 'Investidor: Ver e Baixar Contrato de Subscrição e Cautela de Debênture',
    roles: ['investor', 'admin', 'staff'],
    category: 'investor',
    navigationPath: 'Menu lateral > Dashboard (ou Investimentos) > Coluna "Documentos"',
    keywords: [
      'contrato',
      'cautela',
      'cautela de debenture',
      'termo de subscricao',
      'baixar contrato',
      'ver cautela',
      'download pdf',
      'documentos debenture',
    ],
    summary:
      'Localização dos botões para visualizar e baixar o Termo de Subscrição formal e a Cautela numerada de debêntures.',
    steps: [
      'Acesse o "Dashboard" do Investidor (ou a tela "Investimentos").',
      'Na listagem de aplicações ativas, localize o investimento desejado no card correspondente.',
      'No bloco "Documentos" do card, você encontrará duas opções oficiais:',
      '  1. Botão "Contrato": clique para abrir o Termo de Subscrição de Debêntures em nova guia do navegador. Ao lado, o ícone de seta para baixo faz o download direto do arquivo PDF.',
      '  2. Botão "Cautela": clique para visualizar o certificado formal de debêntures (cautela numerada com dados da escritura arquivada na Junta Comercial). O ícone de download direto também está disponível.',
      'Ambos os documentos trazem os dados da emissora, carência, número de cotas, rentabilidade acordada e selo de assinatura digital.',
    ],
    tips: [
      'A cautela de debêntures comprova a titularidade dos seus títulos fiduciários perante qualquer terceiro ou custodiante.',
      'Se o documento não abrir, verifique se o bloqueador de pop-ups do seu navegador autorizou a abertura de novas abas.',
    ],
    relatedTopicIds: [
      'investor-checkout',
      'admin-debentures-escritura',
      'transversal-assinatura-eletronica',
    ],
  },
  {
    id: 'investor-rendimentos',
    title: 'Investidor: Acompanhar Rendimentos e Emitir Informe Fiscal (IR)',
    roles: ['investor'],
    category: 'investor',
    navigationPath: 'Menu lateral > Dashboard > Aba "Rendimentos" ou "Informe Fiscal"',
    keywords: [
      'rendimentos',
      'extrato investidor',
      'informe de rendimentos',
      'imposto de renda',
      'irrf',
      'tributacao debenture',
      'juros acumulados',
      'grafico rentabilidade',
    ],
    summary:
      'Como visualizar a evolução patrimonial dos seus investimentos, juros acumulados e gerar o informe para a Receita Federal.',
    steps: [
      'Acesse o "Dashboard" do Investidor.',
      'No topo da tela, consulte o saldo total investido, o montante total de juros acumulados e a rentabilidade média da carteira.',
      'Analise o gráfico dinâmico de evolução patrimonial mensal (com projeção por juros simples ou compostos).',
      'Para detalhes mês a mês: acesse a aba "Extrato de Rendimentos" para conferir os proventos creditados por aporte.',
      'Para Declaração de Imposto de Renda: acesse a aba "Informe Fiscal" (InvestorTaxReport), selecione o ano-base desejado e clique em "Gerar Informe de Rendimentos".',
      'O documento demonstrará os saldos em 31/12 do ano anterior e 31/12 do ano de apuração, rendimentos líquidos auferidos e IRRF retido na fonte pela securitizadora.',
    ],
    tips: [
      'Os rendimentos de debêntures seguem a tabela regressiva de IR (22,5% até 180 dias; 20% de 181 a 360 dias; 17,5% de 361 a 720 dias; 15% acima de 720 dias).',
      'A retenção do imposto é definitiva na fonte no momento do resgate.',
    ],
    relatedTopicIds: ['investor-resgate', 'investor-contrato-cautela'],
  },
  {
    id: 'investor-resgate',
    title: 'Investidor: Como Solicitar Resgate de Cotas',
    roles: ['investor'],
    category: 'investor',
    navigationPath: 'Menu lateral > Dashboard > Botão "Solicitar Saque"',
    keywords: [
      'solicitar saque',
      'resgate investidor',
      'sacar rendimento',
      'resgatar cotas',
      'carencia saque',
      'bloqueio carencia',
      'prazo cotizacao',
    ],
    summary:
      'Instruções sobre como solicitar o resgate total ou parcial das cotas e regras de carência aplicáveis.',
    steps: [
      'Acesse o "Dashboard" do Investidor.',
      'Na lista de aportes aprovados, localize o produto que deseja resgatar.',
      'Verifique o aviso de carência no rodapé do card:',
      '  - Se estiver com selo cinza ("Carência Cumprida"): você pode resgatar livremente sem penalidades.',
      '  - Se estiver com selo âmbar ("Permite Saque com Penalidade"): o resgate antes do prazo pactuado aplicará um desconto percentual previsto no contrato.',
      '  - Se estiver com selo vermelho ("Saque Bloqueado"): a carência mínima contratual ainda está em vigor e o saque só estará liberado após a data informada.',
      'Clique no botão "Solicitar Saque" (InvestorRedemptionDialog).',
      'Indique a quantidade de cotas a resgatar e confira a simulação de valores brutos, descontos eventuais, IR retido e valor líquido a receber.',
      'Confirme seus dados bancários cadastrados no perfil KYC e clique em "Confirmar Solicitação de Resgate".',
      'A equipe da securitizadora processará a transferência bancária conforme o prazo de cotização e liquidação do produto.',
    ],
    tips: [
      'Você pode acompanhar o status da solicitação na aba "Extrato de Resgates" do seu painel.',
    ],
    relatedTopicIds: [
      'investor-rendimentos',
      'investor-contrato-cautela',
      'admin-resgates-investidor',
    ],
  },

  // ==========================================
  // TOMADOR
  // ==========================================
  {
    id: 'borrower-dashboard-visao',
    title: 'Tomador: Painel Geral, Limite Disponível e Vencimentos',
    roles: ['borrower'],
    category: 'borrower',
    navigationPath: 'Menu lateral > Dashboard do Tomador',
    keywords: [
      'dashboard tomador',
      'painel tomador',
      'saldo disponivel tomador',
      'limite tomador',
      'proximo vencimento',
      'recebiveis pendentes',
    ],
    summary:
      'Visão geral das métricas do tomador: limite de crédito total, valor utilizado, saldo disponível e alertas de vencimento.',
    steps: [
      'Ao realizar login como Tomador, você é direcionado automaticamente para o "Dashboard do Tomador".',
      'Observe os três indicadores principais no topo:',
      '  - Saldo Disponível: valor em R$ que sua empresa ainda pode antecipar hoje.',
      '  - Recebíveis Pendentes: total de títulos ou operações atualmente ativas e em cobrança.',
      '  - Próximo Vencimento: data e valor da parcela mais próxima a vencer.',
      'Utilize os botões de atalho: "Simular Agora" para abrir uma nova solicitação de antecipação ou "Ver Minhas Solicitações" para acompanhar a esteira.',
    ],
    tips: [
      'Lembre-se: o limite é liberado automaticamente assim que os sacados ou sua empresa efetuarem a liquidação dos títulos.',
    ],
    relatedTopicIds: ['borrower-nova-operacao', 'borrower-parcelas-pix', 'admin-tomador-limite'],
  },
  {
    id: 'borrower-nova-operacao',
    title: 'Tomador: Solicitar Antecipação de Recebíveis (Borderô)',
    roles: ['borrower'],
    category: 'borrower',
    navigationPath: 'Menu lateral > Dashboard > Aba "Nova Operação" (ou botão "Nova Solicitação")',
    keywords: [
      'solicitar antecipacao',
      'novo bordero tomador',
      'antecipar duplicata',
      'simular antecipacao',
      'enviar nota fiscal',
      'desagio tomador',
    ],
    summary: 'Como simular taxas e enviar duplicatas ou cheques para antecipação de crédito.',
    steps: [
      'No Dashboard do Tomador, clique no botão "Nova Solicitação" ou na aba "Nova Operação".',
      'Insira os dados do Sacado (empresa compradora ou devedora): Razão Social, CNPJ e contato.',
      'Informe o Valor de Face da duplicata e a Data de Vencimento do título.',
      'O simulador interativo exibe na hora a taxa de deságio calculada, as tarifas administrativas e o Valor Líquido que sua empresa receberá na conta bancária cadastrada.',
      'Anexe o documento comprobatório do recebível (arquivo XML da NF-e, DANFE em PDF ou cópia do título).',
      'Clique em "Enviar para Análise".',
      'O comitê de crédito avaliará a idoneidade do sacado e, uma vez aprovada, gerará o Aditivo de Cessão para assinatura eletrônica.',
    ],
    tips: [
      'Certifique-se de que o valor da operação cabe dentro do seu Limite de Crédito Disponível.',
      'Notas fiscais já emitidas com canhoto assinado ou comprovante de entrega têm aprovação mais rápida.',
    ],
    relatedTopicIds: ['borrower-dashboard-visao', 'transversal-assinatura-eletronica'],
  },
  {
    id: 'borrower-ccb-digital',
    title: 'Tomador: Simular e Contratar CCB Digital BDIGITAL',
    roles: ['borrower'],
    category: 'borrower',
    navigationPath: 'Menu lateral > CCB Digital BDIGITAL',
    keywords: [
      'ccb digital',
      'bdigital',
      'simular ccb',
      'solicitar ccb',
      'emprestimo tomador',
      'credito rapido',
      'parcelas ccb tomador',
    ],
    summary:
      'Contratação rápida de crédito via CCB Digital com simulação em tempo real e aprovação bancária simplificada.',
    steps: [
      'Acesse "CCB Digital BDIGITAL" no menu lateral.',
      'Clique no botão destacado "Nova Simulação de CCB" para abrir o assistente CcbWizard.',
      'Defina o Valor Pretendido (a partir de R$ 1.000) e o Prazo em Meses desejado.',
      'O sistema simula imediatamente o valor da parcela mensal, a taxa de juros aplicada e o Custo Efetivo Total (CET).',
      'Preencha os dados complementares de garantia ou faturamento solicitados.',
      'Envie a proposta para o comitê.',
      'Acompanhe o status na aba "Solicitar/Simular CCB". Caso haja contraproposta do banco, o card mudará para "Proposta Ajustada (Ação Necessária)" permitindo que você aprove as novas condições.',
      'Após aprovado e formalizado, a operação migra para a aba "Minhas Operações e Parcelas".',
    ],
    tips: [
      'Você pode baixar o espelho em PDF da CCB a qualquer momento pelo botão "PDF" no histórico de solicitações.',
    ],
    relatedTopicIds: ['borrower-parcelas-pix', 'admin-ccb-purchases'],
  },
  {
    id: 'borrower-parcelas-pix',
    title: 'Tomador: Pagar Parcelas e Boletos de CCB via PIX ou Boleto',
    roles: ['borrower'],
    category: 'borrower',
    navigationPath: 'Menu lateral > Minhas Parcelas CCB',
    keywords: [
      'pagar parcela ccb',
      'pix ccb',
      'boleto ccb',
      'segunda via',
      'minhas parcelas',
      'qr code pix',
      'copia e cola',
      'juros e multa',
    ],
    summary:
      'Como emitir a 2ª via de boletos e gerar código PIX Copia e Cola instantâneo com atualização de juros e multa.',
    steps: [
      'Acesse "Minhas Parcelas CCB" no menu lateral.',
      'Localize o contrato de CCB e a parcela desejada na tabela de vencimentos.',
      'Para pagar via Boleto: clique no botão "Boleto" para baixar ou imprimir a guia bancária com código de barras.',
      'Para pagar via PIX: clique no botão "Código PIX" na linha da parcela.',
      'O sistema abre o diálogo de pagamento PIX em tempo real.',
      'Se a parcela estiver em dia, o valor base será mantido. Caso esteja vencida, o sistema recalcula automaticamente a multa e juros de mora diários de acordo com a carência parametrizada.',
      'Abra o app do seu banco, escolha a opção "PIX" e escaneie o QR Code na tela ou clique em "Copiar Chave PIX" para usar o código Copia e Cola.',
      'Após o pagamento, a baixa é processada e o status muda para "Pago", liberando seu limite de crédito na plataforma.',
    ],
    tips: [
      'Você também pode anexar comprovantes de pagamento caso a quitação tenha sido realizada via transferência direta.',
    ],
    relatedTopicIds: ['borrower-ccb-digital', 'admin-tomador-limite'],
  },

  // ==========================================
  // TRANSVERSAIS (TODOS OS PERFIS)
  // ==========================================
  {
    id: 'transversal-assinatura-eletronica',
    title: 'Assinatura Eletrônica de Documentos (MP 2.200-2/2001 e Lei 14.063/2020)',
    roles: ['all'],
    category: 'transversal',
    navigationPath: 'Aviso flutuante de assinaturas pendentes ou tela do respectivo documento',
    keywords: [
      'assinatura eletronica',
      'docusign',
      'validade juridica',
      'lei 14063',
      'mp 2200',
      'hash',
      'ip',
      'seguranca',
      'assinar aditivo',
      'assinar contrato',
    ],
    summary:
      'Validade jurídica, parâmetros de segurança (hash SHA-256, IP, carimbo de tempo) e como assinar documentos na plataforma.',
    steps: [
      'Sempre que houver um documento aguardando sua formalização (Termo de Subscrição, Cautela, Aditivo de Cessão ou Dossiê KYC), um modal de aviso ("Assinatura Eletrônica Pendente") ou botão de ação surgirá na sua tela.',
      'Clique no botão "Assinar Documento" ou "Assinar Aditivo".',
      'Você será direcionado para o fluxo seguro de assinatura (ou ambiente integrado DocuSign).',
      'Confira os dados do contrato, valor, prazos e encargos contratuais.',
      'Insira sua assinatura eletrônica e confirme.',
      'O sistema registra metadados de auditoria completos: endereço IP do signatário, data e hora UTC, e-mail autenticado e hash criptográfico do arquivo.',
      'O documento assinado é arquivado na nuvem e fica permanentemente disponível para download na sua conta.',
    ],
    tips: [
      'BASE LEGAL: As assinaturas digitais na plataforma possuem plena eficácia probatória conforme o art. 10, § 2º da Medida Provisória nº 2.200-2/2001 e os arts. 4º e 5º da Lei Federal nº 14.063/2020 (assinatura eletrônica avançada).',
      'Qualquer alteração posterior no arquivo invalida o hash criptográfico, garantindo integridade absoluta.',
    ],
    relatedTopicIds: [
      'investor-contrato-cautela',
      'admin-lancar-operacao',
      'transversal-kyc-cadastro',
    ],
  },
  {
    id: 'transversal-kyc-cadastro',
    title: 'Cadastro e Conformidade KYC (Dossiê de Pessoa Física e Jurídica)',
    roles: ['all'],
    category: 'transversal',
    navigationPath: 'Menu superior (Avatar) > Meu Perfil ou tela de Compliance & KYC',
    keywords: [
      'kyc',
      'cadastro',
      'documentos',
      'comprovante endereco',
      'contrato social',
      'dossie',
      'atualizar perfil',
      'dados bancarios',
    ],
    summary:
      'Como preencher dados cadastrais, enviar documentos de conformidade e manter o perfil atualizado.',
    steps: [
      'Acesse "Meu Perfil" no canto superior direito da tela.',
      'Revise os dados cadastrais básicos (Pessoa Física: Nome, CPF, RG, Endereço; Pessoa Jurídica: Razão Social, CNPJ, Representante Legal).',
      'Na aba "Documentos KYC", faça o upload dos comprovantes solicitados (documento com foto, comprovante de residência recente, contrato social consolidado para empresas).',
      'Na aba "Contas Bancárias", cadastre a conta de mesma titularidade (mesmo CPF/CNPJ) para a qual os resgates ou desembolsos de crédito serão transferidos.',
      'Após a validação da equipe de Compliance, o selo da sua conta passará para "KYC Aprovado".',
    ],
    tips: [
      'Operações de antecipação e resgates financeiros exigem conta bancária de mesma titularidade para evitar fraudes e cumprir normas do Banco Central e COAF.',
    ],
    relatedTopicIds: ['transversal-assinatura-eletronica', 'investor-checkout'],
  },
  {
    id: 'transversal-exportacoes-pdf-csv',
    title: 'Exportação de Dados: Relatórios em PDF e Planilhas CSV',
    roles: ['all'],
    category: 'transversal',
    navigationPath: 'Telas de Relatórios, Livro Caixa, Comissões e Mesa de Operações',
    keywords: [
      'exportar',
      'csv',
      'pdf',
      'imprimir',
      'baixar planilha',
      'excel',
      'extrato csv',
      'relatorio pdf',
    ],
    summary: 'Como extrair dados tabulares e relatórios visuais em qualquer módulo da plataforma.',
    steps: [
      'Em praticamente todas as telas de listagem (Livro Caixa, Comissões, Relatórios, Mesa de Operações, etc.), localize os botões de exportação no topo direito do card.',
      'Para exportar em CSV (Excel): clique no botão "CSV" ou "Exportar CSV". Um arquivo formatado em formato separado por vírgulas será baixado imediatamente no seu computador.',
      'Para exportar em PDF: clique no botão "PDF" ou "Imprimir". O sistema abre a janela de impressão com folha de estilo dedicada, omitindo menus laterais e cabeçalhos para uma formatação limpa A4.',
      'Nas telas de contratos e cautelas, utilize o botão com ícone de download direto para salvar o documento em formato PDF no seu dispositivo.',
    ],
    tips: [
      'Os arquivos CSV gerados utilizam codificação UTF-8 compatível com Excel, Google Planilhas e sistemas de contabilidade terceiros.',
    ],
    relatedTopicIds: ['admin-livro-caixa', 'admin-relatorios-unificado'],
  },
]

/**
 * Perguntas Frequentes / Sugestões rápidas por perfil
 */
export const FREQUENT_QUESTIONS_BY_ROLE: Record<string, { label: string; query: string }[]> = {
  admin: [
    {
      label: 'Debêntures com Juros Mensais',
      query: 'como funciona o regime de debentures com juros mensais e resgate com cotas preservadas?',
    },
    {
      label: 'Autorização de Aportes Internos',
      query: 'como funciona a autorizacao do cliente pos lancamento interno e status de aceite?',
    },
    {
      label: 'Fluxo de Caixa Projetado',
      query:
        'como usar o fluxo de caixa projetado, adicionar recebiveis futuros e interpretar o saldo acumulado?',
    },
    {
      label: 'Recebíveis a Receber',
      query: 'onde vejo o relatorio de recebiveis a receber antecipacoes e ccbs?',
    },
    {
      label: 'Notificação de Cessão (Sacado)',
      query: 'como funciona a notificacao de cessao de credito ao sacado e confirmacao de ciencia?',
    },
    {
      label: 'Regra de Limite do Tomador',
      query: 'como funciona a regra de limite de credito do tomador pago vs liquidado?',
    },
    {
      label: 'Lançar Antecipação',
      query: 'como lancar uma nova operacao de antecipacao de recebiveis?',
    },
    {
      label: 'Editar Escritura na Junta',
      query: 'como editar dados da escritura de debentures e registro na junta comercial?',
    },
    {
      label: 'Pagar Comissão de Gerente',
      query: 'como calcular, pagar comissao de gerente de credito e imprimir recibo?',
    },
    {
      label: 'Despesas e Anexo de NF',
      query: 'como lancar despesa com nota fiscal e o impacto no lalur e lucro real?',
    },
    {
      label: 'Tributação Securitizadora',
      query: 'quais as regras de tributacao pis cofins lair lalur e lucro real?',
    },
    { label: 'Compras de CCB', query: 'como funciona a compra e aquisicao de ccb bdigital?' },
    { label: 'Livro Caixa & DRE', query: 'como consultar o livro caixa dre e dfc?' },
  ],
  staff: [
    { label: 'Lançar Antecipação', query: 'como lancar uma nova operacao na mesa de operacoes?' },
    {
      label: 'Aprovar Aporte',
      query: 'como aprovar comprovante de aporte de debenture do investidor?',
    },
    { label: 'Regra de Limite', query: 'quando o limite do tomador e liberado?' },
    {
      label: 'Assinatura Eletrônica',
      query: 'como funciona a validade da assinatura eletronica nos documentos?',
    },
  ],
  accountant: [
    { label: 'Livro Caixa', query: 'como auditar e reconciliar movimentacoes no livro caixa?' },
    {
      label: 'Tributação e LALUR',
      query: 'onde vejo o relatorio fiscal de lair lalur pis e cofins?',
    },
    { label: 'DRE e DFC', query: 'como acessar os demonstrativos de resultado e fluxo de caixa?' },
    {
      label: 'Despesas sem NF',
      query: 'qual o tratamento fiscal de despesas sem nota fiscal no lucro real?',
    },
  ],
  borrower: [
    {
      label: 'Notificação de Cessão',
      query: 'onde baixar a notificacao de cessao de credito das minhas operacoes?',
    },
    { label: 'Simular Antecipação', query: 'como simular e solicitar antecipacao de recebiveis?' },
    { label: 'Contratar CCB Digital', query: 'como simular e pedir uma ccb digital bdigital?' },
    {
      label: 'Pagar Parcela via PIX',
      query: 'como gerar o codigo pix ou boleto para pagar minha parcela ccb?',
    },
    {
      label: 'Consultar Limite',
      query: 'como funciona meu limite de credito e quando ele e restaurado?',
    },
    {
      label: 'Assinar Aditivo',
      query: 'onde assino digitalmente o contrato ou aditivo de cessao?',
    },
  ],
  investor: [
    {
      label: 'Resgatar Juros Mensais',
      query: 'como resgatar juros mensais das debentures com cotas preservadas?',
    },
    {
      label: 'Autorizar Investimento do Admin',
      query: 'como autorizo um investimento lancado pelo admin e confirmo meu aceite?',
    },
    {
      label: 'Como Fazer um Aporte',
      query: 'como investir e enviar o comprovante de transferencia?',
    },
    {
      label: 'Ver Contrato e Cautela',
      query: 'onde baixar o contrato de subscricao e a cautela da debenture?',
    },
    {
      label: 'Acompanhar Rendimentos',
      query: 'como ver meus rendimentos acumulados e emitir informe fiscal?',
    },
    {
      label: 'Solicitar Resgate',
      query: 'como solicitar saque ou resgate e como funciona a carencia?',
    },
  ],
}

/**
 * Motor de busca de intenção e pontuação de tópicos (Keyword matching + Stemming determinístico)
 */
export function searchKnowledgeBase(userQuery: string, userRole?: string): AssistantAnswer {
  const normalizedQuery = normalizeAssistantText(userQuery)

  if (!normalizedQuery) {
    return {
      matched: false,
      suggestedTopics: KNOWLEDGE_BASE.slice(0, 4),
      warning: 'Digite uma dúvida ou escolha uma das perguntas frequentes acima.',
    }
  }

  // Detecção especial para pedidos de saldo pessoal em tempo real (Regra 5: manual não expõe saldo)
  const isAskingPersonalBalance =
    (normalizedQuery.includes('meu saldo') ||
      normalizedQuery.includes('qual meu saldo') ||
      normalizedQuery.includes('quanto tenho') ||
      normalizedQuery.includes('meu dinheiro') ||
      normalizedQuery.includes('extrato pessoal')) &&
    !normalizedQuery.includes('como') &&
    !normalizedQuery.includes('regra')

  if (isAskingPersonalBalance) {
    const roleAnswer =
      userRole === 'investor'
        ? 'Valores e saldos em tempo real devem ser conferidos diretamente na sua tela de Dashboard do Investidor (Menu lateral > Dashboard), onde constam seu saldo aplicado, rendimentos acumulados e gráficos atualizados.'
        : userRole === 'borrower'
          ? 'Seu limite de crédito total e saldo disponível para novas operações em tempo real devem ser conferidos diretamente no Dashboard do Tomador (Menu lateral > Dashboard), no card "Saldo Disponível".'
          : 'Saldos bancários e posições financeiras em tempo real da securitizadora devem ser conferidos nas telas "Contabilidade & Fiscal" (Livro Caixa) e "Contas Bancárias".'

    return {
      matched: true,
      directAnswer: `${roleAnswer}\n\n*Nota: Este assistente atua como o Manual Interativo oficial da plataforma — ele ensina o passo a passo de como navegar e realizar tarefas, sem consultar dados sensíveis em tempo real.*`,
      suggestedTopics: KNOWLEDGE_BASE.filter(
        (t) => t.roles.includes('all') || (userRole && t.roles.includes(userRole as any)),
      ).slice(0, 3),
    }
  }

  // Tokeniza e aplica stemming nas palavras da consulta do usuário
  const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 2)
  const stemmedQueryWords = queryWords.map((w) => stemWord(w))

  // Expande com sinônimos
  const expandedQueryTokens = new Set<string>()
  for (const w of queryWords) {
    expandedQueryTokens.add(w)
    expandedQueryTokens.add(stemWord(w))
    for (const [key, synList] of Object.entries(SYNONYMS_MAP)) {
      if (w === key || synList.includes(w)) {
        expandedQueryTokens.add(key)
        synList.forEach((s) => {
          expandedQueryTokens.add(s)
          expandedQueryTokens.add(stemWord(s))
        })
      }
    }
  }

  // Pontuação de cada tópico
  const matches: SearchMatch[] = []

  for (const topic of KNOWLEDGE_BASE) {
    let score = 0
    const matchedKeywords: string[] = []

    // Bônus se o tópico for compatível com a role atual
    const roleMatch =
      !userRole ||
      topic.roles.includes('all') ||
      topic.roles.includes(userRole as any) ||
      (userRole === 'admin' && topic.roles.includes('staff'))

    if (roleMatch) {
      score += 5
    } else {
      score -= 10 // penaliza tópicos de outros perfis sem eliminar completamente
    }

    // Match no título (peso alto)
    const normalizedTitle = normalizeAssistantText(topic.title)
    for (const qWord of queryWords) {
      if (normalizedTitle.includes(qWord)) {
        score += 15
        matchedKeywords.push(qWord)
      }
    }

    // Match nas keywords
    for (const kw of topic.keywords) {
      const normKw = normalizeAssistantText(kw)
      const kwTokens = normKw.split(' ')

      // Correspondência exata da keyword composta na query
      if (normalizedQuery.includes(normKw)) {
        score += 25
        matchedKeywords.push(kw)
        continue
      }

      // Correspondência por tokens da keyword
      for (const t of kwTokens) {
        const stemmedKwToken = stemWord(t)
        if (expandedQueryTokens.has(t) || expandedQueryTokens.has(stemmedKwToken)) {
          score += 6
          matchedKeywords.push(t)
        }
      }
    }

    // Match no summary
    const normalizedSummary = normalizeAssistantText(topic.summary)
    for (const stemW of stemmedQueryWords) {
      if (normalizedSummary.includes(stemW)) {
        score += 3
      }
    }

    // Casos especiais específicos citados na tarefa
    if (
      (normalizedQuery.includes('autoriz') ||
        normalizedQuery.includes('aceite') ||
        normalizedQuery.includes('pos lancamento') ||
        normalizedQuery.includes('lancado pelo admin')) &&
      topic.id === 'investor-autorizacao-lancamento-interno'
    ) {
      score += 45
    }
    if (
      normalizedQuery.includes('pago') &&
      normalizedQuery.includes('limite') &&
      topic.id === 'admin-tomador-limite'
    ) {
      score += 40
    }
    if (
      (normalizedQuery.includes('fluxo') ||
        normalizedQuery.includes('projetado') ||
        normalizedQuery.includes('projecao') ||
        normalizedQuery.includes('saldo acumulado')) &&
      topic.id === 'admin-relatorios-fluxo-caixa-projetado'
    ) {
      score += 50
    }
    if (
      (normalizedQuery.includes('a receber') || normalizedQuery.includes('recebiveis a receber')) &&
      topic.id === 'admin-relatorios-recebiveis-a-receber'
    ) {
      score += 45
    }
    if (
      (normalizedQuery.includes('lalur') || normalizedQuery.includes('lucro real')) &&
      topic.id === 'admin-relatorios-tributario'
    ) {
      score += 40
    }
    if (normalizedQuery.includes('cautela') && topic.id === 'investor-contrato-cautela') {
      score += 35
    }
    if (
      normalizedQuery.includes('junta') &&
      (topic.id === 'admin-debentures-escritura' || topic.id === 'admin-parametros-securitizadora')
    ) {
      score += 30
    }
    if (normalizedQuery.includes('comissao') && topic.id === 'admin-gerentes-comissoes') {
      score += 35
    }

    if (score > 15) {
      matches.push({
        topic,
        score,
        matchedKeywords: Array.from(new Set(matchedKeywords)),
      })
    }
  }

  // Ordena por pontuação decrescente
  matches.sort((a, b) => b.score - a.score)

  if (matches.length > 0 && matches[0].score >= 20) {
    const best = matches[0].topic
    const suggestions = matches
      .slice(1, 4)
      .map((m) => m.topic)
      .filter((t) => t.id !== best.id)

    // Se houver tópicos relacionados cadastrados no próprio tópico, prioriza-os
    if (best.relatedTopicIds) {
      for (const relId of best.relatedTopicIds) {
        const relTopic = KNOWLEDGE_BASE.find((t) => t.id === relId)
        if (relTopic && !suggestions.some((s) => s.id === relTopic.id)) {
          suggestions.push(relTopic)
        }
      }
    }

    return {
      matched: true,
      topic: best,
      suggestedTopics: suggestions.slice(0, 3),
    }
  }

  // Nenhuma correspondência forte: retorna tópicos sugeridos com base no perfil
  const fallbackTopics = KNOWLEDGE_BASE.filter(
    (t) => t.roles.includes('all') || (userRole && t.roles.includes(userRole as any)),
  ).slice(0, 4)

  return {
    matched: false,
    suggestedTopics: fallbackTopics,
    warning:
      'Não localizei uma instrução exata para esses termos. Veja os tópicos sugeridos abaixo ou tente reformular com palavras-chave como: "limite", "ccb", "comissão", "escritura", "resgate", "nota fiscal" ou "lucro real".',
  }
}
