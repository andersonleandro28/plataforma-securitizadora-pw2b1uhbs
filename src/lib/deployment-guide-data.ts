export interface MigrationItem {
  id: number
  filename: string
  action: 'APLICAR' | 'PULAR'
  justification: string
}

export interface EdgeFunctionItem {
  name: string
  purpose: string
}

export interface SecretItem {
  name: string
  provider: string
  description: string
}

export interface PhaseStep {
  id: string
  text: string
  substeps?: string[]
  code?: string
}

export interface PhaseItem {
  number: number
  title: string
  steps: PhaseStep[]
}

export const MIGRATIONS_DATA: MigrationItem[] = [
  {
    id: 1,
    filename: '20260320025012_create_serasa_consultations.sql',
    action: 'APLICAR',
    justification:
      'Estrutura da tabela de consultas Serasa e políticas RLS. (Ignorar o bloco DO final de usuário teste test@example.com)',
  },
  {
    id: 2,
    filename: '20260320031500_seed_anderson_user.sql',
    action: 'PULAR',
    justification: 'Cria usuário específico da operação piloto anterior com senha estática.',
  },
  {
    id: 3,
    filename: '20260320032204_add_profiles_and_logs.sql',
    action: 'APLICAR',
    justification: 'Estrutura base de perfis de usuário (profiles) e logs de acesso.',
  },
  {
    id: 4,
    filename: '20260320040000_add_avatar_and_webhooks.sql',
    action: 'APLICAR',
    justification: 'Bucket avatars e colunas de foto de perfil.',
  },
  {
    id: 5,
    filename: '20260320050000_add_user_roles.sql',
    action: 'APLICAR',
    justification: 'Enum app_role e controle de permissões.',
  },
  {
    id: 6,
    filename: '20260320060000_admin_profiles_policies.sql',
    action: 'APLICAR',
    justification: 'Políticas de RLS para administradores gerenciarem perfis.',
  },
  {
    id: 7,
    filename: '20260320070000_fix_profiles_rls_recursion.sql',
    action: 'APLICAR',
    justification: 'Correção técnica de recursão de políticas RLS em perfis.',
  },
  {
    id: 8,
    filename: '20260320113703_add_kyc_schema.sql',
    action: 'APLICAR',
    justification: 'Schema completo de onboarding KYC e bucket kyc-documents.',
  },
  {
    id: 9,
    filename: '20260320124500_fix_access_logs_rls.sql',
    action: 'APLICAR',
    justification: 'Políticas RLS seguras para logs de acesso.',
  },
  {
    id: 10,
    filename: '20260320153000_add_multirole_and_kyc_fields.sql',
    action: 'APLICAR',
    justification: 'Suporte a múltiplos papéis (is_admin, is_staff, is_investor, is_borrower).',
  },
  {
    id: 11,
    filename: '20260320155317_add_pj_procurator.sql',
    action: 'APLICAR',
    justification: 'Campos cadastrais de procurador/representante para Pessoa Jurídica.',
  },
  {
    id: 12,
    filename: '20260320180000_create_debentures.sql',
    action: 'APLICAR',
    justification: 'Tabelas de emissão de debêntures e séries.',
  },
  {
    id: 13,
    filename: '20260320193000_create_deeds_bucket.sql',
    action: 'APLICAR',
    justification: 'Bucket de armazenamento deeds para escrituras de debêntures.',
  },
  {
    id: 14,
    filename: '20260321000000_add_import_tables.sql',
    action: 'APLICAR',
    justification: 'Tabelas base de produtos de investimento e borderôs.',
  },
  {
    id: 15,
    filename: '20260321040000_create_debenture_subscriptions.sql',
    action: 'APLICAR',
    justification: 'Tabela de subscrições de debêntures e auditoria.',
  },
  {
    id: 16,
    filename: '20260321060000_enrich_investment_products.sql',
    action: 'APLICAR',
    justification: 'Campos financeiros estendidos para produtos de investimento.',
  },
  {
    id: 17,
    filename: '20260322143000_ensure_storage_bucket.sql',
    action: 'APLICAR',
    justification: 'Bucket operation-docs para documentos de operações de crédito.',
  },
  {
    id: 18,
    filename: '20260322144710_fix_contract_versions_fk.sql',
    action: 'APLICAR',
    justification: 'Ajuste de chaves estrangeiras em versões contratuais.',
  },
  {
    id: 19,
    filename: '20260322160000_credit_operations.sql',
    action: 'APLICAR',
    justification: 'Tabelas centrais de operações de crédito, cálculos e parâmetros financeiros.',
  },
  {
    id: 20,
    filename: '20260322160500_digital_signature.sql',
    action: 'APLICAR',
    justification: 'Tabelas de assinatura digital de minutas contratuais.',
  },
  {
    id: 21,
    filename: '20260322163000_operation_enhancements.sql',
    action: 'APLICAR',
    justification: 'Melhorias nos cálculos de ad valorem e deságio de operações.',
  },
  {
    id: 22,
    filename: '20260322164500_fix_operations_fk.sql',
    action: 'APLICAR',
    justification: 'Ajuste de integridade referencial nas operações de crédito.',
  },
  {
    id: 23,
    filename: '20260322180000_create_risk_analysis.sql',
    action: 'APLICAR',
    justification: 'Tabelas de score e comitê de risco de crédito.',
  },
  {
    id: 24,
    filename: '20260322190000_add_credit_limits.sql',
    action: 'APLICAR',
    justification: 'Campo credit_limit na tabela profiles.',
  },
  {
    id: 25,
    filename: '20260323015424_storage_cors_and_mime.sql',
    action: 'APLICAR',
    justification: 'Configuração de tipos MIME permitidos e CORS no Storage.',
  },
  {
    id: 26,
    filename: '20260323120000_investment_products_full.sql',
    action: 'APLICAR',
    justification: 'Estrutura de cotas, valor unitário e limites por investidor.',
  },
  {
    id: 27,
    filename: '20260323192500_add_bank_code.sql',
    action: 'APLICAR',
    justification: 'Coluna bank_code para compensação bancária (COMPE).',
  },
  {
    id: 28,
    filename: '20260323194000_fix_investments_profiles_fk.sql',
    action: 'APLICAR',
    justification: 'Vínculo estrutural entre investimentos e perfis.',
  },
  {
    id: 29,
    filename: '20260323200000_user_bank_accounts.sql',
    action: 'APLICAR',
    justification: 'Tabela de contas bancárias dos clientes (investidores e tomadores).',
  },
  {
    id: 30,
    filename: '20260324035014_ccb_digital.sql',
    action: 'APLICAR',
    justification: 'Tabela ccb_solicitacoes, bucket ccb-docs e fluxo de CCB.',
  },
  {
    id: 31,
    filename: '20260324041000_fix_ccb_profiles_fk.sql',
    action: 'APLICAR',
    justification: 'Ajuste de chaves estrangeiras em CCBs.',
  },
  {
    id: 32,
    filename: '20260324100000_investment_flow.sql',
    action: 'APLICAR',
    justification: 'Tabela company_bank_accounts e bucket investment-proofs.',
  },
  {
    id: 33,
    filename: '20260325120000_investment_redemptions.sql',
    action: 'APLICAR',
    justification: 'Tabela de solicitações de resgates de cotas.',
  },
  {
    id: 34,
    filename: '20260325160000_admin_kyc_storage_policy.sql',
    action: 'APLICAR',
    justification: 'Políticas de acesso administrativo aos anexos cadastrais.',
  },
  {
    id: 35,
    filename: '20260325172300_add_user_management_fields.sql',
    action: 'APLICAR',
    justification: 'Campos administrativos de bloqueio e reset de senha.',
  },
  {
    id: 36,
    filename: '20260325184500_fix_investment_redemptions_fk.sql',
    action: 'APLICAR',
    justification: 'Vínculo referencial nas solicitações de resgate.',
  },
  {
    id: 37,
    filename: '20260325195000_atomic_redemptions.sql',
    action: 'APLICAR',
    justification: 'Procedure atômica para liquidação e pagamento de resgates.',
  },
  {
    id: 38,
    filename: '20260325203000_cleanup_investments_queue.sql',
    action: 'PULAR',
    justification: 'Delete de limpeza da fila de testes da operação antiga.',
  },
  {
    id: 39,
    filename: '20260331120000_add_signup_fields.sql',
    action: 'APLICAR',
    justification: 'Campos complementares de cadastro e termos legais.',
  },
  {
    id: 40,
    filename: '20260401120000_docusign_integration.sql',
    action: 'APLICAR',
    justification: 'Colunas de integração para envelopes DocuSign.',
  },
  {
    id: 41,
    filename: '20260401170000_add_liquidation_fields.sql',
    action: 'APLICAR',
    justification: 'Colunas liquidation_date e liquidation_value em operações.',
  },
  {
    id: 42,
    filename: '20260401205000_ccb_dynamic_fields.sql',
    action: 'APLICAR',
    justification: 'Campos para parametrização dinâmica de CCBs.',
  },
  {
    id: 43,
    filename: '20260401220000_ccb_updates.sql',
    action: 'APLICAR',
    justification: 'Atualização estrutural das rotinas de cálculo de CCB.',
  },
  {
    id: 44,
    filename: '20260402100000_ccb_simulation_and_operations.sql',
    action: 'APLICAR',
    justification: 'Tabelas de simulação financeira de crédito.',
  },
  {
    id: 45,
    filename: '20260403000000_ccb_detailed_entities.sql',
    action: 'APLICAR',
    justification: 'Entidades de garantias reais, avalistas e fiadores.',
  },
  {
    id: 46,
    filename: '20260403162037_investments_sync.sql',
    action: 'APLICAR',
    justification: 'RPCs approve_investment e cancel_investment.',
  },
  {
    id: 47,
    filename: '20260403170000_revert_realtime_soft_delete.sql',
    action: 'APLICAR',
    justification: 'Ajuste técnico de publicação do Supabase Realtime.',
  },
  {
    id: 48,
    filename: '20260403190838_add_ccb_iof_daily.sql',
    action: 'APLICAR',
    justification: 'Campos de IOF adicional e diário nas operações de crédito.',
  },
  {
    id: 49,
    filename: '20260403212100_accounting_and_expenses.sql',
    action: 'APLICAR',
    justification: 'Tabela expenses e plano de contas base.',
  },
  {
    id: 50,
    filename: '20260403222136_create_recebiveis_ccb.sql',
    action: 'APLICAR',
    justification: 'Tabela recebiveis_ccb e array de boletos/parcelas.',
  },
  {
    id: 51,
    filename: '20260423204900_add_sacado_details_to_operations.sql',
    action: 'APLICAR',
    justification: 'Campos para qualificação de sacados/devedores em antecipações.',
  },
  {
    id: 52,
    filename: '20260423211800_enable_realtime_recebiveis.sql',
    action: 'APLICAR',
    justification: 'Habilitação de Realtime para monitoramento de recebíveis.',
  },
  {
    id: 53,
    filename: '20260424002718_create_storage_buckets.sql',
    action: 'APLICAR',
    justification: 'Garantia da existência de todos os buckets de armazenamento.',
  },
  {
    id: 54,
    filename: '20260424040000_treasury_transactions.sql',
    action: 'APLICAR',
    justification: 'Tabela central treasury_transactions da tesouraria.',
  },
  {
    id: 55,
    filename: '20260424051615_add_expense_trigger.sql',
    action: 'APLICAR',
    justification: 'Trigger de sincronização de despesas com o livro de tesouraria.',
  },
  {
    id: 56,
    filename: '20260424060000_fix_treasury_duplicates.sql',
    action: 'APLICAR',
    justification: 'Constraint UNIQUE de despesas na tesouraria e upsert.',
  },
  {
    id: 57,
    filename: '20260425175136_cleanup_borrower_test_data.sql',
    action: 'PULAR',
    justification: 'Deleção de dados de testes de operações e tomadores anteriores.',
  },
  {
    id: 58,
    filename: '20260425183100_transaction_categories.sql',
    action: 'APLICAR',
    justification: 'Tabela transaction_categories e categorias padrão.',
  },
  {
    id: 59,
    filename: '20260425203402_add_irrf_to_redemptions.sql',
    action: 'APLICAR',
    justification: 'Campos para apuração e retenção de IRRF em resgates.',
  },
  {
    id: 60,
    filename: '20260425205901_add_reinvestment_columns.sql',
    action: 'APLICAR',
    justification: 'Estrutura de reinvestimento de resgates em novos produtos.',
  },
  {
    id: 61,
    filename: '20260425211553_fix_treasury_redemptions.sql',
    action: 'APLICAR',
    justification: 'Lançamentos contábeis automáticos de resgate na tesouraria.',
  },
  {
    id: 62,
    filename: '20260425213921_update_redemption_logic.sql',
    action: 'APLICAR',
    justification: 'Validações de limites e saldo remanescente do investimento.',
  },
  {
    id: 63,
    filename: '20260425215702_update_process_redemption_payment.sql',
    action: 'APLICAR',
    justification: 'Procedure atualizada de processamento de resgates.',
  },
  {
    id: 64,
    filename: '20260425222808_fix_redemption_subscriptions.sql',
    action: 'APLICAR',
    justification: 'Baixa automática nas debêntures subscritas ao pagar resgate.',
  },
  {
    id: 65,
    filename: '20260425230050_add_contract_to_investments.sql',
    action: 'APLICAR',
    justification: 'Colunas de contrato e minuta vinculados aos investimentos.',
  },
  {
    id: 66,
    filename: '20260426011712_sync_subscription_dates.sql',
    action: 'APLICAR',
    justification: 'Trigger de sincronização de datas de transferência.',
  },
  {
    id: 67,
    filename: '20260426030000_add_deleted_at_to_ccb.sql',
    action: 'APLICAR',
    justification: 'Coluna deleted_at para exclusão lógica de CCBs.',
  },
  {
    id: 68,
    filename: '20260426032510_add_tomador_id_to_recebiveis.sql',
    action: 'APLICAR',
    justification: 'Coluna tomador_id na tabela recebiveis_ccb.',
  },
  {
    id: 69,
    filename: '20260426033620_ccb_treasury_integration.sql',
    action: 'APLICAR',
    justification: 'Trigger que espelha recebimentos de CCB na tesouraria.',
  },
  {
    id: 70,
    filename: '20260426035000_ccb_installments_liquidation.sql',
    action: 'APLICAR',
    justification: 'Procedure de liquidação de parcelas de CCB.',
  },
  {
    id: 71,
    filename: '20260426035000_fix_treasury_triggers.sql',
    action: 'APLICAR',
    justification: 'Tratamento de conflitos de concorrência em triggers da tesouraria.',
  },
  {
    id: 72,
    filename: '20260426044405_sync_investment_dates.sql',
    action: 'APLICAR',
    justification: 'Trigger em cascata para sincronização de datas contábeis.',
  },
  {
    id: 73,
    filename: '20260427040654_fix_dates_timezone.sql',
    action: 'APLICAR',
    justification: 'Padronização de datas para evitar deslocamento de fuso horário UTC-3.',
  },
  {
    id: 74,
    filename: '20260427042304_rename_requires_password_change.sql',
    action: 'APLICAR',
    justification: 'Padronização de nomenclatura da coluna de troca de senha.',
  },
  {
    id: 75,
    filename: '20260427161500_fix_date_discrepancies.sql',
    action: 'PULAR',
    justification: 'Ajuste corretivo exclusivo para dados passados da operação anterior.',
  },
  {
    id: 76,
    filename: '20260503163500_accounting_sync_cleanup.sql',
    action: 'PULAR',
    justification: 'Limpeza de dados duplicados pontuais da base de transição anterior.',
  },
  {
    id: 77,
    filename: '20260503164500_migration_tesouraria.sql',
    action: 'APLICAR',
    justification: 'Função processa_movimentacao_caixa para o Livro Caixa contábil.',
  },
  {
    id: 78,
    filename: '20260503164614_fix_migrar_dados_historicos.sql',
    action: 'APLICAR',
    justification: 'Ajustes das rotinas de cálculo do caixa e saldos.',
  },
  {
    id: 79,
    filename: '20260503165000_update_migration_function.sql',
    action: 'APLICAR',
    justification: 'Atualizações de funções de sincronização financeira.',
  },
  {
    id: 80,
    filename: '20260503170000_create_livro_caixa.sql',
    action: 'APLICAR',
    justification: 'Estruturas base de apoio ao Livro Caixa e DRE.',
  },
  {
    id: 81,
    filename: '20260503170008_fix_rls_movimentacoes_caixa.sql',
    action: 'APLICAR',
    justification: 'Políticas de RLS para o Livro Caixa com papel administrador.',
  },
  {
    id: 82,
    filename: '20260503170009_update_migrar_dados_historicos.sql',
    action: 'APLICAR',
    justification: 'Rotina de recálculo de saldo da conta caixa.',
  },
  {
    id: 83,
    filename: '20260503171000_fix_admin_rls_and_profile.sql',
    action: 'APLICAR',
    justification: 'Funções de segurança is_admin() essenciais para toda a plataforma.',
  },
  {
    id: 84,
    filename: '20260503171300_fix_accounting_rls_v2.sql',
    action: 'APLICAR',
    justification: 'Reforço de segurança para consultas de contabilidade gerencial.',
  },
  {
    id: 85,
    filename: '20260503173000_fix_accounting_rls_and_admin.sql',
    action: 'APLICAR',
    justification: 'Garantia de permissão ampla para o gestor contábil.',
  },
  {
    id: 86,
    filename: '20260503174500_fix_rls_for_accounting_admin.sql',
    action: 'APLICAR',
    justification: 'Políticas definitivas para visualização do Livro Caixa pelo admin.',
  },
  {
    id: 87,
    filename: '20260503184535_add_limpeza_rpc.sql',
    action: 'PULAR',
    justification: 'RPC para deletar tabelas de rascunho já inexistentes em banco novo.',
  },
  {
    id: 88,
    filename: '20260503185353_cleanup_problematic_tables.sql',
    action: 'PULAR',
    justification: 'DROP TABLE em cascata de tabelas transitórias antigas.',
  },
  {
    id: 89,
    filename: '20260503203000_fix_ccb_null_payment_dates.sql',
    action: 'PULAR',
    justification: 'Atualização de boletos dos clientes específicos Osvaldir e Carlos.',
  },
  {
    id: 90,
    filename: '20260503203947_fix_ccb_payment_dates.sql',
    action: 'PULAR',
    justification: 'Atualização de boletos dos clientes Rafael, Osvaldir e Carlos.',
  },
  {
    id: 91,
    filename: '20260503204500_fix_ccb_dates_osvaldir_carlos.sql',
    action: 'PULAR',
    justification: 'Ajuste manual repetido de clientes da operação anterior.',
  },
  {
    id: 92,
    filename: '20260503220000_fix_rafael_kieslark_installments.sql',
    action: 'PULAR',
    justification: 'Correção de parcelas com nomes de clientes da operação piloto.',
  },
  {
    id: 93,
    filename: '20260506031145_create_investments_view.sql',
    action: 'APLICAR',
    justification: 'View unificada investments_view para painéis de investimentos.',
  },
  {
    id: 94,
    filename: '20260506041234_fix_investments_rls_and_view.sql',
    action: 'APLICAR',
    justification: 'Permissões de leitura e segurança na view de investimentos.',
  },
  {
    id: 95,
    filename: '20260526030512_ensure_investments_rls.sql',
    action: 'APLICAR',
    justification: 'Isolamento de dados entre investidores na tabela de investimentos.',
  },
  {
    id: 96,
    filename: '20260526040000_fix_investments_rls_and_seed.sql',
    action: 'PULAR',
    justification: 'Seed de usuário e senha da operação anterior.',
  },
  {
    id: 97,
    filename: '20260527004046_clear_investment_data.sql',
    action: 'PULAR',
    justification: 'Delete de investimentos de teste da base piloto.',
  },
  {
    id: 98,
    filename: '20260527004656_restore_investment_products.sql',
    action: 'PULAR',
    justification: 'Cadastro de produtos fictícios Sea Connection e senha estática.',
  },
  {
    id: 99,
    filename: '20260527011703_update_admin_seed.sql',
    action: 'PULAR',
    justification: 'Atualização de credenciais de usuário da operação antiga.',
  },
  {
    id: 100,
    filename: '20260527014500_alter_indexer_nullable.sql',
    action: 'APLICAR',
    justification: 'Torna o campo indexer anulável para suportar produtos pré-fixados.',
  },
  {
    id: 101,
    filename: '20260527024558_seed_admin_user.sql',
    action: 'PULAR',
    justification: 'Seed do usuário Anderson Leandro com senha hardcoded.',
  },
  {
    id: 102,
    filename: '20260527134731_product_lookup_tables.sql',
    action: 'APLICAR',
    justification: 'Tabelas auxiliares de status, risco e moedas.',
  },
  {
    id: 103,
    filename: '20260527150000_create_product_reference_tables.sql',
    action: 'APLICAR',
    justification: 'Tabelas product_statuses, product_risk_ratings, product_currencies.',
  },
  {
    id: 104,
    filename: '20260527160000_seed_product_dictionaries.sql',
    action: 'APLICAR',
    justification:
      "Dicionários de domínio ('Em Captação', 'Esgotado', 'Baixo', 'BRL', etc.). (Remover apenas o bloco IF final da debênture Sea Connection)",
  },
  {
    id: 105,
    filename: '20260527212727_update_investment_products_rls.sql',
    action: 'APLICAR',
    justification: 'Políticas de visualização pública/autenticada dos produtos.',
  },
  {
    id: 106,
    filename: '20260729172000_manual_yield_entries.sql',
    action: 'APLICAR',
    justification: 'Tabela manual_yield_entries para controle de rentabilidade manual.',
  },
  {
    id: 107,
    filename: '20260814214000_kyc_docs_delete_policy.sql',
    action: 'APLICAR',
    justification: 'Permissão de remoção/substituição de documentos KYC no Storage.',
  },
  {
    id: 108,
    filename: '20260814234631_create_movimentacoes_caixa.sql',
    action: 'APLICAR',
    justification: 'Tabela definitiva movimentacoes_caixa com RLS e índices.',
  },
  {
    id: 109,
    filename: '20260814235200_create_mapeamento_movimentacoes.sql',
    action: 'APLICAR',
    justification: 'Tabela de rastreabilidade contábil mapeamento_movimentacoes.',
  },
  {
    id: 110,
    filename: '20260815030241_add_type_to_expenses.sql',
    action: 'APLICAR',
    justification: 'Campo type em despesas (operacional, administrativa, captação).',
  },
  {
    id: 111,
    filename: '20260916150000_add_interest_type_to_investment_products.sql',
    action: 'APLICAR',
    justification: 'Suporte nativo aos regimes de juros: cumulative e monthly.',
  },
  {
    id: 112,
    filename: '20260916160000_sync_investments_and_subscriptions.sql',
    action: 'APLICAR',
    justification: 'Trigger de sincronização atômica entre investimentos e debêntures.',
  },
  {
    id: 113,
    filename: '20260916170000_reject_and_delete_investments.sql',
    action: 'APLICAR',
    justification: 'RPC para rejeição e cancelamento de aportes com estorno de cotas.',
  },
  {
    id: 114,
    filename: '20260916180000_add_installments_data_to_credit_operations.sql',
    action: 'APLICAR',
    justification: 'Campo installments_data JSONB em credit_operations.',
  },
  {
    id: 115,
    filename: '20260917225000_revert_ccb_installment.sql',
    action: 'APLICAR',
    justification: 'Procedure de reversão de parcelas pagas em CCB.',
  },
  {
    id: 116,
    filename: '20260918233000_fix_revert_ccb_installment_liquidation.sql',
    action: 'APLICAR',
    justification: 'Correção nas chamadas de estorno de liquidação de CCB.',
  },
  {
    id: 117,
    filename: '20260918234500_fix_overload_revert_ccb_installment_liquidation.sql',
    action: 'APLICAR',
    justification: 'Sobrecarga de tipos e parâmetros da procedure de reversão.',
  },
  {
    id: 118,
    filename: '20260919010000_create_notifications.sql',
    action: 'APLICAR',
    justification: 'Tabela notifications e central de notificações in-app.',
  },
  {
    id: 119,
    filename: '20260920040000_credit_operations_installments.sql',
    action: 'APLICAR',
    justification: 'RPCs de liquidação e prorrogação de parcelas de antecipação.',
  },
  {
    id: 120,
    filename: '20260920050000_update_extend_credit_operation_installment.sql',
    action: 'APLICAR',
    justification: 'Cálculo de juros e multas por prorrogação de recebível.',
  },
  {
    id: 121,
    filename: '20260920060000_single_installment_receivables.sql',
    action: 'APLICAR',
    justification: 'Suporte financeiro para recebíveis de parcela única.',
  },
  {
    id: 122,
    filename: '20260920070000_resilient_single_installment_operations.sql',
    action: 'APLICAR',
    justification: 'Resiliência contra cronogramas vazios em operações simples.',
  },
  {
    id: 123,
    filename: '20260920080000_liquidate_credit_operation_full.sql',
    action: 'APLICAR',
    justification: 'Procedure de quitação integral da operação de crédito.',
  },
  {
    id: 124,
    filename: '20260920235600_sync_redemptions_treasury_caixa.sql',
    action: 'APLICAR',
    justification: 'Integração em tempo real de resgates com a tesouraria e Livro Caixa.',
  },
  {
    id: 125,
    filename: '20260921010000_sync_single_installment_liquidation.sql',
    action: 'APLICAR',
    justification: 'Conciliação contábil da liquidação de recebíveis pontuais.',
  },
  {
    id: 126,
    filename: '20260921020000_installment_operations_auto_liquidation.sql',
    action: 'APLICAR',
    justification: 'Auto-liquidação da operação quando a última parcela é quitada.',
  },
  {
    id: 127,
    filename: '20260921030000_fix_extended_installments_and_liquidation_status.sql',
    action: 'APLICAR',
    justification: 'Regra estrita: parcelas prorrogadas nunca são consideradas pagas.',
  },
  {
    id: 128,
    filename: '20260921040000_fix_receivables_installments_liquidation.sql',
    action: 'APLICAR',
    justification: 'RPCs robustos de prorrogação e baixa de parcelas.',
  },
  {
    id: 129,
    filename: '20260921050000_fix_ccb_osvaldir_dre_may_2026.sql',
    action: 'PULAR',
    justification: 'Correção de transações com ID do cliente Osvaldir no DRE.',
  },
  {
    id: 130,
    filename: '20260921060000_restore_borrower_credit_limit_on_liquidation.sql',
    action: 'APLICAR',
    justification: "Restaura o limite do tomador exclusivamente no status 'liquidado'.",
  },
  {
    id: 131,
    filename: '20260921070000_unify_liquidation_and_paid_status_credit_limit.sql',
    action: 'APLICAR',
    justification: 'Padronização de consumo de limite entre os status da operação.',
  },
  {
    id: 132,
    filename: '20260921223000_fix_borrower_credit_limit_and_restore_paid_status.sql',
    action: 'APLICAR',
    justification: "Regra Pétrea: status 'pago' consome limite; só 'liquidado' libera limite.",
  },
  {
    id: 133,
    filename: '20260922030500_admin_insert_ccb.sql',
    action: 'APLICAR',
    justification: 'Permissão de cadastro direto de CCBs pelo administrador.',
  },
  {
    id: 134,
    filename: '20260922120000_sync_ccb_installments_boletos.sql',
    action: 'APLICAR',
    justification: 'Sincronização automática entre cronograma e boletos emitidos.',
  },
  {
    id: 135,
    filename: '20260922130000_delete_cancelled_credit_operation.sql',
    action: 'APLICAR',
    justification: 'RPC de cancelamento seguro de operação de crédito.',
  },
  {
    id: 136,
    filename: '20260922183000_add_bank_account_id_to_transactions.sql',
    action: 'APLICAR',
    justification: 'Campo bank_account_id para conciliação por conta bancária.',
  },
  {
    id: 137,
    filename: '20260923000000_repair_redemption_and_decrement_total_value.sql',
    action: 'APLICAR',
    justification: 'Decremento atômico de cotas e valor financeiro no resgate.',
  },
  {
    id: 138,
    filename: '20260923010000_notifications_admin_insert.sql',
    action: 'APLICAR',
    justification: 'Permissão para administradores enviarem notificações in-app.',
  },
  {
    id: 139,
    filename: '20260923020000_send_notification_admin_rpc.sql',
    action: 'APLICAR',
    justification: 'RPC send_system_notification para avisos do sistema.',
  },
  {
    id: 140,
    filename: '20260923030000_fix_investor_wallet_and_redemption_payout.sql',
    action: 'APLICAR',
    justification: 'Gestão de saldo em carteira e pagamento em conta externa.',
  },
  {
    id: 141,
    filename: '20260923040000_add_deleted_at_to_treasury_and_delete_rpc.sql',
    action: 'APLICAR',
    justification: 'Exclusão lógica e rastreável de lançamentos avulsos da tesouraria.',
  },
  {
    id: 142,
    filename: '20260924100000_bank_accounts_transfer_and_pair.sql',
    action: 'APLICAR',
    justification: 'Tabela bank_transfers e fluxo de transferências entre contas da empresa.',
  },
  {
    id: 143,
    filename: '20260924120000_fix_get_bank_account_balance_deduplications.sql',
    action: 'APLICAR',
    justification: 'RPC get_bank_account_balance para saldo real por conta bancária.',
  },
  {
    id: 144,
    filename: '20260924210000_create_credit_managers.sql',
    action: 'APLICAR',
    justification: 'Tabelas de Gestores de Crédito (credit_managers) e comissões.',
  },
  {
    id: 145,
    filename: '20260925180000_add_commission_rate_applied_to_operations.sql',
    action: 'APLICAR',
    justification: 'Registro de comissão aplicada na esteira de concessão de crédito.',
  },
  {
    id: 146,
    filename: '20260925193000_create_company_settings.sql',
    action: 'APLICAR',
    justification: 'Tabela company_settings (dados da securitizadora para preâmbulos).',
  },
  {
    id: 147,
    filename: '20260925220000_add_debenture_escritura_and_series.sql',
    action: 'APLICAR',
    justification: 'Estrutura avançada de vinculação de escrituras e séries.',
  },
  {
    id: 148,
    filename: '20260928140000_add_escritura_registro_fields.sql',
    action: 'APLICAR',
    justification: 'Campos de registro em Cartório de Títulos e Documentos (RTD).',
  },
  {
    id: 149,
    filename: '20260928143000_debenture_contract_cache_invalidation.sql',
    action: 'APLICAR',
    justification: 'Invalidação automática de cache de termos contratuais.',
  },
  {
    id: 150,
    filename: '20260928150000_add_cautela_to_investments.sql',
    action: 'APLICAR',
    justification: 'Colunas cautela_url e data de emissão em investimentos.',
  },
  {
    id: 151,
    filename: '20260928200000_admin_internal_investments.sql',
    action: 'APLICAR',
    justification: 'Fluxo de lançamento interno de aportes pela tesouraria.',
  },
  {
    id: 152,
    filename: '20260929030000_investor_authorization_post_launch.sql',
    action: 'APLICAR',
    justification: 'Tabela de autorizações/aceites eletrônicos de investimentos.',
  },
  {
    id: 153,
    filename: '20260929200000_extend_ccb_installment.sql',
    action: 'APLICAR',
    justification: 'Procedure de prorrogação e renegociação de parcelas de CCB.',
  },
  {
    id: 154,
    filename: '20260930120000_create_notificacoes_cessao.sql',
    action: 'APLICAR',
    justification: 'Tabela notificacoes_cessao, hash seguro e aceite pelo sacado.',
  },
  {
    id: 155,
    filename: '20261002050000_create_projected_cashflow_manual_entries.sql',
    action: 'APLICAR',
    justification: 'Tabela projected_cashflow_manual_entries para projeções financeiras.',
  },
  {
    id: 156,
    filename: '20261002161500_add_recurring_expenses.sql',
    action: 'APLICAR',
    justification: 'Suporte a despesas recorrentes (mensais, anuais) e parcelamento.',
  },
  {
    id: 157,
    filename: '20261005190000_monthly_interest_redemption.sql',
    action: 'APLICAR',
    justification: 'Procedure de resgate exclusivo de rendimentos mensais sem baixar principal.',
  },
  {
    id: 158,
    filename: '20261006220000_sync_investment_manual_value.sql',
    action: 'APLICAR',
    justification: 'Sincronização e ajuste manual de valor e rendimento em aportes.',
  },
  {
    id: 159,
    filename: '20261007100000_sync_redemption_manual_value.sql',
    action: 'APLICAR',
    justification: 'Ajuste manual de valor líquido e IRRF em solicitações de resgates.',
  },
  {
    id: 160,
    filename: '20261007140000_sanitize_future_recurring_expenses.sql',
    action: 'APLICAR',
    justification: 'Trigger e saneamento que impede que despesas futuras nasçam como pagas.',
  },
  {
    id: 161,
    filename: '20261007180000_automatic_pix_fee.sql',
    action: 'APLICAR',
    justification: 'Tarifas PIX PF/PJ por conta e débito automático na tesouraria.',
  },
  {
    id: 162,
    filename: '20261007190000_fix_pj_profiles_full_name.sql',
    action: 'APLICAR',
    justification: 'Trigger de garantia de nome/razão social em cadastros PJ.',
  },
]

export const EDGE_FUNCTIONS_DATA: EdgeFunctionItem[] = [
  {
    name: 'acknowledge-cessao-notification',
    purpose:
      'Registra formalmente a ciência do sacado/devedor ao receber a notificação de cessão de crédito através de link público, capturando IP, data, hora e geolocalização para validade jurídica.',
  },
  {
    name: 'admin-create-user',
    purpose:
      'Permite ao Administrador cadastrar novos usuários (investidores, tomadores, analistas de backoffice) diretamente pelo painel administrativo, gerando credenciais seguras via Supabase Auth Admin.',
  },
  {
    name: 'admin-update-user',
    purpose:
      'Permite alterar dados sensíveis de usuários (e-mail, telefone, bloqueio de acesso, permissões) sem exigir que o próprio usuário faça login.',
  },
  {
    name: 'batch-import-users',
    purpose:
      'Importação em lote de clientes (planilhas CSV/JSON) para cadastrar investidores ou tomadores legados de uma só vez com validação de duplicidade de CPF/CNPJ.',
  },
  {
    name: 'calculate-operation',
    purpose:
      'Motor de cálculo financeiro de antecipação de recebíveis e CCBs. Aplica taxas de juros, taxa de deságio, ad valorem, taxa de estruturação/análise e calcula IOF (diário e adicional).',
  },
  {
    name: 'calculate-risk',
    purpose:
      'Avalia a matriz de risco do tomador e do sacado com base em garantias, histórico de liquidações, apontamentos e concentração de carteira, atribuindo rating (A, B, C, D ou Crítico).',
  },
  {
    name: 'delete-user',
    purpose:
      'Exclusão segura de usuário no Supabase Auth e desativação coerente de seus vínculos cadastrais pela equipe de compliance.',
  },
  {
    name: 'docusign-callback',
    purpose:
      'Webhook que recebe o evento do DocuSign quando todas as partes concluem a assinatura de um contrato, atualizando o status da operação para "Assinado" e baixando o PDF certificado.',
  },
  {
    name: 'docusign-envelope',
    purpose:
      'Cria e envia envelopes no DocuSign contendo a minuta do contrato de cessão, debênture ou CCB para coleta de assinatura eletrônica dos representantes e devedores.',
  },
  {
    name: 'extract-debenture-data',
    purpose:
      'Leitura estruturada e OCR de escrituras de emissão de debêntures em PDF, extraindo automaticamente número de série, quantidade de títulos, remuneração e datas de vencimento.',
  },
  {
    name: 'generate-aditivo',
    purpose:
      'Gera em PDF o Termo Aditivo de Cessão e Aquisição de Direitos Creditórios com a relação dos títulos adquiridos, dados do cedente, sacados, prazos e condições financeiras.',
  },
  {
    name: 'generate-cessao-notification',
    purpose:
      'Emite em PDF a Notificação Formal de Cessão de Crédito exigida por lei (Art. 290 do Código Civil) para comunicação ao devedor/sacado de que o título pertence à securitizadora.',
  },
  {
    name: 'generate-debenture-cautela',
    purpose:
      'Emite o Certificado Provisório ou Cautela de Debêntures Nominativas em nome do investidor com numeração das debêntures subscritas, dados da escritura e carimbo institucional.',
  },
  {
    name: 'generate-kyc-pdf',
    purpose:
      'Gera a Ficha Cadastral e Dossiê de Compliance KYC consolidado (dados do titular, representantes PJ, faturamento, certidões) para auditoria e arquivo legal.',
  },
  {
    name: 'generate-redemption-receipt',
    purpose:
      'Emite o Comprovante de Liquidação Financeira de Resgate para entrega ao investidor, discriminando valor bruto resgatado, imposto de renda retido na fonte (IRRF) e valor líquido creditado.',
  },
  {
    name: 'generate-subscription-term',
    purpose:
      'Gera o Boletim/Termo de Subscrição e Integralização de Debêntures formalizando o aporte financeiro do investidor na série escolhida.',
  },
  {
    name: 'invite-user',
    purpose:
      'Envia e-mail transacional de convite a novos clientes com link de primeiro acesso seguro para conclusão do cadastro e definição de senha.',
  },
  {
    name: 'notify-ccb-adjustment',
    purpose:
      'Notifica o tomador e a tesouraria por e-mail sobre alterações contratuais, prorrogação de parcelas ou amortizações extraordinárias em sua CCB.',
  },
  {
    name: 'public-signup',
    purpose:
      'Endpoint do formulário público de auto-cadastro na página inicial, criando o usuário com validação de e-mail e atribuindo o perfil inicial correspondente.',
  },
  {
    name: 'send-login-notification',
    purpose:
      'Envio de alerta de segurança por e-mail a cada login realizado com sucesso, contendo data, hora e IP de acesso para prevenção de fraudes.',
  },
  {
    name: 'send-operation-email',
    purpose:
      'Notificação por e-mail ao cliente quando sua solicitação de antecipação ou CCB é aprovada, liquidada ou necessita de novos documentos.',
  },
  {
    name: 'send-to-signature',
    purpose:
      'Despacha minutas contratuais para o provedor de assinatura digital configurado para coleta das assinaturas das partes.',
  },
  {
    name: 'serasa-integration',
    purpose:
      'Conecta à API do Serasa Experian para obter score de crédito, ocorrências de protestos, cheques sem fundos, falências e pendências financeiras do CNPJ ou CPF consultado.',
  },
  {
    name: 'serve-pdf',
    purpose:
      'Entrega com segurança e assinatura temporária os PDFs gerados na nuvem para download ou visualização em tela pelos usuários autenticados.',
  },
  {
    name: 'signature-webhook',
    purpose:
      'Webhook receptivo para provedores alternativos de assinatura eletrônica homologados no sistema.',
  },
  {
    name: 'submit-ccb',
    purpose:
      'Recebe a proposta comercial preenchida pelo tomador no formulário de CCB Digital, valida a consistência das garantias e envia para análise do comitê de crédito.',
  },
]

export const SECRETS_DATA: SecretItem[] = [
  {
    name: 'SUPABASE_URL',
    provider: 'Supabase Novo',
    description:
      'Gerado automaticamente pelo Supabase nas configurações do projeto novo (Settings -> API).',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    provider: 'Supabase Novo',
    description: 'Chave pública anon/public do Supabase novo (Settings -> API).',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    provider: 'Supabase Novo',
    description:
      'Chave privada com poderes de superadministrador do Supabase novo (Settings -> API -> service_role). Nunca expor no frontend.',
  },
  {
    name: 'SUPABASE_DB_URL',
    provider: 'Supabase Novo',
    description:
      'String de conexão direta do PostgreSQL do projeto novo (Settings -> Database -> Connection string).',
  },
  {
    name: 'RESEND_API_KEY',
    provider: 'Resend',
    description:
      'Chave de API da conta corporativa da nova empresa no Resend (resend.com). Necessário cadastrar o domínio de e-mail corporativo da empresa (ex: @novaempresa.com.br) e validar os registros DNS (SPF e DKIM) para envio dos e-mails transacionais.',
  },
  {
    name: 'SERASA_API_KEY',
    provider: 'Serasa Experian',
    description:
      'Chave de autenticação da conta da nova empresa junto ao Serasa Experian / Datacred para consultas de score e birôs de crédito. (Caso a empresa ainda não possua contrato ativo, o sistema opera com o simulador determinístico interno homologado sem travar a plataforma).',
  },
  {
    name: 'DOCUSIGN_INTEGRATION_KEY',
    provider: 'DocuSign',
    description:
      'Client ID / Integration Key criado no portal de desenvolvedores do DocuSign da nova securitizadora (docusign.com).',
  },
  {
    name: 'DOCUSIGN_ACCOUNT_ID',
    provider: 'DocuSign',
    description:
      'ID numérico da conta corporativa DocuSign da nova empresa (visível no painel da conta).',
  },
  {
    name: 'DOCUSIGN_USER_ID',
    provider: 'DocuSign',
    description: 'GUID do usuário/administrador designado da conta DocuSign da nova empresa.',
  },
  {
    name: 'DOCUSIGN_PRIVATE_KEY',
    provider: 'DocuSign',
    description:
      'Chave privada RSA gerada na conta DocuSign da empresa para autenticação via JWT (formato PEM iniciando em -----BEGIN RSA PRIVATE KEY-----).',
  },
]

export const PHASES_DATA: PhaseItem[] = [
  {
    number: 1,
    title: 'Criação do Projeto na Skip',
    steps: [
      {
        id: 'f1-s1',
        text: 'Criar um projeto novo na plataforma Skip com o nome da nova securitizadora (ex: Nova Securitizadora 360°).',
      },
      {
        id: 'f1-s2',
        text: 'Como primeira mensagem para o agente no chat do projeto novo, digite exatamente:',
        code: 'Olá, estou implantando esta plataforma para uma nova operação de securitização. Segue em anexo/abaixo o arquivo docs/GUIA-IMPLANTACAO-NOVA-OPERACAO.md com todo o inventário de migrations, regras de negócio e funções de backend. Por favor, leia este guia e use-o como especificação mestra da implantação.',
      },
      {
        id: 'f1-s3',
        text: 'Cole o texto deste guia na conversa para que o agente do novo projeto configure o frontend e as rotas com máxima fidelidade.',
      },
    ],
  },
  {
    number: 2,
    title: 'Criação do Projeto Supabase Novo',
    steps: [
      {
        id: 'f2-s1',
        text: 'Acessar supabase.com e criar uma organização em nome da nova empresa (ou selecionar uma existente).',
      },
      {
        id: 'f2-s2',
        text: 'Criar um novo projeto no Supabase (escolha a região mais próxima dos usuários, preferencialmente South America (São Paulo)).',
      },
      {
        id: 'f2-s3',
        text: 'Definir uma senha forte para o banco de dados e salvá-la em local seguro.',
      },
      {
        id: 'f2-s4',
        text: 'Copiar e anotar em um bloco de notas: Project URL, anon public key, service_role secret key e Connection string (URI) de conexão ao Postgres.',
      },
    ],
  },
  {
    number: 3,
    title: 'Aplicação das Migrations no Supabase Novo',
    steps: [
      {
        id: 'f3-s1',
        text: 'No projeto novo da Skip, certifique-se de que o backend Supabase foi conectado com as credenciais anotadas na Fase 2.',
      },
      {
        id: 'f3-s2',
        text: 'O agente de IA do novo projeto pode aplicar as migrações automaticamente ou você pode colá-las no SQL Editor do painel do Supabase.',
      },
      {
        id: 'f3-s3',
        text: 'Aplicar estritamente as 75 migrations marcadas como APLICAR na ordem cronológica (ver Seção de Migrations).',
      },
      {
        id: 'f3-s4',
        text: 'Atenção: Pular e não aplicar as 17 migrações marcadas como PULAR para evitar dados de terceiros e inconsistências.',
      },
      {
        id: 'f3-s5',
        text: 'Verificar se os 6 buckets foram criados em Storage: avatars, kyc-documents, deeds, operation-docs, investment-proofs e ccb-docs.',
      },
    ],
  },
  {
    number: 4,
    title: 'Configuração dos Segredos e Deploy das Edge Functions',
    steps: [
      {
        id: 'f4-s1',
        text: 'No painel do novo projeto Supabase, acesse Settings -> Edge Functions -> Secrets (ou configure via ferramenta de secrets na Skip).',
      },
      {
        id: 'f4-s2',
        text: 'Adicionar os 6 segredos corporativos: RESEND_API_KEY, SERASA_API_KEY, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID e DOCUSIGN_PRIVATE_KEY.',
      },
      {
        id: 'f4-s3',
        text: 'Publicar as 26 Edge Functions de supabase/functions/ no novo projeto Supabase (o agente da Skip executa isso via comando de deploy ou você pode usar o Supabase CLI).',
      },
    ],
  },
  {
    number: 5,
    title: 'Criação do Usuário Administrador e Configuração Inicial pela Interface Web',
    steps: [
      {
        id: 'f5-s1',
        text: 'Criar o primeiro usuário no Supabase Auth com o e-mail corporativo do administrador da nova empresa (ex: admin@novaempresa.com.br).',
      },
      {
        id: 'f5-s2',
        text: 'No SQL Editor do Supabase novo, executar o comando para promover este usuário a Superadministrador:',
        code: `UPDATE public.profiles
SET role = 'admin', is_admin = true, is_staff = true
WHERE email = 'admin@novaempresa.com.br';`,
      },
      {
        id: 'f5-s3',
        text: '1. Dados da Securitizadora (/admin/parameters): Preencher Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal, Endereço Completo, Nome/Cargo/CPF do Diretor representante legal e Capital Social.',
      },
      {
        id: 'f5-s4',
        text: '2. Contas Bancárias da Securitizadora (/admin/bank-accounts): Cadastrar as contas bancárias institucionais com Chave PIX e configurar as Tarifas PIX PF e Tarifa PIX PJ.',
      },
      {
        id: 'f5-s5',
        text: '3. Parâmetros Financeiros Globais (/admin/parameters): Configurar taxas padrão de Juros Mensais, Deságio, Ad Valorem, Análise/Estruturação e regras dos 6 tipos canônicos de recebíveis.',
      },
      {
        id: 'f5-s6',
        text: '4. Escrituras e Catálogo de Produtos (/admin/debentures e /admin/products): Cadastrar a 1ª Escritura de Debêntures, suas Séries e criar os produtos com taxa, carência e regime (Juros Acumulados ou Mensais).',
      },
      {
        id: 'f5-s7',
        text: '5. Gestores de Crédito (/admin/credit-managers): Se houver correspondentes ou assessores comissionados, cadastrá-los com o percentual de comissão sobre o volume originado.',
      },
    ],
  },
  {
    number: 6,
    title: 'Conexão de Domínio e Checklist de Testes de Aceitação',
    steps: [
      {
        id: 'f6-s1',
        text: 'No painel da Skip, conectar o repositório GitHub da nova empresa para versionamento independente.',
      },
      {
        id: 'f6-s2',
        text: 'Configurar o domínio customizado (ex: app.novasecuritizadora.com.br) apontando os registros CNAME/DNS conforme orientações do painel.',
      },
      {
        id: 'f6-s3',
        text: 'Teste 1 (KYC Investidor): Cadastrar investidor via auto-cadastro, preencher dados, anexar documento e aprovar o cadastro pelo painel admin.',
      },
      {
        id: 'f6-s4',
        text: 'Teste 2 (Aporte Financeiro): Simular solicitação de investimento no produto criado, anexar comprovante fictício e aprovar no admin com conciliação na conta bancária configurada.',
      },
      {
        id: 'f6-s5',
        text: 'Teste 3 (Operação de Crédito / Antecipação): Cadastrar tomador PJ com limite de R$ 100.000,00. Lançar operação de Recebível Contratual de R$ 10.000,00. Verificar desconto do limite para R$ 90.000,00.',
      },
      {
        id: 'f6-s6',
        text: 'Teste 4 (Liquidação de Recebível): Dar baixa integral na parcela do recebível. Verificar o crédito no caixa/tesouraria e confirmar que o limite do tomador foi restaurado para R$ 100.000,00.',
      },
      {
        id: 'f6-s7',
        text: 'Teste 5 (Resgate de Investimento): Solicitar resgate do investimento do Teste 2, aplicar ajuste manual de centavos se desejado, pagar no painel e conferir dedução de cotas e retenção de IRRF.',
      },
      {
        id: 'f6-s8',
        text: 'Teste 6 (DRE e DFC): Acessar /admin/dre e /admin/dfc e confirmar que deságio, captação, despesas bancárias PIX e tributos foram totalizadas com precisão.',
      },
    ],
  },
]

export const FULL_GUIDE_MARKDOWN = `# Guia Completo de Implantação — Nexum Security 360° em Nova Operação

> **Público-alvo:** Diretores, gestores operacionais e implantadores (não-programadores).  
> **Finalidade deste documento:** Este arquivo reúne todas as especificações e instruções necessárias para subir uma instância **nova, limpa e independente** da plataforma **Nexum Security 360°** em um novo projeto na plataforma **Skip** conectado a um novo banco de dados **Supabase**.  
> **Como usar:** Copie o conteúdo deste arquivo e envie ao agente de IA do novo projeto Skip como instrução mestre da nova operação.

---

## 1. Visão Geral da Plataforma

A **Nexum Security 360°** é uma plataforma institucional para **Securitizadoras de Crédito**, desenhada para fazer a gestão completa e centralizada do ciclo de securitização: captação de recursos via debêntures/títulos de investimento (Passivo) e originação/aquisição de direitos creditórios e CCBs (Ativo), com tesouraria, contabilidade gerencial (DRE/DFC) e inteligência analítica integradas.

### Módulos Principais do Sistema Real:

1. **Perfis & Compliance KYC (PF e PJ):**
   - Onboarding digital com validação rigorosa de CPF e CNPJ.
   - Suporte a procuradores e representantes legais para Pessoas Jurídicas.
   - Upload e custódia de documentos comprobatórios (balanços, certidões, contratos sociais, CNH) em bucket seguro (\`kyc-documents\`).
   - Dossiê cadastral consolidado com exportação em PDF e controle de status (Pendente, Em Análise, Aprovado, Rejeitado).

2. **Passivo — Catálogo de Produtos e Debêntures:**
   - Gestão de Escrituras de Emissão e Séries de Debêntures vinculadas com numeração, volume, prazos e indexadores (CDI, IPCA, Pré-fixado, etc.).
   - Catálogo flexível de produtos de investimento com suporte a **Regime de Juros Acumulado** (capitalização com liquidação no vencimento/resgate) ou **Regime de Juros Mensal** (rendimento pago periodicamente sem amortizar o principal).
   - Emissão automatizada do **Termo de Subscrição de Debêntures** e do **Certificado de Cautela** nominativa em PDF com assinatura eletrônica.

3. **Ativo — Operações de Crédito & CCB (Cédula de Crédito Bancário):**
   - Antecipação de Recebíveis com cronograma de parcelas e os **6 tipos canônicos homologados**:
     1. **Cheque** (pré-datados e à vista)
     2. **Nota Promissória** (títulos de crédito por promessa de pagamento)
     3. **Contrato de Mútuo** (mútuo financeiro com prazos ou garantias)
     4. **Confissão de Dívida** (instrumentos públicos ou particulares)
     5. **Recebível Contratual** (prestação de serviços, locação, fornecimento)
     6. **Outros** (com descrição personalizada da garantia/origem)
   - Emissão de CCB Digital, minutas de Aditivos Contratuais e envio automático da **Notificação de Cessão de Crédito** formal aos sacados devedores com link público de tomada de ciência.

4. **Aportes e Resgates de Investidores com Ajuste Manual:**
   - Fluxo de aprovação de investimentos com envio e validação de comprovantes de transferência.
   - Solicitação de resgates com cálculo automático de carência, amortização de cotas, retenção de imposto de renda (IRRF) ou conversão automática para reinvestimento em novas séries.
   - Painel administrativo com permissão para **ajuste manual de valor líquido e imposto**, permitindo conciliação exata de centavos antes do pagamento.

5. **Tesouraria & Livro Caixa:**
   - Controle de contas bancárias da empresa securitizadora com conciliação manual e automática.
   - Transferências financeiras entre contas internas da própria securitizadora com pareamento atômico de débitos e créditos.
   - **Tarifas PIX PF e PJ por Conta Bancária:** configuração individual de custo de transferência PIX por conta, com lançamento automático de despesa na tesouraria e estorno inteligente ao desfazer transferências.
   - Gestão de Despesas Administrativas e Recorrentes com parcelamento inteligente (saneamento preventivo que assegura que parcelas futuras não nasçam como pagas).

6. **Planejamento Financeiro, DRE e DFC:**
   - **Fluxo de Caixa Projetado:** visão tabular mês a mês das receitas contratuais esperadas, despesas recorrentes e possibilidade de lançamentos manuais projetados.
   - **DRE (Demonstrativo do Resultado do Exercício):** apuração real de receitas brutas de cessão, deduções, despesas de captação (juros de investidores), despesas operacionais e cálculo dos tributos federais da securitizadora.
   - **DFC (Demonstrativo do Fluxo de Caixa):** classificação direta pelo padrão contábil FASB 95 em Atividades Operacionais, Atividades de Investimento e Atividades de Financiamento.

7. **Assistente Virtual Nexum:**
   - Chat inteligente contextual alimentado pela base de conhecimento institucional (\`src/lib/assistant-knowledge.ts\`), segmentando respostas por perfil de acesso (investidor, tomador, analista e administrador).

---

## 2. Inventário de Migrations do Banco de Dados

O banco de dados possui **92 arquivos de migração** em \`supabase/migrations/\`.  
Para uma implantação limpa em uma nova operação, as migrações são divididas estritamente em duas categorias:

- **APLICAR (75 migrations):** Migrações estruturais que criam tabelas, colunas, tipos enumerados, índices, funções de banco (RPCs), triggers de auditoria/cálculo, buckets de armazenamento e tabelas de domínio. **Devem ser executadas em ordem cronológica.**
- **PULAR (17 migrations):** Scripts corretivos que continham dados de testes da operação piloto anterior (nomes de clientes específicos, correções manuais de datas de CCB de terceiros, deleções de tabelas de protótipo já descontinuadas, ou cadastros de administradores com e-mails e senhas conhecidos). **Não devem ser aplicadas na nova operação para manter o banco limpo e seguro.**

### Tabela Classificada de Migrations

| # | Arquivo de Migração | Classificação | Justificativa / Finalidade |
|---|---|---|---|
${MIGRATIONS_DATA.map((m) => `| ${m.id} | \`${m.filename}\` | **${m.action}** | ${m.justification} |`).join('\n')}

---

## 3. Inventário de Funções de Backend (Edge Functions)

Todas as **26 Edge Functions** de \`supabase/functions/\` devem ser publicadas no novo Supabase.  
Abaixo está o descritivo de cada uma em linguagem de produto:

${EDGE_FUNCTIONS_DATA.map((ef, idx) => `${idx + 1}. **\`${ef.name}\`**\n   _Finalidade:_ ${ef.purpose}`).join('\n\n')}

---

## 4. Credenciais e Segredos do Ambiente (Secrets)

Para que a nova operação funcione sem erros, ela precisa possuir suas **próprias contas corporativas** nos serviços externos integrados.  
Nenhuma chave ou credencial da operação anterior deve ser reaproveitada.

| Nome do Segredo (Secret) | Serviço / Provedor | O que é e onde obter na nova operação |
|---|---|---|
${SECRETS_DATA.map((s) => `| \`${s.name}\` | ${s.provider} | ${s.description} |`).join('\n')}

---

## 5. Passo a Passo de Implantação (Checklist para Não-Programadores)

Siga as fases numeradas. Cada fase possui caixas de seleção \`[ ]\` para acompanhamento do progresso:

### Fase 1: Criação do Projeto na Skip
- [ ] Criar um projeto novo na plataforma **Skip** com o nome da nova securitizadora (ex: _Nova Securitizadora 360°_).
- [ ] Como primeira mensagem para o agente no chat do projeto novo, digite exatamente:
  > _"Olá, estou implantando esta plataforma para uma nova operação de securitização. Segue em anexo/abaixo o arquivo \`docs/GUIA-IMPLANTACAO-NOVA-OPERACAO.md\` com todo o inventário de migrations, regras de negócio e funções de backend. Por favor, leia este guia e use-o como especificação mestra da implantação."_
- [ ] Cole o texto deste guia na conversa para que o agente do novo projeto configure o frontend e as rotas com máxima fidelidade.

### Fase 2: Criação do Projeto Supabase Novo
- [ ] Acessar [supabase.com](https://supabase.com) e criar uma organização em nome da nova empresa (ou selecionar uma existente).
- [ ] Criar um novo projeto no Supabase (escolha a região mais próxima dos usuários, preferencialmente \`South America (São Paulo)\`).
- [ ] Definir uma senha forte para o banco de dados e salvá-la em local seguro.
- [ ] Copiar e anotar em um bloco de notas:
  - \`Project URL\` (ex: \`https://xyz...supabase.co\`)
  - \`anon public key\`
  - \`service_role secret key\`
  - \`Connection string (URI)\` de conexão ao Postgres.

### Fase 3: Aplicação das Migrations no Supabase Novo
- [ ] No projeto novo da Skip, certifique-se de que o backend Supabase foi conectado com as credenciais anotadas na Fase 2.
- [ ] O agente de IA do novo projeto pode aplicar as migrações automaticamente ou você pode colá-las no **SQL Editor** do painel do Supabase.
- [ ] Aplicar estritamente as **75 migrations marcadas como APLICAR** na ordem cronológica (ver Seção 2).
- [ ] **Atenção:** Pular e não aplicar as 17 migrações marcadas como **PULAR** para evitar dados de terceiros e inconsistências.
- [ ] Verificar se os 6 buckets foram criados em \`Storage\`:
  - \`avatars\`
  - \`kyc-documents\`
  - \`deeds\`
  - \`operation-docs\`
  - \`investment-proofs\`
  - \`ccb-docs\`

### Fase 4: Configuração dos Segredos e Deploy das Edge Functions
- [ ] No painel do novo projeto Supabase, acesse \`Settings -> Edge Functions -> Secrets\` (ou configure via ferramenta de secrets na Skip).
- [ ] Adicionar os segredos descritos na Seção 4:
  - \`RESEND_API_KEY\`
  - \`SERASA_API_KEY\`
  - \`DOCUSIGN_INTEGRATION_KEY\`
  - \`DOCUSIGN_ACCOUNT_ID\`
  - \`DOCUSIGN_USER_ID\`
  - \`DOCUSIGN_PRIVATE_KEY\`
- [ ] Publicar as **26 Edge Functions** de \`supabase/functions/\` no novo projeto Supabase.

### Fase 5: Criação do Usuário Administrador e Configuração Inicial pela Interface Web
- [ ] Criar o primeiro usuário no Supabase Auth com o e-mail corporativo do administrador da nova empresa (ex: \`admin@novaempresa.com.br\`).
- [ ] No SQL Editor do Supabase novo, executar o comando abaixo para promover este usuário a Superadministrador:
  \`\`\`sql
  UPDATE public.profiles
  SET role = 'admin', is_admin = true, is_staff = true
  WHERE email = 'admin@novaempresa.com.br';
  \`\`\`
- [ ] Fazer login na interface web da plataforma e acessar o menu de configurações para cadastrar os dados da nova empresa:
  - **1. Dados da Securitizadora (\`/admin/parameters\`):**
    - [ ] Preencher Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Inscrição Municipal e Endereço Completo da sede.
    - [ ] Cadastrar Nome, Cargo e CPF do Diretor/Representante legal que assinará os contratos.
    - [ ] Informar o Capital Social e Enquadramento Regulatório.
  - **2. Contas Bancárias da Securitizadora (\`/admin/bank-accounts\`):**
    - [ ] Cadastrar as contas bancárias institucionais que a securitizadora usará para receber aportes e pagar resgates/operações.
    - [ ] Informar Banco, Agência, Conta Corrente, Chave PIX e Nome do Titular.
    - [ ] **Configurar as Tarifas PIX:** definir o custo da **Tarifa PIX PF** e da **Tarifa PIX PJ**.
  - **3. Parâmetros Financeiros Globais (\`/admin/parameters\`):**
    - [ ] Configurar as taxas padrão: Juros Mensais, Taxa de Deságio, Ad Valorem, Tarifa de Análise e Estruturação.
    - [ ] Configurar regras específicas para cada um dos 6 tipos canônicos de recebíveis.
  - **4. Escrituras e Catálogo de Produtos de Investimento (\`/admin/debentures\` e \`/admin/products\`):**
    - [ ] Cadastrar a primeira Escritura de Emissão de Debêntures e suas respectivas Séries.
    - [ ] Criar os produtos de investimento ofertados aos investidores (**Juros Acumulados** ou **Juros Mensais**).
  - **5. Gestores de Crédito (\`/admin/credit-managers\`):**
    - [ ] Se a nova operação trabalhar com correspondentes, parceiros ou assessores de crédito comissionados, cadastrá-los informando o percentual de comissão sobre o volume originado.

### Fase 6: Conexão de Domínio e Checklist de Testes de Aceitação
- [ ] No painel da Skip, conectar o repositório GitHub da nova empresa para versionamento independente.
- [ ] Configurar o domínio customizado (ex: \`app.novasecuritizadora.com.br\`) apontando os registros CNAME/DNS conforme orientações do painel.
- [ ] **Executar o Checklist de Testes de Aceitação Ponta a Ponta:**
  - [ ] **Teste 1 (KYC Investidor):** Cadastrar um investidor via auto-cadastro, preencher dados, anexar documento e aprovar o cadastro pelo painel admin.
  - [ ] **Teste 2 (Aporte Financeiro):** Como investidor, simular uma solicitação de investimento no produto criado, anexar comprovante fictício e aprovar o aporte no admin com conciliação na conta bancária configurada.
  - [ ] **Teste 3 (Operação de Crédito / Antecipação):** Cadastrar um tomador PJ com limite de crédito de R$ 100.000,00. Lançar uma operação de recebível com tipo "Recebível Contratual" de R$ 10.000,00. Verificar o desconto do limite do tomador para R$ 90.000,00.
  - [ ] **Teste 4 (Liquidação de Recebível):** Dar baixa integral na parcela do recebível. Verificar o crédito do valor na tesouraria/caixa e confirmar que o limite do tomador foi restaurado para R$ 100.000,00.
  - [ ] **Teste 5 (Resgate de Investimento):** Solicitar o resgate do investimento do Teste 2, aplicar ajuste manual de centavos se desejado, pagar o resgate no painel e conferir a dedução de cotas e retenção de IRRF.
  - [ ] **Teste 6 (DRE e DFC):** Acessar \`/admin/dre\` e \`/admin/dfc\` e confirmar que as receitas de deságio, despesas de captação, despesas bancárias PIX e tributos foram totalizadas com precisão.

---

## 6. Avisos Importantes e Regras de Negócio Inegociáveis

### 1. Operação Limpa (Zero Contaminação de Dados)
A nova empresa deve iniciar com **saldo zero, histórico zerado e nenhuma informação de clientes da operação anterior**.  
Nenhum arquivo de backup, tabela de backup (\`pre_producao_preserva_investimentos\`) ou registros de auditoria da base anterior devem ser transferidos.

### 2. Regra Pétrea do Limite de Crédito do Tomador (Sensibilidade Máxima)
A lógica de consumo e liberação do limite de crédito do tomador segue uma regra institucional estrita que **jamais deve ser alterada**:
- **Operação Aprovada:** Consome o limite de crédito do tomador.
- **Operação com status "Pago":** O status \`"pago"\` significa que a securitizadora desembolsou o recurso para o cedente (o tomador já recebeu o dinheiro). Portanto, **"pago" CONTINUA CONSUMINDO o limite de crédito do tomador**. Sob nenhuma hipótese uma operação paga deve liberar limite ou retornar para "aprovado".
- **Operação com status "Liquidado":** O status \`"liquidado"\` significa que o devedor/sacado final pagou o título e o dinheiro entrou de volta no caixa da securitizadora. **SOMENTE O STATUS "LIQUIDADO" LIBERA E RESTAURA O LIMITE DE CRÉDITO DO TOMADOR.**
- Operações canceladas ou reprovadas também liberam o limite.

### 3. Tributação Obrigatória de Securitizadora de Créditos (Lei Federal nº 9.718/1998)
As empresas de securitização de créditos são obrigadas ao regime de tributação pelo **Lucro Real**. A plataforma já vem configurada e parametrizada com as alíquotas oficiais e regras de dedução da Receita Federal:
- **PIS (0,65%) e COFINS (4,00%):** Regime cumulativo sobre a receita bruta operacional (spread). A legislação permite a **dedução direta das despesas financeiras de captação** (juros remuneratórios das debêntures pagos aos investidores) da base de cálculo.
- **IRPJ (Imposto de Renda Pessoa Jurídica):** Alíquota de **15% sobre o lucro real**, acrescida do **Adicional de 10%** sobre a parcela do lucro tributável que exceder R$ 20.000,00 por mês (R$ 60.000,00 no trimestre).
- **CSLL (Contribuição Social sobre o Lucro Líquido):** Alíquota de **9%** sobre o lucro real.
- **IOF (Imposto sobre Operações Financeiras):** As operações de cessão definitiva de direitos creditórios e recebíveis realizadas por securitizadoras são isentas/alíquota zero de IOF crédito.
- **ISS (Imposto Sobre Serviços):** **Não incide** sobre a compra e securitização de direitos creditórios por ausência de prestação de serviços nos termos da Lei Complementar nº 116/2003.

---

_Documento gerado e homologado para implantação institucional da plataforma Nexum Security 360°._
`
